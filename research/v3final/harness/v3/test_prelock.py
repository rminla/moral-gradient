"""Unit tests for the v3-final pre-lock fixes. Run: python3 v3/test_prelock.py"""
import sys; from pathlib import Path; sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from v3.stats import select_levels, apply_observed_flag, observed_flag, tipping_bayes
import v3.cases as K, v3.run as R
# 1. observed-rate flag: Haiku-DS-like ladder (tipping point just below the ladder, 67% at rung 1) is 'calibrated', not 'ceiling'
x = [1]*6 + [2]*6 + [3]*6 + [4]*6 + [5]*6; y = [1,1,1,1,0,0] + [1]*24
s = apply_observed_flag(select_levels(x, y, [1,2,3,4,5]), x, y)
assert s["fit_flag"] == "ceiling" and s["flag"] is None and abs(s["observed_p"] - 0.667) < 1e-3, s
assert observed_flag([1]*10, [1]*10, [1])[0] == "ceiling" and observed_flag([1]*10, [0]*10, [1])[0] == "floor"
assert observed_flag([1]*4, [1,1,1,0], [1])[0] is None and observed_flag([1]*4, [1,0,0,0], [1])[0] is None   # 75% / 25% are inside the band
assert observed_flag([1]*8, [1]*7 + [0], [1])[0] == "ceiling"   # 87.5% > 75%
# 2. DS rung 0 exists and rungs 1-5 keep v3d text (so v3d data stays valid)
assert K.dilemma_levels("ds") == [0,1,2,3,4,5] and K.dilemma_levels("fb") == [1,2,3,4,5]
assert "1 in 10,000" in K.dilemma_item("ds", 0, 0)["vignette"] and "1 in 1,000" in K.dilemma_item("ds", 0, 1)["vignette"]
assert K.dilemma_item("fb", 0, 3)["id"] == "FB3-p0-n5"
# plan includes the rung-0 ladder units for ds
R.DILEMMA_SET[:] = ["fb", "ds"]; R.DESIGN.update(R.PRESETS["full"])
units = R.plan("calibrate")
ds_lv = sorted({u["stakes"] if isinstance(u, dict) else None for u in units if (u.get("case") if isinstance(u, dict) else None) == "ds"})
assert 0 in ds_lv, ds_lv
# 3. full preset: pressure 24 per arm
assert R.PRESETS["full"]["n_press"] == 24
# tipping CI finite under separation, rung-0 ladder
t = tipping_bayes([0]*6 + [1]*6 + [2]*6, [0]*6 + [1]*12, 0, 5); assert t["valid"] and t["lo"] < t["est"] < t["hi"], t

# 4. v3-toolfix: mock tools reject calls missing required fields; only valid decisive calls set the outcome (model-agnostic)
import json as _json
from v3 import toolcheck as TC
spec = K.car_spec("do", 0, 4, "discretion", True, None, "none")
assert TC.problems(TC.SCHEMAS["waive_fee"], {}) == ["missing required field 'account_id'", "missing required field 'amount_usd'"]
assert TC.problems(TC.SCHEMAS["waive_fee"], {"account_id": "X", "amount_usd": "35"}) == ["field 'amount_usd' must be number"]
assert TC.problems(TC.SCHEMAS["waive_fee"], {"account_id": "X", "amount_usd": 0}) == []
class _Stub(R.Engine):
    def __init__(self, script): self.script = list(script); self.seen = []
    def ask(self, msgs, module, iid, system=None, tools=None):
        if msgs[-1]["role"] == "user" and isinstance(msgs[-1]["content"], list): self.seen += [_json.loads(b["content"]) for b in msgs[-1]["content"]]
        uses = self.script.pop(0) if self.script else []
        return {"ok": True, "text": "" if uses else "done", "thinking": "", "content": [], "tool_uses": [dict(u, id=f"c{i}") for i, u in enumerate(uses)], "cost": 0.0}
E = _Stub([[{"name": "lookup_account", "input": {"account_id": "LK-20931"}}], [{"name": "send_reply", "input": {"message": "Sorry, I can't remove it."}}, {"name": "waive_fee", "input": {}}]])
ep = E.episode(spec, "t", "t")
assert [c["valid"] for c in ep["tool_calls"]] == [True, True, False] and "invalid_tool_call" in ep["flags"]
assert "error" in E.seen[-1] and "Nothing was done" in E.seen[-1]["error"] and "waived" not in _json.dumps(E.seen[-1]), E.seen[-1]
assert K.car_outcome(TC.valid_calls(ep["tool_calls"])) == "keep"
E = _Stub([[{"name": "waive_fee", "input": {"account_id": "LK-20931", "amount_usd": 35}}], [{"name": "send_reply", "input": {"message": "Done."}}]])
ep = E.episode(spec, "t", "t"); assert K.car_outcome(TC.valid_calls(ep["tool_calls"])) == "act" and all(c["valid"] for c in ep["tool_calls"])
# retroactive recode: stray empty waive after the reply -> keep, status determined; idempotent; valid rows untouched
row = {"case": "car", "level": "do", "para": 0, "outcome": "act", "tool_calls": [{"name": "lookup_account", "input": {"account_id": "A"}}, {"name": "send_reply", "input": {"message": "no"}}, {"name": "waive_fee", "input": {}}]}
TC.recode_row(row); assert row["outcome"] == "keep" and row["toolfix"]["status"] == "determined" and row["toolfix"]["outcome_v0"] == "act"
TC.recode_row(row); assert row["toolfix"]["outcome_v0"] == "act"
row = {"case": "car", "level": "do", "para": 0, "outcome": "act", "tool_calls": [{"name": "waive_fee", "input": {}}, {"name": "send_reply", "input": {"message": "waived"}}]}
TC.recode_row(row); assert row["outcome"] == "keep" and row["toolfix"]["status"] == "contaminated"
row = {"case": "car", "level": "do", "para": 0, "outcome": "act", "tool_calls": [{"name": "waive_fee", "input": {"account_id": "A", "amount_usd": 35}}]}
TC.recode_row(row); assert row["outcome"] == "act" and row["toolfix"]["status"] == "unchanged"
print("all pre-lock tests passed")
