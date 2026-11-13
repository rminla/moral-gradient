#!/usr/bin/env python3
"""Canary gate validation for preregistered studies.

Gates:
(a) Every logged request matches JSON spec byte-for-byte
(b) ≥95% of units coded without error
(c) S2: per-model unparsed ≤10% in no-tools cells
(d) S1: ≥95% of units have rationale and probe labels
(e) Cost per unit ≤1.5× cost_estimates.json

Usage:
    python canary_check.py s1_canary_fake claude-haiku-5.5 \
        --data-dir research/v3final/harness/run_s1_canary_fake_main/data/v3 \
        --cost-estimates research/prereg/cost_estimates.json
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple


def load_harness_output(data_file: Path) -> List[Dict]:
    """Load harness output JSONL."""
    records = []
    with open(data_file) as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    return records


def load_calls_jsonl(calls_file: Path) -> List[Dict]:
    """Load calls.jsonl."""
    calls = []
    with open(calls_file) as f:
        for line in f:
            if line.strip():
                calls.append(json.loads(line))
    return calls


def load_prompts_json(prompts_file: Path) -> Dict:
    """Load prompts JSON (study1 or study2)."""
    with open(prompts_file) as f:
        return json.load(f)


def load_cost_estimates(cost_file: Path) -> Dict:
    """Load cost estimates JSON."""
    with open(cost_file) as f:
        return json.load(f)


TARGET_MODULES = {"v3_car_do", "car_role", "car_role_notool"}


def _req_system_user(req):
    """System and first user turn from an Anthropic- or OpenAI-format logged request."""
    msgs = req.get("messages", []) or []
    sys_text = req.get("system")
    if isinstance(sys_text, list):
        sys_text = "".join(b.get("text", "") for b in sys_text if isinstance(b, dict))
    if sys_text is None:
        sys_text = next((m.get("content") for m in msgs if m.get("role") == "system"), "")
    user = next((m.get("content") for m in msgs if m.get("role") == "user"), "")
    if isinstance(user, list):
        user = "".join(b.get("text", "") for b in user if isinstance(b, dict) and b.get("type") == "text")
    return sys_text or "", user or ""


def _tool_names(tools):
    return sorted((t.get("name") or t.get("function", {}).get("name")) for t in (tools or []))


def gate_a_validation(calls: List[Dict], prompts: Dict, model: str, study: str) -> Tuple[bool, List[str], Dict]:
    """Gate (a): every logged TARGET request matches a prereg spec byte-for-byte
    (system, first user turn, tool names; no-tools specs must send no tools)."""
    specs = prompts.get("specs", prompts).get(model, {})
    index = {}
    for arm, specs_list in specs.items():
        for spec in specs_list:
            index[(spec["system"], spec["user"])] = (arm, _tool_names(spec.get("tools")))
    errors, matched, unmatched, per_arm = [], 0, 0, {}
    for call in calls:
        if not str(call.get("role", "")).startswith("target") or call.get("module") not in TARGET_MODULES:
            continue
        req = call.get("request_json") or {}
        if isinstance(req, str):
            req = json.loads(req)
        sys_text, user_text = _req_system_user(req)
        hit = index.get((sys_text, user_text))
        if hit and _tool_names(req.get("tools")) == hit[1]:
            matched += 1
            per_arm[hit[0]] = per_arm.get(hit[0], 0) + 1
        else:
            unmatched += 1
            if len(errors) < 20:
                why = "no prereg spec with this system+user" if not hit else f"tools {_tool_names(req.get('tools'))} != {hit[1]}"
                errors.append(f"Unmatched {call.get('module')} call {call.get('call_id')}: {why}")
    passed = unmatched == 0 and matched > 0
    return passed, errors, {"matched": matched, "unmatched": unmatched, "per_arm_or_cell": per_arm}


def gate_b_validation(records: List[Dict]) -> Tuple[bool, float, str]:
    """Gate (b): ≥95% of units coded without error."""
    if len(records) == 0:
        return False, 0.0, "No records found"
    
    n_errors = sum(1 for r in records if r.get("error"))
    n_total = len(records)
    success_rate = (n_total - n_errors) / n_total
    
    passed = success_rate >= 0.95
    message = f"{n_total - n_errors}/{n_total} success ({100*success_rate:.1f}%)"
    
    return passed, success_rate, message


def gate_c_validation_s2(records: List[Dict]) -> Tuple[bool, Dict, str]:
    """Gate (c): S2 per-model unparsed ≤10% in no-tools cells."""
    per_cell = {}
    
    for r in records:
        cell = r.get("cell", "")
        unparsed = r.get("unparsed", False)
        
        if "notools" not in cell:
            continue
        
        if cell not in per_cell:
            per_cell[cell] = {"total": 0, "unparsed": 0}
        
        per_cell[cell]["total"] += 1
        if unparsed:
            per_cell[cell]["unparsed"] += 1
    
    failed_cells = []
    for cell, stats in per_cell.items():
        rate = stats["unparsed"] / stats["total"] if stats["total"] > 0 else 0
        if rate > 0.10:
            failed_cells.append((cell, rate, stats))
    
    passed = len(failed_cells) == 0
    message = f"No-tools cells: {per_cell}"
    
    if failed_cells:
        message = f"Failed: {failed_cells}"
    
    return passed, per_cell, message


def gate_d_validation_s1(records: List[Dict]) -> Tuple[bool, float, str]:
    """Gate (d): >=95% of S1 units have a rationale label and an unusual-probe label from graders."""
    units = [r for r in records if r.get("phase") == "si" and not r.get("error")]
    if not units:
        return False, 0.0, "No S1 units found"
    def labelled(d):
        return isinstance(d, dict) and any(v for v in d.values())
    ok = sum(1 for r in units if labelled(r.get("rationale"))
             and isinstance(r.get("unusual_probe"), dict) and labelled(r["unusual_probe"].get("codes")))
    rate = ok / len(units)
    return rate >= 0.95, rate, f"{ok}/{len(units)} units with rationale and probe labels ({100*rate:.1f}%)"


def gate_e_cost_validation(records: List[Dict], calls: List[Dict], cost_estimates: Dict, model: str, study: str) -> Tuple[bool, Dict, str]:
    """Gate (e): actual spend per unit for this model (ALL logged calls incl. graders/probes,
    from calls.jsonl cost_usd) <= margin x the preregistered per-unit estimate."""
    margin = cost_estimates.get("margin", 1.5)
    per_unit = cost_estimates.get("per_unit_usd", {}).get(model, {})
    if not per_unit:
        return False, {}, f"No cost estimates found for model {model}"
    units = [r for r in records if not r.get("error")]
    if not units:
        return False, {}, "No units"
    spend = sum(float(c.get("cost_usd") or 0) for c in calls)
    actual = spend / len(units)
    if study == "s1":
        expected = per_unit["study1_unit"]
    else:
        n_tool = sum(1 for r in units if str(r.get("cell", "")).endswith("_tools"))
        n_no = len(units) - n_tool
        expected = (n_tool * per_unit["study2_tool_unit"] + n_no * per_unit["study2_notool_unit"]) / len(units)
    stats = {"per_unit": {"actual": actual, "expected": expected, "cap": expected * margin,
                          "passed": actual <= expected * margin, "spend": spend, "units": len(units)}}
    return stats["per_unit"]["passed"], stats, f"${actual:.5f}/unit vs cap ${expected*margin:.5f} (spend ${spend:.4f}, {len(units)} units)"


def check_canary(iter_name: str, model: str, data_dir: Path, cost_estimates_path: Path, fake_costs_info: bool = False) -> Dict:
    """Run all canary gates."""
    results = {}
    
    # Load data
    data_file = data_dir / iter_name / model / "main.jsonl"
    calls_file = data_dir / iter_name / model / "calls.jsonl"
    
    if not data_file.exists():
        print(f"Error: Data file not found: {data_file}")
        return {"error": "Data file not found"}
    
    if not calls_file.exists():
        print(f"Error: Calls file not found: {calls_file}")
        return {"error": "Calls file not found"}
    
    records = load_harness_output(data_file)
    calls = load_calls_jsonl(calls_file)
    print(f"Loaded {len(records)} records and {len(calls)} calls from {data_dir}")
    
    # Detect study type
    study = "s1" if any(r.get("phase") == "si" for r in records) else "s2"
    print(f"Detected study: {study}")
    
    # Load prompts
    prompts_file = Path(f"research/v3/prompts_study{study[1]}.json")
    if not prompts_file.exists():
        print(f"Error: Prompts file not found: {prompts_file}")
        return {"error": "Prompts file not found"}
    
    import hashlib
    PREREG_SHA = {"1": "522422ac87b3908ba37d28271433ae91b3e72bcda67f202278afcb80d398d9c1",
                  "2": "2fa4403cac3ce81cfd7a52f81353959fec2c8efb7284100fe8fba9fe55b58c9f"}
    if hashlib.sha256(prompts_file.read_bytes()).hexdigest() != PREREG_SHA[study[1]]:
        print(f"Error: {prompts_file} sha256 does not match the preregistered hash")
        return {"error": "prompts sha256 mismatch"}
    prompts = load_prompts_json(prompts_file)
    
    # Gate (a): request validation
    print(f"\n=== Gate (a): Logged Requests Match Prereg JSON ===")
    gate_a_passed, gate_a_errors, gate_a_stats = gate_a_validation(calls, prompts, model, study)
    results["gate_a"] = {
        "passed": gate_a_passed,
        "errors": gate_a_errors[:20],
        "stats": gate_a_stats
    }
    
    print(f"Gate (a): {'PASS' if gate_a_passed else 'FAIL'}")
    print(f"  Stats: {gate_a_stats}")
    if not gate_a_passed:
        print(f"  {len(gate_a_errors)} errors (showing first 20):")
        for err in gate_a_errors[:20]:
            print(f"    - {err}")
    
    # Gate (b): error rate
    print(f"\n=== Gate (b): Error Rate ===")
    gate_b_passed, gate_b_rate, gate_b_msg = gate_b_validation(records)
    results["gate_b"] = {
        "passed": gate_b_passed,
        "success_rate": gate_b_rate,
        "message": gate_b_msg
    }
    print(f"Gate (b): {'PASS' if gate_b_passed else 'FAIL'} - {gate_b_msg}")
    
    # Gate (c): S2 unparsed in no-tools
    if study == "s2":
        print(f"\n=== Gate (c): S2 No-Tools Unparsed ===")
        gate_c_passed, gate_c_stats, gate_c_msg = gate_c_validation_s2(records)
        results["gate_c"] = {
            "passed": gate_c_passed,
            "stats": gate_c_stats,
            "message": gate_c_msg
        }
        print(f"Gate (c): {'PASS' if gate_c_passed else 'FAIL'} - {gate_c_msg}")
    
    # Gate (d): S1 grader coverage
    if study == "s1":
        print(f"\n=== Gate (d): S1 Grader Coverage ===")
        gate_d_passed, gate_d_rate, gate_d_msg = gate_d_validation_s1(records)
        results["gate_d"] = {
            "passed": gate_d_passed,
            "coverage_rate": gate_d_rate,
            "message": gate_d_msg
        }
        print(f"Gate (d): {'PASS' if gate_d_passed else 'FAIL'} - {gate_d_msg}")
    
    # Gate (e): cost validation
    if not (cost_estimates_path and cost_estimates_path.exists()):
        print(f"Gate (e): FAIL - cost estimates not found: {cost_estimates_path}")
        results["gate_e"] = {"passed": False, "message": "cost estimates missing"}
    else:
        print(f"\n=== Gate (e): Cost Validation ===")
        cost_estimates = load_cost_estimates(cost_estimates_path)
        trace_file = calls_file.parent / "trace_calls.jsonl"   # S1 reasoning-trace graders (run_traces_prereg.py)
        cost_calls = calls + (load_calls_jsonl(trace_file) if trace_file.exists() else [])
        if study == "s1" and not trace_file.exists():
            print("  note: no trace_calls.jsonl yet; run run_traces_prereg.py first so trace-grader cost is included")
        gate_e_passed, gate_e_stats, gate_e_msg = gate_e_cost_validation(records, cost_calls, cost_estimates, model, study)
        if fake_costs_info:
            gate_e_msg += " [INFO only: fake-transport token counts are synthetic, so cost is not gated]"
            gate_e_passed = True
        results["gate_e"] = {
            "passed": gate_e_passed,
            "cost_stats": gate_e_stats,
            "message": gate_e_msg
        }
        print(f"Gate (e): {'PASS' if gate_e_passed else 'FAIL'} - {gate_e_msg}")
        if gate_e_stats:
            for key, val in gate_e_stats.items():
                if True:
                    print(f"  {key}: ${val['actual']:.4f} actual vs ${val['cap']:.4f} cap ({'✓' if val['passed'] else '✗'})")
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Canary gate validation")
    parser.add_argument("iter_name", help="Iteration name (e.g., s1_canary_fake)")
    parser.add_argument("model", help="Model name")
    parser.add_argument("--data-dir", type=Path, required=True, help="Data directory")
    parser.add_argument("--cost-estimates", type=Path, default=Path(__file__).resolve().parent.parent / "v3" / "cost_estimates.json",
                        help="Preregistered cost estimates JSON (default research/v3/cost_estimates.json)")
    parser.add_argument("--fake-costs-info", action="store_true",
                        help="Fake-transport runs only: report gate (e) but do not gate on it (token counts are synthetic)")
    
    args = parser.parse_args()
    
    results = check_canary(
        args.iter_name,
        args.model,
        args.data_dir,
        args.cost_estimates,
        fake_costs_info=args.fake_costs_info,
    )
    
    if "error" in results:
        return 1
    
    # Print summary
    print("\n" + "="*60)
    print("CANARY CHECK SUMMARY")
    print("="*60)
    
    all_passed = all(gate.get("passed", False) for gate in results.values() if "passed" in gate)
    
    for gate_name, gate_result in results.items():
        if "passed" in gate_result:
            status = "✓ PASS" if gate_result.get("passed") else "✗ FAIL"
            print(f"{gate_name}: {status}")
    
    print("="*60)
    print(f"Overall: {'✓ ALL GATES PASSED' if all_passed else '✗ SOME GATES FAILED'}")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
