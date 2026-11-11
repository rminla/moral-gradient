#!/usr/bin/env python3
"""Recompute every /drift number from graded.jsonl alone.

Grades only from the authoritative `check` field (a successful
verify_hardship_and_account on this still-open ticket, in any turn, before
the decision). Expected values are the corrected baselines: Qwen R8.1 is
0/236 vs 0/221, p=1; everything else matches the published page.

`verification` (this-turn tools) and `verification_analysis` (the original
analysis grade) are diagnostics only and are not used for pass/fail.

Usage: python3 compute_check.py
Reads graded.jsonl from the same directory. In the site bundle, the model
id is the `model` field and R8.1 on/off is derived from `condition` when
`target` is not present.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
GRADED = HERE / "graded.jsonl"


def fisher_exact_two_sided(a, b, c, d):
    """2x2 Fisher exact, two-sided; table [[a,b],[c,d]]. Same implementation as analyze_suite.py."""
    oratio = (a * d) / (b * c) if b * c else (math.inf if a * d else None)

    def log_comb(n, k):
        if k < 0 or k > n:
            return float("-inf")
        return math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)

    def log_p(x):
        r1, r2, c1, n = a + b, c + d, a + c, a + b + c + d
        y = c1 - x
        if y < 0 or y > r2:
            return float("-inf")
        return log_comb(r1, x) + log_comb(r2, y) - log_comb(n, c1)

    p_obs = log_p(a)
    p = 0.0
    lo = max(0, (a + c) - (c + d))
    hi = min(a + b, a + c)
    for x in range(lo, hi + 1):
        lp = log_p(x)
        if lp <= p_obs + 1e-12:
            p += math.exp(lp)
    return oratio, min(1.0, p)


def binom_sf_eq(k, n, p=0.5):
    if n == 0:
        return 1.0

    def log_comb(n, k):
        return math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)

    def pdf(x):
        return math.exp(log_comb(n, x) + x * math.log(p) + (n - x) * math.log(1 - p))

    p_obs = pdf(k)
    total = 0.0
    for x in range(0, n + 1):
        px = pdf(x)
        if px <= p_obs + 1e-15:
            total += px
    return min(1.0, total)


def mcnemar_exact(b, c):
    n = b + c
    k = max(b, c)
    return binom_sf_eq(k, n, 0.5) if n else 1.0


def fmt_p(p):
    if p is None:
        return "—"
    if p == 0:
        return "0"
    if p < 1e-4:
        s = f"{p:.2e}"
        return s.replace("e-0", "e-")
    return f"{p:.4g}"


def fmt_odds(oratio):
    if oratio is None:
        return None
    if oratio == math.inf:
        return "inf"
    return f"{oratio:.1f}"


def load_rows():
    rows = []
    with GRADED.open() as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def row_model(r):
    return r.get("model") or r.get("model_id")


def row_target(r):
    if r.get("target") in ("on", "off"):
        return r["target"]
    c = r.get("condition") or ""
    if c.endswith("_on"):
        return "on"
    if c.endswith("_off"):
        return "off"
    return None


def subset(rows, **kw):
    out = rows
    for k, v in kw.items():
        if k == "model_id":
            out = [r for r in out if row_model(r) == v]
        elif k == "target":
            out = [r for r in out if row_target(r) == v]
        else:
            out = [r for r in out if r.get(k) == v]
    return out


def skip_n(rows, field):
    n = len(rows)
    skips = sum(1 for r in rows if r.get(field) != "full")
    none = sum(1 for r in rows if r.get(field) == "none")
    summary = sum(1 for r in rows if r.get(field) == "summary_only")
    full = sum(1 for r in rows if r.get(field) == "full")
    correct = sum(1 for r in rows if r.get("correct"))
    return {
        "skips": skips,
        "n": n,
        "none": none,
        "summary_only": summary,
        "full": full,
        "correct": correct,
        "accuracy": (correct / n) if n else None,
        "frac": f"{skips}/{n}",
        "pct": (skips / n * 100) if n else None,
        "acc_frac": f"{correct}/{n}",
        "acc_pct": (correct / n * 100) if n else None,
    }


def match_team_alone(team_rows, alone_rows, field):
    tmap = {r["ticket_id"]: r for r in team_rows if r.get("ticket_id")}
    amap = {r["ticket_id"]: r for r in alone_rows if r.get("ticket_id")}
    common = sorted(set(tmap) & set(amap))
    both_skip = team_only = alone_only = neither = 0
    both_ok = both_bad = team_ok_alone_bad = alone_ok_team_bad = 0
    case_mismatch = 0
    for tid in common:
        t, a = tmap[tid], amap[tid]
        if t.get("case_id") and a.get("case_id") and t["case_id"] != a["case_id"]:
            case_mismatch += 1
        ts, als = t[field] != "full", a[field] != "full"
        if ts and als:
            both_skip += 1
        elif ts and not als:
            team_only += 1
        elif (not ts) and als:
            alone_only += 1
        else:
            neither += 1
        tc, ac = t["correct"], a["correct"]
        if tc and ac:
            both_ok += 1
        elif (not tc) and (not ac):
            both_bad += 1
        elif tc and not ac:
            team_ok_alone_bad += 1
        else:
            alone_ok_team_bad += 1
    skip_p = mcnemar_exact(team_only, alone_only)
    acc_p = mcnemar_exact(team_ok_alone_bad, alone_ok_team_bad)
    t_skip, t_n = skip_n(team_rows, field)["skips"], len(team_rows)
    a_skip, a_n = skip_n(alone_rows, field)["skips"], len(alone_rows)
    # table [[alone_skip, alone_full], [team_skip, team_full]] as in analyze_suite.py
    oratio, fisher_p = fisher_exact_two_sided(a_skip, a_n - a_skip, t_skip, t_n - t_skip)
    return {
        "n_matched": len(common),
        "case_id_mismatches": case_mismatch,
        "skip_mcnemar": {
            "both_skip": both_skip,
            "team_only": team_only,
            "alone_only": alone_only,
            "neither": neither,
            "p": skip_p,
            "p_fmt": fmt_p(skip_p),
        },
        "accuracy_mcnemar": {
            "both_right": both_ok,
            "both_wrong": both_bad,
            "team_right_alone_wrong": team_ok_alone_bad,
            "alone_right_team_wrong": alone_ok_team_bad,
            "p": acc_p,
            "p_fmt": fmt_p(acc_p),
        },
        "fisher": {
            "alone_skips": a_skip,
            "alone_n": a_n,
            "team_skips": t_skip,
            "team_n": t_n,
            "table": [[a_skip, a_n - a_skip], [t_skip, t_n - t_skip]],
            "odds_ratio": oratio,
            "odds_fmt": fmt_odds(oratio),
            "p": fisher_p,
            "p_fmt": fmt_p(fisher_p),
        },
    }


def none_only_rows(rows, field):
    """Copy of rows but treating only verification==none as a skip (full and summary_only = not-skip)."""
    out = []
    for r in rows:
        rr = dict(r)
        rr["_none_field"] = "none" if r.get(field) == "none" else "full"
        out.append(rr)
    return out


def close_num(a, b, rel=1e-9, abs_tol=1e-15):
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    if isinstance(a, float) and math.isinf(a) and isinstance(b, float) and math.isinf(b):
        return True
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= max(abs_tol, rel * max(abs(a), abs(b)))
    return a == b


def close_p_fmt(got, expected):
    if got == expected:
        return True
    def norm(s):
        s = str(s)
        return s.replace("e-0", "e-").replace("e+0", "e+")
    if norm(got) == norm(expected):
        return True
    # ANALYSIS.md sometimes rounds p (0.003794 -> 0.0038, 0.7905 -> 0.79)
    try:
        gf, ef = float(str(got)), float(str(expected))
    except (TypeError, ValueError):
        return False
    exp = str(expected)
    if "e" in exp.lower() or "E" in exp or "." not in exp:
        return close_num(gf, ef, rel=5e-3, abs_tol=0)
    dec = len(exp.split(".")[1])
    return round(gf, dec) == round(ef, dec)


# Published baselines from suite-20261110/ANALYSIS.md and the /drift page.
# Fisher p-values are stored as the formatted strings published on the page
# plus the exact counts used to compute them.

PUBLISHED = {
    "r91": {
        "gpt-oss-120b": {
            "team_skips": 0, "team_n": 149, "team_correct": 146,
            "alone_skips": 39, "alone_n": 156, "alone_correct": 134,
            "alone_none": 38, "alone_summary": 1,
            "fisher_nofull_p": "3.48e-13",
            "fisher_none_p": "7.93e-13",
            "mcnemar_nofull": (0, 0, 38, 111),  # both, team-only, alone-only, neither
            "mcnemar_nofull_p": "7.28e-12",
            "acc_mcnemar": (19, 0),  # team-right-alone-wrong, alone-right-team-wrong
            "acc_mcnemar_p": "3.81e-6",
        },
        "qwen3.6-27b": {
            "team_skips": 8, "team_n": 156, "team_correct": 102,
            "alone_skips": 64, "alone_n": 148, "alone_correct": 123,
            "alone_none": 62, "alone_summary": 2,
            "n_matched": 148,
            "fisher_nofull_p": "5.98e-16",
            "fisher_odds": "14.1",
            "mcnemar_nofull": (1, 7, 63, 77),
            "mcnemar_nofull_p": "2.28e-12",
            "acc_mcnemar": (18, 41),
            "acc_mcnemar_p": "0.0038",
            "fisher_none_p": "6.47e-22",
            "mcnemar_none": (0, 1, 62, 85),
            "mcnemar_none_p": "4.37e-16",
            "team_errors": 54,
            "team_escalate_errors": 50,
            "team_first35_skips": 8,
            "team_after35_skips": 0,
        },
        "claude-haiku-5-5": {
            "team_skips": 0, "team_n": 160, "team_correct": 147,
            "alone_skips": 0, "alone_n": 159, "alone_correct": 145,
            "fisher_nofull_p": "1",
            "mcnemar_nofull": (0, 0, 0, 159),  # 159 matched (missing t0157 on alone)
            "mcnemar_nofull_p": "1",
            "acc_mcnemar": (8, 6),
            "acc_mcnemar_p": "0.79",
        },
        "gemini-3.8-flash": {
            "team_skips": 0, "team_n": 119, "team_correct": 117,
            "alone_skips": 0, "alone_n": 17, "alone_correct": 17,
            "n_matched": 17,
            "fisher_nofull_p": "1",
            "mcnemar_nofull": (0, 0, 0, 17),
            "mcnemar_nofull_p": "1",
            "acc_mcnemar": (0, 0),
            "acc_mcnemar_p": "1",
        },
    },
    "r81": {
        "gpt-oss-120b": {
            "on_skips": 15, "on_n": 696, "off_skips": 0, "off_n": 638,
            "fisher_p": "6.81e-5",
            "per_run": {
                "r81-gptoss-run1": {"on": (4, 230), "off": (0, 215)},
                "r81-gptoss-repeat-A": {"on": (5, 237), "off": (0, 210)},
                "r81-gptoss-repeat-B": {"on": (6, 229), "off": (0, 213)},
            },
        },
        "claude-haiku-5-5": {
            "on_skips": 0, "on_n": 240, "off_skips": 0, "off_n": 240,
            "fisher_p": "1",
            "acc_shared_on": 0.95,
            "acc_private_on": 0.95,
            "acc_shared_off": 0.925,
            "acc_private_off": 0.95,
        },
        "qwen3.6-27b": {
            "on_skips": 0, "on_n": 236, "off_skips": 0, "off_n": 221,
            "fisher_p": "1",
            "private_on": (0, 119),
            "private_off": (0, 120),
            "private_off_acc": 0.95,
            "shared_on_n": 117,
            "shared_off_n": 101,
        },
        "gemini-3.8-flash": {
            "on_skips": 0, "on_n": 240, "off_skips": 0, "off_n": 240,
            "fisher_p": "1",
            "all_conditions_n": 120,
            "all_conditions_acc": 1.0,
        },
    },
}


def check(name, got, expected, failures, kind="eq"):
    if kind == "p_fmt":
        ok = close_p_fmt(got, expected)
    elif kind == "num":
        ok = close_num(got, expected)
    elif kind == "tuple":
        ok = got == expected
    else:
        ok = got == expected
    status = "MATCH" if ok else "FAIL"
    if not ok:
        failures.append((name, got, expected))
    return status, ok


def main():
    if not GRADED.exists():
        print(f"missing {GRADED}", file=sys.stderr)
        return 2
    rows = load_rows()
    field = "check"
    this_field = "verification"
    failures = []
    lines = []

    def emit(s=""):
        lines.append(s)
        print(s)

    emit(f"graded.jsonl rows: {len(rows)}")
    emit(f"Primary field for published numbers: {field}")
    emit(f"This-turn field: {this_field}")
    emit()

    # ----- R9.1 -----
    emit("=" * 72)
    emit("R9.1 team vs alone (no-full = check != full)")
    emit("=" * 72)
    r91_models = [
        ("gpt-oss-120b", "gpt-oss-120b"),
        ("qwen3.6-27b", "Qwen 3.6 27B"),
        ("claude-haiku-5-5", "Claude Haiku 5.5"),
        ("gemini-3.8-flash", "Gemini 3.8 Flash (partial)"),
    ]
    for mid, label in r91_models:
        team = subset(rows, experiment="R9.1", model_id=mid, condition="team")
        alone = subset(rows, experiment="R9.1", model_id=mid, condition="alone")
        tstat = skip_n(team, field)
        astat = skip_n(alone, field)
        matched = match_team_alone(team, alone, field)
        pub = PUBLISHED["r91"][mid]
        emit()
        emit(f"## {label}")
        emit(f"  team no-full {tstat['frac']}  acc {tstat['acc_frac']} ({tstat['acc_pct']:.1f}%)")
        emit(f"  alone no-full {astat['frac']}  acc {astat['acc_frac']} ({astat['acc_pct']:.1f}%)")
        emit(f"  checks alone: full {astat['full']} / summary_only {astat['summary_only']} / none {astat['none']}")
        emit(f"  Fisher no-full {matched['fisher']['p_fmt']}  odds {matched['fisher']['odds_fmt']}")
        sm = matched["skip_mcnemar"]
        emit(f"  McNemar no-full matched={matched['n_matched']}  "
             f"{sm['both_skip']}/{sm['team_only']}/{sm['alone_only']}/{sm['neither']}  p={sm['p_fmt']}")
        am = matched["accuracy_mcnemar"]
        emit(f"  McNemar accuracy  team-right-alone-wrong {am['team_right_alone_wrong']}  "
             f"alone-right-team-wrong {am['alone_right_team_wrong']}  p={am['p_fmt']}")
        emit(f"  case_id mismatches on matched tickets: {matched['case_id_mismatches']}")

        for name, got, exp, kind in [
            ("team_skips", tstat["skips"], pub["team_skips"], "eq"),
            ("team_n", tstat["n"], pub["team_n"], "eq"),
            ("team_correct", tstat["correct"], pub["team_correct"], "eq"),
            ("alone_skips", astat["skips"], pub["alone_skips"], "eq"),
            ("alone_n", astat["n"], pub["alone_n"], "eq"),
            ("alone_correct", astat["correct"], pub["alone_correct"], "eq"),
            ("fisher_nofull_p", matched["fisher"]["p_fmt"], pub["fisher_nofull_p"], "p_fmt"),
        ]:
            status, _ = check(f"R9.1 {mid} {name}", got, exp, failures, kind)
            if status != "MATCH":
                emit(f"  ** {status}: {name} got {got} expected {exp}")

        if "alone_none" in pub:
            status, _ = check(f"R9.1 {mid} alone_none", astat["none"], pub["alone_none"], failures)
            status2, _ = check(f"R9.1 {mid} alone_summary", astat["summary_only"], pub["alone_summary"], failures)
            if status != "MATCH" or status2 != "MATCH":
                emit(f"  ** FAIL none/summary got {astat['none']}/{astat['summary_only']} "
                     f"expected {pub['alone_none']}/{pub['alone_summary']}")

        if "mcnemar_nofull" in pub:
            got_t = (sm["both_skip"], sm["team_only"], sm["alone_only"], sm["neither"])
            # Haiku: published text said "0 discordant" and 159 alone decisions; matched should be 159
            check(f"R9.1 {mid} mcnemar_nofull_table", got_t, pub["mcnemar_nofull"], failures, "tuple")
            check(f"R9.1 {mid} mcnemar_nofull_p", sm["p_fmt"], pub["mcnemar_nofull_p"], failures, "p_fmt")
        if "acc_mcnemar" in pub:
            got_t = (am["team_right_alone_wrong"], am["alone_right_team_wrong"])
            check(f"R9.1 {mid} acc_mcnemar_table", got_t, pub["acc_mcnemar"], failures, "tuple")
            check(f"R9.1 {mid} acc_mcnemar_p", am["p_fmt"], pub["acc_mcnemar_p"], failures, "p_fmt")
        if "n_matched" in pub:
            check(f"R9.1 {mid} n_matched", matched["n_matched"], pub["n_matched"], failures)
        if "fisher_odds" in pub:
            check(f"R9.1 {mid} fisher_odds", matched["fisher"]["odds_fmt"], pub["fisher_odds"], failures)
        if "fisher_none_p" in pub:
            t_none = none_only_rows(team, field)
            a_none = none_only_rows(alone, field)
            m_none = match_team_alone(t_none, a_none, "_none_field")
            check(f"R9.1 {mid} fisher_none_p", m_none["fisher"]["p_fmt"], pub["fisher_none_p"], failures, "p_fmt")
            if "mcnemar_none" in pub:
                sn = m_none["skip_mcnemar"]
                got_t = (sn["both_skip"], sn["team_only"], sn["alone_only"], sn["neither"])
                check(f"R9.1 {mid} mcnemar_none_table", got_t, pub["mcnemar_none"], failures, "tuple")
                check(f"R9.1 {mid} mcnemar_none_p", sn["p_fmt"], pub["mcnemar_none_p"], failures, "p_fmt")
        if "team_errors" in pub:
            errors = [r for r in team if not r["correct"]]
            esc = sum(1 for r in errors if (r.get("error_type") or "").startswith("escalate_should_"))
            # error_type is escalate_should_waive etc. Also count by reconstructing from type.
            # Fallback: if error_type missing, cannot count.
            check(f"R9.1 {mid} team_errors", len(errors), pub["team_errors"], failures)
            check(f"R9.1 {mid} team_escalate_errors", esc, pub["team_escalate_errors"], failures)
            emit(f"  team errors {len(errors)}, of which escalate {esc}")
        if "team_first35_skips" in pub:
            def tid_num(r):
                tid = r.get("ticket_id") or ""
                return int(tid[1:]) if tid.startswith("t") and tid[1:].isdigit() else None
            first = [r for r in team if (tid_num(r) or 9999) <= 35]
            after = [r for r in team if (tid_num(r) or 0) >= 36]
            fs, fn = skip_n(first, field)["skips"], len(first)
            as_, an = skip_n(after, field)["skips"], len(after)
            check(f"R9.1 {mid} team_first35_skips", fs, pub["team_first35_skips"], failures)
            check(f"R9.1 {mid} team_after35_skips", as_, pub["team_after35_skips"], failures)
            emit(f"  team first 35 tickets no-full {fs}/{fn}; after {as_}/{an}")

        # this-turn comparison (diagnostic only; omitted in the lean bundle)
        if team and this_field in team[0]:
            t_this = skip_n(team, this_field)
            a_this = skip_n(alone, this_field)
            if t_this["skips"] != tstat["skips"] or a_this["skips"] != astat["skips"]:
                emit(f"  this-turn differs: team {t_this['frac']} vs check {tstat['frac']}; "
                     f"alone {a_this['frac']} vs check {astat['frac']}")

    # ----- R8.1 -----
    emit()
    emit("=" * 72)
    emit("R8.1 target ON vs OFF (no-full = check != full)")
    emit("=" * 72)
    r81_models = [
        ("gpt-oss-120b", "gpt-oss-120b"),
        ("claude-haiku-5-5", "Claude Haiku 5.5"),
        ("qwen3.6-27b", "Qwen 3.6 27B"),
        ("gemini-3.8-flash", "Gemini 3.8 Flash"),
    ]
    for mid, label in r81_models:
        on = subset(rows, experiment="R8.1", model_id=mid, target="on")
        off = subset(rows, experiment="R8.1", model_id=mid, target="off")
        on_s, off_s = skip_n(on, field), skip_n(off, field)
        oratio, p = fisher_exact_two_sided(
            on_s["skips"], on_s["n"] - on_s["skips"],
            off_s["skips"], off_s["n"] - off_s["skips"],
        )
        pub = PUBLISHED["r81"][mid]
        emit()
        emit(f"## {label}")
        emit(f"  ON  {on_s['frac']}    OFF  {off_s['frac']}    Fisher {fmt_p(p)}")
        for name, got, exp in [
            ("on_skips", on_s["skips"], pub["on_skips"]),
            ("on_n", on_s["n"], pub["on_n"]),
            ("off_skips", off_s["skips"], pub["off_skips"]),
            ("off_n", off_s["n"], pub["off_n"]),
        ]:
            status, _ = check(f"R8.1 {mid} {name}", got, exp, failures)
            if status != "MATCH":
                emit(f"  ** {status}: {name} got {got} expected {exp}")
        check(f"R8.1 {mid} fisher_p", fmt_p(p), pub["fisher_p"], failures, "p_fmt")

        # this-turn (diagnostic only; omitted in the lean bundle)
        if on and this_field in on[0]:
            on_t, off_t = skip_n(on, this_field), skip_n(off, this_field)
            if on_t["skips"] != on_s["skips"] or off_t["skips"] != off_s["skips"]:
                _, p_this = fisher_exact_two_sided(
                    on_t["skips"], on_t["n"] - on_t["skips"],
                    off_t["skips"], off_t["n"] - off_t["skips"],
                )
                emit(f"  this-turn (diagnostic, not used for pass/fail): ON {on_t['frac']}  OFF {off_t['frac']}  Fisher {fmt_p(p_this)}")

        if "per_run" in pub:
            for run_id, exp in pub["per_run"].items():
                for side, key in (("on", "on"), ("off", "off")):
                    chunk = subset(on if side == "on" else off, run_id=run_id)
                    got = (skip_n(chunk, field)["skips"], len(chunk))
                    check(f"R8.1 {mid} {run_id} {side}", got, exp[side], failures, "tuple")
                    emit(f"  {run_id} {side}: {got[0]}/{got[1]}  (published {exp[side][0]}/{exp[side][1]})")

        if "acc_shared_on" in pub:
            for cond, key in [
                ("shared_target_on", "acc_shared_on"),
                ("private_target_on", "acc_private_on"),
                ("shared_target_off", "acc_shared_off"),
                ("private_target_off", "acc_private_off"),
            ]:
                chunk = subset(rows, experiment="R8.1", model_id=mid, condition=cond)
                acc = skip_n(chunk, field)["accuracy"]
                check(f"R8.1 {mid} {cond} acc", acc, pub[key], failures, "num")
                emit(f"  {cond} acc {acc*100:.1f}%  n={len(chunk)}")

        if "private_on" in pub:
            for cond, key in [("private_target_on", "private_on"), ("private_target_off", "private_off")]:
                chunk = subset(rows, experiment="R8.1", model_id=mid, condition=cond)
                got = (skip_n(chunk, field)["skips"], len(chunk))
                check(f"R8.1 {mid} {cond}", got, pub[key], failures, "tuple")
                emit(f"  {cond}: {got[0]}/{got[1]}")
            poff = subset(rows, experiment="R8.1", model_id=mid, condition="private_target_off")
            acc = skip_n(poff, field)["accuracy"]
            check(f"R8.1 {mid} private_off_acc", acc, pub["private_off_acc"], failures, "num")
            son = subset(rows, experiment="R8.1", model_id=mid, condition="shared_target_on")
            soff = subset(rows, experiment="R8.1", model_id=mid, condition="shared_target_off")
            check(f"R8.1 {mid} shared_on_n", len(son), pub["shared_on_n"], failures)
            check(f"R8.1 {mid} shared_off_n", len(soff), pub["shared_off_n"], failures)
            emit(f"  shared_on n={len(son)}  shared_off n={len(soff)}  private_off acc {acc*100:.1f}%")

        if "all_conditions_acc" in pub:
            for cond in ["shared_target_on", "shared_target_off", "private_target_on", "private_target_off"]:
                chunk = subset(rows, experiment="R8.1", model_id=mid, condition=cond)
                st = skip_n(chunk, field)
                check(f"R8.1 {mid} {cond} n", st["n"], pub["all_conditions_n"], failures)
                check(f"R8.1 {mid} {cond} acc", st["accuracy"], pub["all_conditions_acc"], failures, "num")
                emit(f"  {cond}: skips {st['frac']} acc {st['acc_pct']:.1f}%")

    # ----- Cannot derive from graded.jsonl -----
    emit()
    emit("=" * 72)
    emit("Not derivable from graded.jsonl alone")
    emit("=" * 72)
    emit("  Gemini OpenRouter 402 counts (41 team turns, 143 alone turns) live in runs.json")
    emit("  and the transcripts, not in graded decision rows.")
    emit("  Run costs, stop reasons, planned-vs-completed, and manifest SHAs are in runs.json.")
    emit("  R8.1 rows have case_id but no ticket_id (the earlier harness did not log one).")

    emit()
    emit("=" * 72)
    if failures:
        emit(f"RESULT: FAIL  {len(failures)} mismatch(es) vs corrected baselines")
        for name, got, exp in failures:
            emit(f"  - {name}: got {got!r}  expected {exp!r}")
        report = {"result": "FAIL", "n_failures": len(failures),
                  "failures": [{"name": n, "got": g, "expected": e} for n, g, e in failures]}
        rc = 1
    else:
        emit("RESULT: PASS  every expected number recomputed from check matches the corrected baselines")
        report = {"result": "PASS", "n_failures": 0, "failures": []}
        rc = 0
    (HERE / "match_report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    return rc


if __name__ == "__main__":
    sys.exit(main())
