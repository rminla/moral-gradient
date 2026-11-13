#!/usr/bin/env python3
"""Canary check gates for preregistered studies S1 and S2.

Real per-model gates that return PASS/FAIL based on:
1. Prompt match: prompts are byte-identical to preregistered spec files
2. Coded outcomes: all units have valid outcome codes
3. Unparsed rates: unparsed/no-action rates are within acceptable bounds
4. Cost validation: actual costs match projections within margin

Usage:
    python canary_check.py s1 <model> [--data-dir path/to/data]
    python canary_check.py s2 <model> [--data-dir path/to/data]
    python canary_check.py all [--data-dir path/to/data]

Returns:
    Exit code 0 if all gates PASS
    Exit code 1 if any gate FAILS
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# Preregistered prompt file hashes (SHA256)
PROMPT_HASHES = {
    "study1": "522422ac87b3908ba37d28271433ae91b3e72bcda67f202278afcb80d398d9c1",
    "study2": "2fa4403cac3ce81cfd7a52f81353959fec2c8efb7284100fe8fba9fe55b58c9f",
}

# Expected per-unit costs from cost_estimates.json
EXPECTED_COSTS = {
    "claude-haiku-5.5": {
        "study1_unit": 0.003460,
        "study2_tool_unit": 0.001057,
        "study2_notool_unit": 0.000608,
    },
    "gpt-oss-120b": {
        "study1_unit": 0.002900,
        "study2_tool_unit": 0.000670,
        "study2_notool_unit": 0.000307,
    },
    "qwen3.6-27b": {
        "study1_unit": 0.009166,
        "study2_tool_unit": 0.005696,
        "study2_notool_unit": 0.003473,
    },
    "gemini-3.8-flash": {
        "study1_unit": 0.015433,
        "study2_tool_unit": 0.010762,
        "study2_notool_unit": 0.006673,
    },
}

# Acceptable unparsed/no-action rate thresholds
MAX_UNPARSED_RATE = 0.10  # 10% max unparsed
MAX_NO_ACTION_RATE = 0.15  # 15% max no_action

# Cost tolerance (±20% of expected)
COST_TOLERANCE = 0.20


def sha256_file(path: Path) -> str:
    """Compute SHA256 hash of a file."""
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def check_prompt_match(study: str, prompt_file: Path) -> Tuple[bool, str]:
    """Gate 1: Verify prompt file matches preregistered hash.
    
    Args:
        study: "study1" or "study2"
        prompt_file: Path to prompts_studyN.json
    
    Returns:
        (passed, message)
    """
    if not prompt_file.exists():
        return False, f"Prompt file not found: {prompt_file}"
    
    actual_hash = sha256_file(prompt_file)
    expected_hash = PROMPT_HASHES[study]
    
    if actual_hash == expected_hash:
        return True, f"✓ Prompt hash matches preregistered spec ({actual_hash[:8]}...)"
    else:
        return False, (
            f"✗ Prompt hash mismatch:\n"
            f"  Expected: {expected_hash}\n"
            f"  Actual:   {actual_hash}\n"
            f"  Prompts must be byte-identical to preregistered spec files"
        )


def check_coded_outcomes(records: List[Dict], study: str, model: str) -> Tuple[bool, str]:
    """Gate 2: Verify all units have valid outcome codes.
    
    Args:
        records: List of record dictionaries from canary run
        study: "study1" or "study2"
        model: Model name
    
    Returns:
        (passed, message)
    """
    if not records:
        return False, "✗ No records found in canary data"
    
    valid_outcomes = {"act", "keep", "waive", "no_action", "escalate"}
    missing_outcome = []
    invalid_outcome = []
    
    for i, rec in enumerate(records):
        if "outcome" not in rec:
            missing_outcome.append(i)
        elif rec["outcome"] not in valid_outcomes:
            invalid_outcome.append((i, rec["outcome"]))
    
    if missing_outcome or invalid_outcome:
        msg = f"✗ Invalid outcomes found:\n"
        if missing_outcome:
            msg += f"  {len(missing_outcome)} records missing 'outcome' field\n"
        if invalid_outcome:
            msg += f"  {len(invalid_outcome)} records with invalid outcomes: {invalid_outcome[:5]}\n"
        return False, msg
    
    return True, f"✓ All {len(records)} records have valid outcome codes"


def check_unparsed_rates(records: List[Dict], study: str, model: str) -> Tuple[bool, str]:
    """Gate 3: Verify unparsed and no_action rates are within bounds.
    
    Args:
        records: List of record dictionaries from canary run
        study: "study1" or "study2"
        model: Model name
    
    Returns:
        (passed, message)
    """
    if not records:
        return False, "✗ No records found in canary data"
    
    n_total = len(records)
    n_unparsed = sum(1 for r in records if r.get("outcome") == "escalate" or "unparsed" in r.get("flags", []))
    n_no_action = sum(1 for r in records if r.get("outcome") == "no_action")
    
    unparsed_rate = n_unparsed / n_total if n_total > 0 else 0
    no_action_rate = n_no_action / n_total if n_total > 0 else 0
    
    passed = True
    messages = []
    
    if unparsed_rate > MAX_UNPARSED_RATE:
        passed = False
        messages.append(f"  Unparsed rate {unparsed_rate:.1%} exceeds {MAX_UNPARSED_RATE:.1%} threshold")
    else:
        messages.append(f"  Unparsed rate: {unparsed_rate:.1%} (threshold {MAX_UNPARSED_RATE:.1%})")
    
    if no_action_rate > MAX_NO_ACTION_RATE:
        passed = False
        messages.append(f"  No-action rate {no_action_rate:.1%} exceeds {MAX_NO_ACTION_RATE:.1%} threshold")
    else:
        messages.append(f"  No-action rate: {no_action_rate:.1%} (threshold {MAX_NO_ACTION_RATE:.1%})")
    
    symbol = "✓" if passed else "✗"
    return passed, f"{symbol} Unparsed/no-action rates ({n_total} records):\n" + "\n".join(messages)


def check_cost_validation(records: List[Dict], study: str, model: str, is_tools: Optional[bool] = None) -> Tuple[bool, str]:
    """Gate 4: Verify actual costs match projections within tolerance.
    
    Args:
        records: List of record dictionaries from canary run
        study: "study1" or "study2"
        model: Model name
        is_tools: For study2, True for tools cells, False for notools cells, None for mixed
    
    Returns:
        (passed, message)
    """
    if not records:
        return False, "✗ No records found in canary data"
    
    # Calculate actual cost per unit
    total_cost = sum(r.get("cost_usd", 0) for r in records)
    n_units = len(records)
    actual_per_unit = total_cost / n_units if n_units > 0 else 0
    
    # Get expected cost
    if study == "study1":
        expected_per_unit = EXPECTED_COSTS[model]["study1_unit"]
    else:  # study2
        if is_tools is None:
            # Mixed: average of tools and notools
            tool_cost = EXPECTED_COSTS[model]["study2_tool_unit"]
            notool_cost = EXPECTED_COSTS[model]["study2_notool_unit"]
            expected_per_unit = (tool_cost + notool_cost) / 2
        elif is_tools:
            expected_per_unit = EXPECTED_COSTS[model]["study2_tool_unit"]
        else:
            expected_per_unit = EXPECTED_COSTS[model]["study2_notool_unit"]
    
    # Check if within tolerance
    lower_bound = expected_per_unit * (1 - COST_TOLERANCE)
    upper_bound = expected_per_unit * (1 + COST_TOLERANCE)
    
    if lower_bound <= actual_per_unit <= upper_bound:
        deviation = abs(actual_per_unit - expected_per_unit) / expected_per_unit
        return True, (
            f"✓ Cost validation passed ({n_units} units):\n"
            f"  Expected: ${expected_per_unit:.6f} per unit\n"
            f"  Actual:   ${actual_per_unit:.6f} per unit ({deviation:+.1%})\n"
            f"  Total:    ${total_cost:.4f}"
        )
    else:
        deviation = (actual_per_unit - expected_per_unit) / expected_per_unit
        return False, (
            f"✗ Cost validation failed ({n_units} units):\n"
            f"  Expected: ${expected_per_unit:.6f} per unit\n"
            f"  Actual:   ${actual_per_unit:.6f} per unit ({deviation:+.1%})\n"
            f"  Tolerance: ±{COST_TOLERANCE:.0%}\n"
            f"  Total:    ${total_cost:.4f}"
        )


def load_canary_data(study: str, model: str, data_dir: Path) -> List[Dict]:
    """Load canary data from JSONL file.
    
    Args:
        study: "study1" or "study2"
        model: Model name
        data_dir: Root data directory (contains v3/<iter>/<model>/)
    
    Returns:
        List of record dictionaries
    """
    # Look for canary data in standard locations
    iter_name = f"{study.replace('study', 's')}-canary"
    canary_file = data_dir / "v3" / iter_name / model / "canary.jsonl"
    
    if not canary_file.exists():
        # Try alternative location
        canary_file = data_dir / model / f"{study}_canary.jsonl"
    
    if not canary_file.exists():
        raise FileNotFoundError(f"Canary data not found at {canary_file}")
    
    records = []
    with open(canary_file) as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    
    return records


def run_gates(study: str, model: str, data_dir: Path, prompt_file: Path) -> Dict[str, Tuple[bool, str]]:
    """Run all canary gates for a study and model.
    
    Args:
        study: "study1" or "study2"
        model: Model name
        data_dir: Root data directory
        prompt_file: Path to prompts_studyN.json
    
    Returns:
        Dictionary of gate results: {gate_name: (passed, message)}
    """
    results = {}
    
    # Gate 1: Prompt match
    results["prompt_match"] = check_prompt_match(study, prompt_file)
    
    # Load canary data
    try:
        records = load_canary_data(study, model, data_dir)
    except FileNotFoundError as e:
        # If data doesn't exist, all remaining gates fail
        msg = f"✗ Canary data not found: {e}"
        results["coded_outcomes"] = (False, msg)
        results["unparsed_rates"] = (False, msg)
        results["cost_validation"] = (False, msg)
        return results
    
    # Gate 2: Coded outcomes
    results["coded_outcomes"] = check_coded_outcomes(records, study, model)
    
    # Gate 3: Unparsed rates
    results["unparsed_rates"] = check_unparsed_rates(records, study, model)
    
    # Gate 4: Cost validation
    results["cost_validation"] = check_cost_validation(records, study, model)
    
    return results


def print_results(study: str, model: str, results: Dict[str, Tuple[bool, str]]) -> bool:
    """Print gate results and return overall pass/fail.
    
    Args:
        study: "study1" or "study2"
        model: Model name
        results: Dictionary of gate results
    
    Returns:
        True if all gates passed, False otherwise
    """
    print("=" * 70)
    print(f"CANARY CHECK: {study.upper()} / {model}")
    print("=" * 70)
    print()
    
    all_passed = True
    for gate_name, (passed, message) in results.items():
        print(f"{gate_name.upper().replace('_', ' ')}:")
        print(message)
        print()
        if not passed:
            all_passed = False
    
    status = "✓ PASS" if all_passed else "✗ FAIL"
    print("=" * 70)
    print(f"OVERALL: {status}")
    print("=" * 70)
    print()
    
    return all_passed


def main():
    parser = argparse.ArgumentParser(description="Canary check gates for preregistered studies")
    parser.add_argument("study", choices=["s1", "s2", "study1", "study2", "all"], help="Study to check")
    parser.add_argument("model", nargs="?", help="Model name (required unless study=all)")
    parser.add_argument("--data-dir", type=Path, default=Path("data"), help="Root data directory")
    parser.add_argument("--prompts-dir", type=Path, default=Path("."), help="Directory containing prompts_studyN.json")
    
    args = parser.parse_args()
    
    # Normalize study names
    study = args.study.replace("s", "study") if args.study in ["s1", "s2"] else args.study
    
    if study == "all":
        # Run all combinations
        models = ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]
        studies = ["study1", "study2"]
        
        all_passed = True
        for s in studies:
            prompt_file = args.prompts_dir / f"prompts_{s}.json"
            for m in models:
                results = run_gates(s, m, args.data_dir, prompt_file)
                passed = print_results(s, m, results)
                if not passed:
                    all_passed = False
        
        sys.exit(0 if all_passed else 1)
    
    # Single study/model
    if not args.model:
        parser.error("model is required when study is not 'all'")
    
    prompt_file = args.prompts_dir / f"prompts_{study}.json"
    results = run_gates(study, args.model, args.data_dir, prompt_file)
    passed = print_results(study, args.model, results)
    
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
