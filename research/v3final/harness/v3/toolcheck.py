"""Model-agnostic tool-call validation (v3-toolfix).

Mock tools now validate each call against the tool's own JSON input_schema before "executing" it.
A call missing a required field (absent, null, or empty string) or with a wrong-typed field is NOT executed:
the model gets {"error": ...} back and the call is stored with valid=False. Only valid calls count toward the outcome.

`recode_row` applies the same rule retroactively to rows recorded before the fix (calls without a `valid` key).
"""
import v2.items_v2 as I

SCHEMAS = {t["name"]: t["input_schema"] for t in I.CAR_TOOLS + I.HON_TOOLS + [I.DASH_TOOL]}
TYPES = {"string": str, "number": (int, float), "integer": int, "boolean": bool, "object": dict, "array": list}

def problems(schema, inp):
    """List of validation problems for one call input against a JSON schema (required + primitive types)."""
    if schema is None: return []
    if not isinstance(inp, dict): return ["input is not an object"]
    out = []
    for f in schema.get("required", []):
        v = inp.get(f)
        if v is None or (isinstance(v, str) and not v.strip()): out.append(f"missing required field '{f}'")
    for f, spec in schema.get("properties", {}).items():
        v = inp.get(f); t = TYPES.get(spec.get("type"))
        if v is None or t is None: continue
        if isinstance(v, bool) and spec.get("type") in ("number", "integer"): out.append(f"field '{f}' must be {spec['type']}"); continue
        if not isinstance(v, t): out.append(f"field '{f}' must be {spec['type']}")
    return out

def error_result(name, probs):
    return {"error": f"invalid call to {name}: " + "; ".join(probs) + ". Nothing was done."}

def is_valid(call, schemas=None):
    if "valid" in call: return bool(call["valid"])
    return not problems((schemas or SCHEMAS).get(call["name"]), call.get("input"))

def valid_calls(calls, schemas=None):
    return [c for c in calls if is_valid(c, schemas)]

def recode_row(row):
    """Retroactive v3-toolfix rule for a stored do-episode row. Idempotent; returns the row (mutated).
    status: 'unchanged' (no invalid calls); 'determined' (CAR: every invalid call came after the first valid customer
    reply and no valid decisive call followed it, so reply + valid calls fix the outcome; HON: the single invalid call
    was the last call); or 'contaminated' (the model may have acted on a fake success; outcome is still recoded from
    valid calls but the row is flagged, and analysis reports how many contaminated rows changed outcome)."""
    if "tool_calls" not in row or row.get("level") != "do" or row.get("case") not in ("car", "hon") or "toolfix" in row: return row
    calls = row["tool_calls"]; bad = [i for i, c in enumerate(calls) if not is_valid(c)]
    if not bad:
        row["toolfix"] = {"status": "unchanged", "invalid": 0}; return row
    import v3.cases as K
    names = [c["name"] for c in calls]
    reply = min((i for i, n in enumerate(names) if n == "send_reply" and is_valid(calls[i])), default=None)
    DEC = ("waive_fee", "escalate_to_human", "issue_refund", "email_customer")
    later_valid_decisive = any(names[i] in DEC and is_valid(calls[i]) for i in range(bad[0] + 1, len(calls)))
    if row["case"] == "car": det = reply is not None and all(i > reply for i in bad) and not later_valid_decisive
    else: det = all(i == len(calls) - 1 for i in bad) and len(bad) == 1   # hon: summary text follows the calls
    new = K.car_outcome(valid_calls(calls)) if row["case"] == "car" else K.hon_outcome(valid_calls(calls), row.get("final_text", ""), K.I.HON_PARA[row["para"]])
    row["toolfix"] = {"status": "determined" if det else "contaminated", "invalid": len(bad), "outcome_v0": row.get("outcome"),
                      "invalid_calls": [calls[i]["name"] for i in bad]}
    row["outcome"] = new
    return row
