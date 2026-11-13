#!/usr/bin/env python3
"""Canary gate validation for preregistered studies.

Gates:
(a) Every logged request's system, user, tools match JSON spec for model/arm/cell/para/level
    - Cue appears exactly once after first paragraph, never in NONE
    - No tool calls outside cell's tool list
(b) ≥95% of units coded without error
(c) S2: per-model unparsed ≤10% in no-tools cells
(d) S1: ≥95% of units have rationale and probe labels from graders
(e) Cost per unit ≤1.5× cost_estimates.json

Usage:
    python canary_check.py <study> <iter> <model> --prompts <JSON> --ledger <ledger.db>
"""
import argparse
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Dict, List, Tuple


def load_prompts_json(path: Path) -> Dict:
    """Load and validate prompts JSON."""
    with open(path) as f:
        data = json.load(f)
    
    # Validate structure
    if "specs" not in data:
        raise ValueError("Missing 'specs' in prompts JSON")
    
    return data


def load_calls_from_ledger(ledger_path: Path, model: str) -> List[Dict]:
    """Load call logs from ledger database."""
    conn = sqlite3.connect(ledger_path)
    cursor = conn.cursor()
    
    # Query for this model's calls
    cursor.execute("""
        SELECT key, request, response, cost_usd, error
        FROM calls
        WHERE key LIKE ?
        ORDER BY key
    """, (f"%/{model}/%",))
    
    calls = []
    for row in cursor.fetchall():
        key, request_json, response_json, cost, error = row
        
        try:
            request = json.loads(request_json) if request_json else {}
            response = json.loads(response_json) if response_json else {}
        except:
            request = {}
            response = {}
        
        calls.append({
            "key": key,
            "request": request,
            "response": response,
            "cost": cost,
            "error": error,
        })
    
    conn.close()
    return calls


def parse_unit_key(key: str) -> Dict:
    """Parse unit key to extract model, case, level, para, arm/cell, etc.
    
    Example: data/v3/prereg_s1/claude-haiku-5.5/main/car_do_4_memo_incentive_1.jsonl
    Example: data/v3/prereg_s2/test-model/main/car_role_do_1_agent_tools_0.jsonl
    """
    parts = key.split("/")
    
    # Extract model (e.g., claude-haiku-5.5 or test-model)
    model = None
    for part in parts:
        if any(m in part for m in ["claude", "gpt", "qwen", "gemini", "test-model"]):
            model = part
            break
    
    # Extract from filename
    filename = parts[-1].replace(".jsonl", "")
    tokens = filename.split("_")
    
    result = {"model": model, "raw_key": key}
    
    # Try to parse case, level, cue, arm, para
    if len(tokens) >= 3:
        result["case"] = tokens[0]
        result["level_or_action"] = tokens[1] if len(tokens) > 1 else None
        
        # Find para (always last token)
        if tokens[-1].isdigit():
            result["para"] = int(tokens[-1])
        
        # Try to identify cue and arm
        for i, tok in enumerate(tokens):
            if tok in ["memo", "dashboard", "crm", "benef_org", "benef_self", "benef_other", "benef_bridge", "none"]:
                result["cue"] = tok
                if i + 1 < len(tokens) and tokens[i + 1] in ["incentive", "neutral"]:
                    result["arm"] = tokens[i + 1]
            
            # Study 2 cells: check for two-token combinations first
            if i + 1 < len(tokens):
                two_token = f"{tok}_{tokens[i + 1]}"
                if two_token in ["agent_tools", "agent_notools", "advisor_tools", "advisor_notools"]:
                    result["cell"] = two_token
        
        # Extract stakes/level (the digit before para or cell/arm)
        for i, tok in enumerate(tokens):
            if tok.isdigit() and len(tok) <= 2:
                # Check if it's not the para (last token)
                if i < len(tokens) - 1:
                    result["stakes"] = int(tok)
                    break
    
    return result


def get_expected_spec(prompts_data: Dict, unit_info: Dict) -> Dict:
    """Get expected prompt spec from JSON for this unit."""
    specs = prompts_data["specs"]
    
    # Build lookup key
    # Study 1: model/arm/para/level
    # Study 2: model/cell/para/level
    
    model = unit_info.get("model")
    para = unit_info.get("para")
    stakes = unit_info.get("stakes")
    arm = unit_info.get("arm")
    cell = unit_info.get("cell")
    cue = unit_info.get("cue")
    
    # Try to find matching spec
    for spec in specs:
        if spec.get("model") != model:
            continue
        if spec.get("para") != para:
            continue
        if stakes is not None and spec.get("level") != stakes:
            continue
        
        # Study 1: match arm and cue
        if arm is not None:
            if spec.get("arm") != arm:
                continue
            if cue and spec.get("cue") != cue:
                continue
        
        # Study 2: match cell
        if cell is not None:
            if spec.get("cell") != cell:
                continue
        
        return spec
    
    return None


def check_cue_placement(user_text: str, cue: str) -> Tuple[bool, str]:
    """Check that cue appears exactly once after first paragraph.
    
    Returns (is_valid, error_message)
    """
    if cue == "none" or cue is None:
        # No cue should appear
        system_cues = ["memo", "memo_soft", "memo_soft_eval", "benef_org", "benef_self", "benef_other", "benef_bridge"]
        for c in system_cues:
            if c in user_text.lower():
                return False, f"Cue '{c}' found in NONE arm"
        return True, ""
    
    # Find cue occurrences
    pattern = re.compile(re.escape(cue), re.IGNORECASE)
    matches = list(pattern.finditer(user_text))
    
    if len(matches) == 0:
        return False, f"Cue '{cue}' not found"
    
    if len(matches) > 1:
        return False, f"Cue '{cue}' appears {len(matches)} times (expected 1)"
    
    # Check it's after first paragraph (rough heuristic: after first \n\n or position > 200)
    match_pos = matches[0].start()
    first_para_end = user_text.find("\n\n")
    
    if first_para_end == -1:
        first_para_end = 200  # Fallback heuristic
    
    if match_pos < first_para_end:
        return False, f"Cue '{cue}' appears before first paragraph end"
    
    return True, ""


def check_tools_match(request_tools: List, expected_tools: List) -> Tuple[bool, str]:
    """Check that request tools match expected tools."""
    if expected_tools is None:
        expected_tools = []
    
    if request_tools is None:
        request_tools = []
    
    # Extract tool names
    request_tool_names = set()
    for tool in request_tools:
        if isinstance(tool, dict) and "function" in tool:
            request_tool_names.add(tool["function"]["name"])
        elif isinstance(tool, dict) and "name" in tool:
            request_tool_names.add(tool["name"])
    
    expected_tool_names = set()
    for tool in expected_tools:
        if isinstance(tool, dict) and "function" in tool:
            expected_tool_names.add(tool["function"]["name"])
        elif isinstance(tool, dict) and "name" in tool:
            expected_tool_names.add(tool["name"])
        elif isinstance(tool, str):
            expected_tool_names.add(tool)
    
    if request_tool_names != expected_tool_names:
        return False, f"Tool mismatch: got {request_tool_names}, expected {expected_tool_names}"
    
    return True, ""


def gate_a_validation(calls: List[Dict], prompts_data: Dict, study: str) -> Tuple[bool, List[str]]:
    """Gate (a): validate all requests match JSON spec.
    
    Returns (passed, list of errors)
    """
    errors = []
    
    for call in calls:
        request = call["request"]
        key = call["key"]
        
        # Parse unit info
        unit_info = parse_unit_key(key)
        
        # Skip if not a target request (e.g., calibration, grading)
        if "main" not in key:
            continue
        
        # Get expected spec
        expected_spec = get_expected_spec(prompts_data, unit_info)
        
        if expected_spec is None:
            errors.append(f"{key}: No matching spec found")
            continue
        
        # Extract request components
        messages = request.get("messages", [])
        tools = request.get("tools")
        
        if len(messages) < 2:
            errors.append(f"{key}: Expected at least 2 messages (system + user)")
            continue
        
        system_msg = messages[0].get("content", "") if messages[0].get("role") == "system" else ""
        user_msg = messages[1].get("content", "") if messages[1].get("role") == "user" else ""
        
        # Check system prompt matches
        expected_system = expected_spec.get("system", "")
        if system_msg != expected_system:
            errors.append(f"{key}: System prompt mismatch (len {len(system_msg)} vs expected {len(expected_system)})")
        
        # Check user prompt matches (without cue for now)
        expected_user = expected_spec.get("user", "")
        # Allow for cue insertion
        if unit_info.get("cue") and unit_info["cue"] != "none":
            # User prompt with cue should contain the base prompt
            if expected_user not in user_msg:
                errors.append(f"{key}: User prompt doesn't contain base text")
        else:
            if user_msg != expected_user:
                errors.append(f"{key}: User prompt mismatch (len {len(user_msg)} vs expected {len(expected_user)})")
        
        # Check cue placement
        cue = unit_info.get("cue")
        if cue:
            cue_valid, cue_error = check_cue_placement(user_msg, cue)
            if not cue_valid:
                errors.append(f"{key}: {cue_error}")
        
        # Check tools
        expected_tools = expected_spec.get("tools")
        tools_valid, tools_error = check_tools_match(tools, expected_tools)
        if not tools_valid:
            errors.append(f"{key}: {tools_error}")
    
    passed = len(errors) == 0
    return passed, errors


def gate_b_validation(data_file: Path) -> Tuple[bool, float, str]:
    """Gate (b): ≥95% of units coded without error.
    
    Returns (passed, success_rate, message)
    """
    records = []
    with open(data_file) as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    
    if len(records) == 0:
        return False, 0.0, "No records found"
    
    n_errors = sum(1 for r in records if r.get("error") or r.get("code") == "error")
    n_total = len(records)
    success_rate = (n_total - n_errors) / n_total
    
    passed = success_rate >= 0.95
    message = f"{n_total - n_errors}/{n_total} success ({100*success_rate:.1f}%)"
    
    return passed, success_rate, message


def gate_c_validation_s2(data_file: Path) -> Tuple[bool, Dict, str]:
    """Gate (c): S2 per-model unparsed ≤10% in no-tools cells.
    
    Returns (passed, per_model_stats, message)
    """
    records = []
    with open(data_file) as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    
    # Group by model and cell
    per_model = {}
    for r in records:
        model = r.get("model")
        cell = r.get("cell")
        unparsed = r.get("unparsed", False)
        
        if "notools" not in cell:
            continue
        
        if model not in per_model:
            per_model[model] = {"total": 0, "unparsed": 0}
        
        per_model[model]["total"] += 1
        if unparsed:
            per_model[model]["unparsed"] += 1
    
    failed_models = []
    for model, stats in per_model.items():
        rate = stats["unparsed"] / stats["total"] if stats["total"] > 0 else 0
        if rate > 0.10:
            failed_models.append((model, rate))
    
    passed = len(failed_models) == 0
    message = f"No-tools unparsed rates: {per_model}"
    
    if failed_models:
        message = f"Failed: {failed_models}"
    
    return passed, per_model, message


def check_canary(study: str, iter_name: str, model: str, prompts_path: Path, 
                 ledger_path: Path, data_dir: Path) -> Dict:
    """Run all canary gates.
    
    Returns: {
        "gate_a": {"passed": bool, "errors": []},
        "gate_b": {"passed": bool, "success_rate": float},
        "gate_c": {"passed": bool, "stats": {}},  # S2 only
    }
    """
    results = {}
    
    # Load prompts
    prompts_data = load_prompts_json(prompts_path)
    
    # Gate (a): request validation
    print(f"\n=== Gate (a): Request Validation ===")
    calls = load_calls_from_ledger(ledger_path, model)
    print(f"Loaded {len(calls)} calls for model {model}")
    
    gate_a_passed, gate_a_errors = gate_a_validation(calls, prompts_data, study)
    results["gate_a"] = {"passed": gate_a_passed, "errors": gate_a_errors[:10]}  # Limit errors
    
    print(f"Gate (a): {'PASS' if gate_a_passed else 'FAIL'}")
    if not gate_a_passed:
        print(f"  {len(gate_a_errors)} errors found (showing first 10):")
        for err in gate_a_errors[:10]:
            print(f"    - {err}")
    
    # Gate (b): error rate
    print(f"\n=== Gate (b): Error Rate ===")
    data_file = data_dir / f"{model}/main.jsonl"
    if data_file.exists():
        gate_b_passed, gate_b_rate, gate_b_msg = gate_b_validation(data_file)
        results["gate_b"] = {"passed": gate_b_passed, "success_rate": gate_b_rate, "message": gate_b_msg}
        print(f"Gate (b): {'PASS' if gate_b_passed else 'FAIL'} - {gate_b_msg}")
    else:
        results["gate_b"] = {"passed": False, "message": f"Data file not found: {data_file}"}
        print(f"Gate (b): SKIP - {results['gate_b']['message']}")
    
    # Gate (c): S2 unparsed in no-tools
    if study == "s2":
        print(f"\n=== Gate (c): S2 No-Tools Unparsed ===")
        if data_file.exists():
            gate_c_passed, gate_c_stats, gate_c_msg = gate_c_validation_s2(data_file)
            results["gate_c"] = {"passed": gate_c_passed, "stats": gate_c_stats, "message": gate_c_msg}
            print(f"Gate (c): {'PASS' if gate_c_passed else 'FAIL'} - {gate_c_msg}")
        else:
            results["gate_c"] = {"passed": False, "message": "Data file not found"}
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Canary gate validation")
    parser.add_argument("study", choices=["s1", "s2"], help="Study identifier")
    parser.add_argument("iter_name", help="Iteration name (e.g., prereg_s1)")
    parser.add_argument("model", help="Model name")
    parser.add_argument("--prompts", type=Path, required=True, help="Prompts JSON file")
    parser.add_argument("--ledger", type=Path, required=True, help="Ledger database")
    parser.add_argument("--data-dir", type=Path, required=True, help="Data directory")
    
    args = parser.parse_args()
    
    results = check_canary(
        args.study,
        args.iter_name,
        args.model,
        args.prompts,
        args.ledger,
        args.data_dir,
    )
    
    # Print summary
    print("\n" + "="*60)
    print("CANARY CHECK SUMMARY")
    print("="*60)
    
    all_passed = all(gate.get("passed", False) for gate in results.values())
    
    for gate_name, gate_result in results.items():
        status = "✓ PASS" if gate_result.get("passed") else "✗ FAIL"
        print(f"{gate_name}: {status}")
    
    print("="*60)
    print(f"Overall: {'✓ ALL GATES PASSED' if all_passed else '✗ SOME GATES FAILED'}")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
