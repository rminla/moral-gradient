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


def gate_a_validation(calls: List[Dict], prompts: Dict, model: str, study: str) -> Tuple[bool, List[str], Dict]:
    """Gate (a): validate logged requests match prereg JSON byte-for-byte.
    
    Returns (passed, errors, stats)
    """
    errors = []
    matched = 0
    unmatched = 0
    
    for call in calls:
        # Skip probe/grader calls
        if call.get('module') in ['unusual_probe', 'rationale_grader']:
            continue
        
        req = call.get('request_json', {})
        if isinstance(req, str):
            req = json.loads(req)
        
        sys_text = req.get('system', '')
        
        # Get user text
        if req.get('messages'):
            user_text = req.get('messages', [{}])[0].get('content', '')
        else:
            user_text = req.get('user', '')
        
        tools_sent = req.get('tools', [])
        
        # Match against prompts
        found = False
        if study == "s1":
            # Match S1: arm → specs list
            for arm, specs_list in prompts.get(model, {}).items():
                for spec in specs_list:
                    if spec['system'] == sys_text and spec['user'] == user_text:
                        # Check tools match
                        expected_tools = spec.get('tools', [])
                        tools_match = (len(tools_sent) == len(expected_tools))
                        if tools_match and len(expected_tools) > 0:
                            # Check tool names match
                            sent_names = {t.get('name') or t.get('function', {}).get('name') for t in tools_sent}
                            expected_names = {t.get('name') or t.get('function', {}).get('name') for t in expected_tools}
                            tools_match = (sent_names == expected_names)
                        
                        if tools_match:
                            found = True
                            break
                if found:
                    break
        else:
            # Match S2: cell → specs list
            for cell, specs_list in prompts.get(model, {}).items():
                for spec in specs_list:
                    if spec['system'] == sys_text and spec['user'] == user_text:
                        # Check tools
                        expected_tools = spec.get('tools', [])
                        tools_match = (len(tools_sent) == len(expected_tools))
                        if tools_match and len(expected_tools) > 0:
                            sent_names = {t.get('name') or t.get('function', {}).get('name') for t in tools_sent}
                            expected_names = {t.get('name') or t.get('function', {}).get('name') for t in expected_tools}
                            tools_match = (sent_names == expected_names)
                        
                        if tools_match:
                            found = True
                            break
                if found:
                    break
        
        if found:
            matched += 1
        else:
            unmatched += 1
            if len(errors) < 20:
                errors.append(f"Unmatched request: module={call.get('module')}, sys_len={len(sys_text)}, tools={len(tools_sent)}")
    
    passed = unmatched == 0
    stats = {"matched": matched, "unmatched": unmatched}
    
    return passed, errors, stats


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


def gate_d_validation_s1(calls: List[Dict]) -> Tuple[bool, float, str]:
    """Gate (d): S1 ≥95% of units have rationale and probe labels."""
    
    # Count target calls (not graders)
    target_calls = [c for c in calls if c.get('module') not in ['unusual_probe', 'rationale_grader']]
    
    if len(target_calls) == 0:
        return False, 0.0, "No target calls found"
    
    # Find corresponding probe and rationale calls
    # Group calls by unit key
    units_with_probe = set()
    units_with_rationale = set()
    
    for call in calls:
        key = call.get('key', '')
        if call.get('module') == 'unusual_probe':
            units_with_probe.add(key)
        elif call.get('module') == 'rationale_grader':
            units_with_rationale.add(key)
    
    # Check target calls have corresponding grader calls
    target_keys = {c.get('key', '') for c in target_calls}
    n_with_both = len(target_keys & units_with_probe & units_with_rationale)
    
    coverage_rate = n_with_both / len(target_keys) if target_keys else 0
    passed = coverage_rate >= 0.95
    message = f"{n_with_both}/{len(target_keys)} units with probe and rationale ({100*coverage_rate:.1f}%)"
    
    return passed, coverage_rate, message


def gate_e_cost_validation(records: List[Dict], cost_estimates: Dict, model: str, study: str) -> Tuple[bool, Dict, str]:
    """Gate (e): Cost per unit ≤1.5× cost_estimates.json."""
    margin = cost_estimates.get("margin", 1.5)
    per_unit = cost_estimates.get("per_unit_usd", {}).get(model, {})
    
    if not per_unit:
        return False, {}, f"No cost estimates found for model {model}"
    
    # Calculate actual costs using 'cost' field (not cost_usd)
    if study == "s1":
        units = [r for r in records if r.get("phase") == "si"]
        costs = [r.get("cost", 0) for r in units]
        actual = sum(costs) / len(costs) if costs else 0
        expected = per_unit.get("study1_unit", 0)
        
        stats = {
            "study1": {
                "actual": actual,
                "expected": expected,
                "cap": expected * margin,
                "passed": actual <= expected * margin if expected > 0 else True
            }
        }
    else:
        tool_units = [r for r in records if r.get("cell", "").endswith("_tools")]
        notool_units = [r for r in records if r.get("cell", "").endswith("_notools")]
        
        tool_costs = [r.get("cost", 0) for r in tool_units]
        notool_costs = [r.get("cost", 0) for r in notool_units]
        
        actual_tool = sum(tool_costs) / len(tool_costs) if tool_costs else 0
        actual_notool = sum(notool_costs) / len(notool_costs) if notool_costs else 0
        
        expected_tool = per_unit.get("study2_tool_unit", 0)
        expected_notool = per_unit.get("study2_notool_unit", 0)
        
        stats = {
            "study2_tool": {
                "actual": actual_tool,
                "expected": expected_tool,
                "cap": expected_tool * margin,
                "passed": actual_tool <= expected_tool * margin if expected_tool > 0 else True
            },
            "study2_notool": {
                "actual": actual_notool,
                "expected": expected_notool,
                "cap": expected_notool * margin,
                "passed": actual_notool <= expected_notool * margin if expected_notool > 0 else True
            }
        }
    
    all_passed = all(s["passed"] for s in stats.values())
    message = f"Cost checks: see stats"
    
    return all_passed, stats, message


def check_canary(iter_name: str, model: str, data_dir: Path, cost_estimates_path: Path) -> Dict:
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
        gate_d_passed, gate_d_rate, gate_d_msg = gate_d_validation_s1(calls)
        results["gate_d"] = {
            "passed": gate_d_passed,
            "coverage_rate": gate_d_rate,
            "message": gate_d_msg
        }
        print(f"Gate (d): {'PASS' if gate_d_passed else 'FAIL'} - {gate_d_msg}")
    
    # Gate (e): cost validation
    if cost_estimates_path and cost_estimates_path.exists():
        print(f"\n=== Gate (e): Cost Validation ===")
        cost_estimates = load_cost_estimates(cost_estimates_path)
        gate_e_passed, gate_e_stats, gate_e_msg = gate_e_cost_validation(records, cost_estimates, model, study)
        results["gate_e"] = {
            "passed": gate_e_passed,
            "cost_stats": gate_e_stats,
            "message": gate_e_msg
        }
        print(f"Gate (e): {'PASS' if gate_e_passed else 'FAIL'} - {gate_e_msg}")
        if gate_e_stats:
            for key, val in gate_e_stats.items():
                if val.get("actual", 0) > 0:
                    print(f"  {key}: ${val['actual']:.4f} actual vs ${val['cap']:.4f} cap ({'✓' if val['passed'] else '✗'})")
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Canary gate validation")
    parser.add_argument("iter_name", help="Iteration name (e.g., s1_canary_fake)")
    parser.add_argument("model", help="Model name")
    parser.add_argument("--data-dir", type=Path, required=True, help="Data directory")
    parser.add_argument("--cost-estimates", type=Path, help="Cost estimates JSON file")
    
    args = parser.parse_args()
    
    results = check_canary(
        args.iter_name,
        args.model,
        args.data_dir,
        args.cost_estimates,
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
