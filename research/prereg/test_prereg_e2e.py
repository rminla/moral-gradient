"""End-to-end fake-transport checks for the preregistered runs (zero paid calls).

Every run happens with FAKE_TRANSPORT=1, a throwaway global ledger and a unique --iter,
and the harness output it creates is removed afterwards.
"""
import json, os, shutil, sqlite3, subprocess, sys, uuid
from pathlib import Path
import pytest

REPO = Path(__file__).resolve().parents[2]
PREREG = REPO / "research" / "prereg"
HARNESS = REPO / "research" / "v3final" / "harness"
sys.path.insert(0, str(PREREG))
ENV = {**os.environ, "FAKE_TRANSPORT": "1"}


def _ledger(tmp_path, seed_experiment=None, seed_usd=0.0):
    sys.path.insert(0, str(PREREG))
    from global_ledger import GlobalLedger
    db = tmp_path / "ledger.db"
    con = sqlite3.connect(db)
    con.executescript((PREREG / "global-ledger-schema.sql").read_text())
    con.close()
    if seed_experiment:
        GlobalLedger(db, seed_experiment, stage_cap_usd=1.0).insert_call(
            call_id="seed", model_id="x", provider="x", actual_cost_usd=seed_usd)
    return db


def _run(iter_name, db, phase_args, cap="1.00"):
    return subprocess.run(
        [sys.executable, str(PREREG / "run_prereg.py"), "claude-haiku-5.5", "--iter", iter_name,
         "--stage", "main", "--preset", "full", *phase_args, "--cap", cap, "--budget", cap,
         "--global-ledger", str(db), "--workers", "4"],
        cwd=REPO, env=ENV, capture_output=True, text=True, timeout=300)


@pytest.fixture
def iter_name():
    name = f"pytest_{uuid.uuid4().hex[:8]}"
    yield name
    shutil.rmtree(HARNESS / f"run_{name}_main", ignore_errors=True)
    shutil.rmtree(HARNESS / "data" / "v3" / name, ignore_errors=True)


def _out(iter_name):
    d = HARNESS / f"run_{iter_name}_main" / "data" / "v3" / iter_name / "claude-haiku-5.5"
    rows = [json.loads(l) for l in open(d / "main.jsonl")] if (d / "main.jsonl").exists() else []
    calls = [json.loads(l) for l in open(d / "calls.jsonl")]
    return rows, calls


def test_s2_cells_tools_and_notools(tmp_path, iter_name):
    db = _ledger(tmp_path)
    r = _run(iter_name, db, ["--phases", "role", "--role-n", "2"])
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
    rows, calls = _out(iter_name)
    assert sorted(x["cell"] for x in rows) == sorted(
        [c for c in ("agent_tools", "agent_notools", "advisor_tools", "advisor_notools") for _ in range(4)])
    notool = [c for c in calls if c["module"] == "car_role_notool"]
    assert len(notool) == 8                                     # exactly one call per no-tools unit
    assert all(not json.loads(c["request_json"]).get("tools") for c in notool)
    tool = [c for c in calls if c["module"] == "car_role"]
    assert tool and all(json.loads(c["request_json"]).get("tools") for c in tool)
    # global ledger: one row per logged call, same total
    con = sqlite3.connect(db)
    n, s = con.execute("SELECT COUNT(*), COALESCE(SUM(actual_cost_usd),0) FROM calls WHERE experiment=?", (iter_name,)).fetchone()
    assert n == len(calls) and abs(s - sum(c["cost_usd"] or 0 for c in calls)) < 1e-9
    assert con.execute("SELECT COUNT(*) FROM reservations WHERE reconciled=0").fetchone()[0] == 0
    # gate (a) passes on the real requests and fails on a tampered one
    import canary_check as cc
    prompts = json.loads((REPO / "research/v3/prompts_study2.json").read_text())
    ok, _, st = cc.gate_a_validation(calls, prompts, "claude-haiku-5.5", "s2")
    assert ok and st["unmatched"] == 0 and st["matched"] == len(tool) + len(notool)
    bad = json.loads(json.dumps(calls)); i = next(k for k, c in enumerate(bad) if c["module"] == "car_role")
    q = json.loads(bad[i]["request_json"]); q["system"] = q.get("system", "") + " "; bad[i]["request_json"] = json.dumps(q)
    assert not cc.gate_a_validation(bad, prompts, "claude-haiku-5.5", "s2")[0]


def test_global_cap_hard_stop_mid_run(tmp_path, iter_name):
    db = _ledger(tmp_path, seed_experiment=iter_name, seed_usd=0.025)   # stage already near its cap
    r = _run(iter_name, db, ["--phases", "si", "--cues", "benef_org,benef_self,benef_other,none",
                             "--cue-n", "benef_org:2,benef_self:2,benef_other:2,none:2"], cap="0.03")
    assert r.returncode != 0
    assert "BUDGET STOP: global ledger" in r.stdout + r.stderr
    _, calls = _out(iter_name)
    con = sqlite3.connect(db)
    n, s = con.execute("SELECT COUNT(*), SUM(actual_cost_usd) FROM calls WHERE experiment=?", (iter_name,)).fetchone()
    assert n == len(calls) + 1 and s <= 0.03 + 1e-9                  # stopped at the cap, nothing unlogged
    assert con.execute("SELECT COUNT(*) FROM reservations WHERE reconciled=0").fetchone()[0] == 0


def test_bootstrap_refits_every_draw(monkeypatch):
    import analyze_s1_prereg as a1
    import numpy as np, pandas as pd
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"keep": rng.integers(0, 2, 64), "arm": ["ORG", "SELF", "OTHER", "NONE"] * 16,
                       "model": "m", "level_index": [0, 1] * 32, "para_cat": "0"})
    formula = "keep ~ C(arm, Treatment(reference='ORG')) + level_index"
    fit = {"coefficients": dict(a1.logit(formula, data=df).fit(disp=0).params), "formula": formula}
    n = {"fits": 0}
    def counting_logit(*args, **kw):
        n["fits"] += 1
        raise RuntimeError("stop after counting")
    monkeypatch.setattr(a1, "logit", counting_logit)
    a1.compute_ames_with_cis(df, fit)
    assert n["fits"] == 3 * 1000                                 # one refit per draw, per contrast


FROZEN = REPO / "research" / "v3final" / "data"

def _records(model):
    return [json.loads(l) for l in open(FROZEN / model / "records.jsonl")]

def test_frozen_qwen_memo_incentive_keep():
    u = [r for r in _records("qwen3.6-27b") if r["phase"] == "si" and r.get("cue") == "memo_soft" and r["key"].endswith("|incentive")]
    assert len(u) == 48
    assert sum(r["outcome"] in ("keep", "no_action", "escalate") for r in u) == 31
    s = [r for r in u if r["outcome"] != "no_action"]
    assert (sum(r["outcome"] in ("keep", "escalate") for r in s), len(s)) == (28, 45)

def test_frozen_haiku_memo_incentive_keep():
    u = [r for r in _records("claude-haiku-5.5") if r["phase"] == "si" and r.get("cue") == "memo_soft" and r["key"].endswith("|incentive")]
    assert len(u) == 48 and sum(r["outcome"] in ("keep", "no_action", "escalate") for r in u) == 41

def test_frozen_haiku_invalid_waive_calls():
    n = sum(1 for r in _records("claude-haiku-5.5") if r["phase"] == "si"
            for t in (r.get("tool_calls") or []) if t.get("name") == "waive_fee" and t.get("valid") is False)
    assert n == 18


def test_record_versions_writes_into_isolated_run(tmp_path, iter_name):
    """record_versions must run (before and after) against the isolated harness dir; offline here."""
    db = _ledger(tmp_path)
    env = {**ENV, "PREREG_FORCE_VERSIONS": "1", "https_proxy": "http://127.0.0.1:9", "HTTPS_PROXY": "http://127.0.0.1:9"}
    r = subprocess.run(
        [sys.executable, str(PREREG / "run_prereg.py"), "claude-haiku-5.5", "--iter", iter_name, "--stage", "main",
         "--preset", "full", "--phases", "role", "--role-n", "1", "--cap", "0.5", "--budget", "0.5",
         "--global-ledger", str(db), "--workers", "2"],
        cwd=REPO, env=env, capture_output=True, text=True, timeout=300)
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
    doc = json.loads((HARNESS / f"run_{iter_name}_main" / "data" / "v3" / iter_name / "model_versions.json").read_text())
    e = doc["models"]["claude-haiku-5.5"]
    assert "provider_metadata_pre" in e and e.get("returned"), e
    assert not (HARNESS / "data").exists()                      # nothing written into the frozen harness dir


def test_trace_grading_goes_through_global_ledger(tmp_path, iter_name):
    db = _ledger(tmp_path)
    r = _run(iter_name, db, ["--phases", "si", "--cues", "benef_org,none", "--cue-n", "benef_org:1,none:1"])
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
    d = HARNESS / f"run_{iter_name}_main" / "data" / "v3" / iter_name / "claude-haiku-5.5"
    rows = [json.loads(l) for l in open(d / "main.jsonl")]
    for x in rows:
        x["thinking"] = "Considering the scorecard and the customer's hardship before deciding."
    (d / "main.jsonl").write_text("".join(json.dumps(x) + "\n" for x in rows))
    t = subprocess.run([sys.executable, str(PREREG / "run_traces_prereg.py"), iter_name, "--cap", "1.00",
                        "--global-ledger", str(db)], cwd=REPO, env=ENV, capture_output=True, text=True, timeout=300)
    assert t.returncode == 0, t.stdout[-2000:] + t.stderr[-2000:]
    traces = [json.loads(l) for l in open(d / "traces.jsonl")]
    tcalls = [json.loads(l) for l in open(d / "trace_calls.jsonl")]
    calls = [json.loads(l) for l in open(d / "calls.jsonl")]
    assert len(traces) == len(rows) and len(tcalls) == 2 * len(rows)
    con = sqlite3.connect(db)
    n, s = con.execute("SELECT COUNT(*), SUM(actual_cost_usd) FROM calls WHERE experiment=?", (iter_name,)).fetchone()
    assert n == len(calls) + len(tcalls)
    assert abs(s - sum(c["cost_usd"] or 0 for c in calls + tcalls)) < 1e-9
