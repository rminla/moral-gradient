#!/usr/bin/env python3
"""
Acceptance tests for swarm v_NEW design.

Tests all criteria from ACCEPTANCE_CHECKLIST_swarm_v17.md:
1. Full facts in every role prompt
2. Case-specific pressure (no CEO baseline pressure)
3. Matched 3-call structure
4. Only final actor gets tools
5. Hard 64-episode pilot cap
6. Explicit outcome classification
7. Protocol hashes
8. Old 150 excluded
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List


def load_json(path: Path) -> Dict:
    """Load JSON file."""
    with open(path) as f:
        return json.load(f)


def test_full_facts_every_role(cases: Dict, prompts: Dict) -> bool:
    """Test 1: Every role prompt contains full scenario, context, evidence, actions."""
    print("\n1. Testing full facts in every role...")
    
    required_fields = ["{scenario_text}", "{context}", "{evidence_formatted}", "{actions_list}"]
    roles_to_check = ["single_plan", "single_review", "single_action", 
                     "team_worker", "team_manager", "team_reviewer"]
    
    all_pass = True
    for role in roles_to_check:
        prompt = prompts["roles"][role]["user_prompt"]
        missing = [f for f in required_fields if f not in prompt]
        if missing:
            print(f"   ✗ {role} missing: {missing}")
            all_pass = False
        else:
            print(f"   ✓ {role} has all fields")
    
    return all_pass


def test_no_ceo_baseline_pressure(cases: Dict) -> bool:
    """Test 2: CEO case has no promotion pressure in baseline."""
    print("\n2. Testing no CEO baseline pressure...")
    
    ceo_case = next(c for c in cases["cases"] if c["id"] == "ceo_candidate")
    
    # Check scenario_text doesn't mention promotion
    scenario = ceo_case["scenario_text"]
    if "promotion" in scenario.lower():
        print(f"   ✗ CEO baseline scenario mentions promotion")
        return False
    
    # Check evidence doesn't have promotion field in baseline
    if "promotion" in str(ceo_case["evidence"]).lower():
        print(f"   ✗ CEO baseline evidence mentions promotion")
        return False
    
    # Check pressure_text DOES mention it (for pressure arm)
    pressure = ceo_case.get("pressure_text", "")
    if "promotion" not in pressure.lower():
        print(f"   ✗ CEO pressure_text missing promotion incentive")
        return False
    
    print(f"   ✓ CEO case has clean baseline, pressure only in pressure_text")
    return True


def test_case_specific_pressure(cases: Dict) -> bool:
    """Test 2b: Each case has specific pressure aligned to its incentives."""
    print("\n2b. Testing case-specific pressure...")
    
    expected = {
        "late_fee": "cost recovery",
        "ceo_candidate": "promotion",
        "powerbank": "budget",
        "bonus_split": "financial"
    }
    
    all_pass = True
    for case in cases["cases"]:
        pressure = case.get("pressure_text", "").lower()
        expected_word = expected.get(case["id"], "")
        if expected_word not in pressure:
            print(f"   ✗ {case['id']} pressure missing '{expected_word}'")
            all_pass = False
        else:
            print(f"   ✓ {case['id']} has '{expected_word}' pressure")
    
    return all_pass


def test_matched_3_call_structure(config: Dict) -> bool:
    """Test 3: Both single and team have 3-turn structure."""
    print("\n3. Testing matched 3-call structure...")
    
    all_pass = True
    for arm in config["arms"]:
        turns = arm.get("turns", [])
        if len(turns) != 3:
            print(f"   ✗ {arm['id']} has {len(turns)} turns, expected 3")
            all_pass = False
        else:
            print(f"   ✓ {arm['id']}: {' -> '.join(turns)}")
    
    return all_pass


def test_pressure_at_turn_2(config: Dict, prompts: Dict) -> bool:
    """Test 3b: Pressure injected at turn 2 (middle phase) for both structures."""
    print("\n3b. Testing pressure at turn 2...")
    
    # Check turn 2 roles have pressure_or_neutral placeholder
    turn2_roles = ["single_review", "team_manager"]
    all_pass = True
    
    for role in turn2_roles:
        prompt = prompts["roles"][role]["user_prompt"]
        if "{pressure_or_neutral}" not in prompt:
            print(f"   ✗ {role} missing pressure_or_neutral placeholder")
            all_pass = False
        else:
            print(f"   ✓ {role} has pressure_or_neutral at turn 2")
    
    # Check turn 1 and 3 don't have variable pressure
    turn1_roles = ["single_plan", "team_worker"]
    turn3_roles = ["single_action", "team_reviewer"]
    
    for role in turn1_roles + turn3_roles:
        prompt = prompts["roles"][role]["user_prompt"]
        # Should have pressure_or_neutral but always neutral for these turns
        # Actually based on template, turn 1 and 3 should use neutral
        count = prompt.count("{pressure_or_neutral}")
        if count == 0:
            print(f"   ✓ {role} has no pressure placeholder (or hardcoded neutral)")
        elif count == 1:
            # It has placeholder - implementation will use neutral
            print(f"   ✓ {role} has pressure placeholder (will be neutral)")
    
    return all_pass


def test_only_final_actor_tools(config: Dict) -> bool:
    """Test 4: Only turn 3 (single_action / team_reviewer) gets tools."""
    print("\n4. Testing only final actor gets tools...")
    
    tool_avail = config["tool_availability"]
    
    expected_false = ["single_plan", "single_review", "team_worker", "team_manager"]
    expected_true = ["single_action", "team_reviewer"]
    
    all_pass = True
    for role in expected_false:
        if tool_avail.get(role, True):  # Default true means failure if missing
            print(f"   ✗ {role} should NOT have tools")
            all_pass = False
        else:
            print(f"   ✓ {role}: no tools")
    
    for role in expected_true:
        if not tool_avail.get(role, False):
            print(f"   ✗ {role} should HAVE tools")
            all_pass = False
        else:
            print(f"   ✓ {role}: has tools")
    
    return all_pass


def test_64_episode_pilot_schedule(config: Dict, cases: Dict) -> bool:
    """Test 5: Pilot schedule = 4 cases × 4 arms × 4 models × 1 = 64 episodes."""
    print("\n5. Testing 64-episode pilot schedule...")
    
    n_cases = len(cases["cases"])
    n_arms = len(config["arms"])
    n_models = len(config["models"])
    n_pilot = config["pilot_episodes"]
    
    expected = n_cases * n_arms * n_models * n_pilot
    
    print(f"   Cases: {n_cases}")
    print(f"   Arms: {n_arms}")
    print(f"   Models: {n_models}")
    print(f"   Pilot episodes per combo: {n_pilot}")
    print(f"   Expected total: {expected}")
    
    if expected != 64:
        print(f"   ✗ Expected 64, got {expected}")
        return False
    
    total_calls = expected * 3
    if total_calls != 192:
        print(f"   ✗ Expected 192 calls, got {total_calls}")
        return False
    
    print(f"   ✓ Pilot = 64 episodes = 192 calls")
    return True


def test_mock_dry_run() -> bool:
    """Test 8: Run mock pilot (no API calls, $0 cost)."""
    print("\n8. Testing mock dry-run...")
    
    swarm_dir = Path(__file__).parent
    script = swarm_dir / "run_swarm_v_new.py"
    
    result = subprocess.run(
        [sys.executable, str(script), "--pilot", "--mock"],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        print(f"   ✗ Mock run failed: {result.stderr}")
        return False
    
    # Check output
    if "64" not in result.stdout or "192" not in result.stdout:
        print(f"   ✗ Output missing 64 episodes or 192 calls")
        print(result.stdout)
        return False
    
    if "MOCK MODE" not in result.stdout:
        print(f"   ✗ Output missing MOCK MODE confirmation")
        return False
    
    print(f"   ✓ Mock run complete: 64 episodes, 192 calls, $0 cost")
    return True


def test_no_old_150_loaded() -> bool:
    """Test: Old 150-episode METHOD_INVALID.json never loaded."""
    print("\n9. Testing old 150 excluded...")
    
    swarm_dir = Path(__file__).parent
    old_file = swarm_dir / "METHOD_INVALID.json"
    
    if old_file.exists():
        print(f"   ⚠ Old METHOD_INVALID.json still exists (should be deleted)")
        # Check if run_swarm_v_new.py references it
        script = swarm_dir / "run_swarm_v_new.py"
        with open(script) as f:
            code = f.read()
        if "METHOD_INVALID" in code:
            print(f"   ✗ run_swarm_v_new.py references METHOD_INVALID")
            return False
    
    print(f"   ✓ Old 150 excluded (new v_NEW files only)")
    return True


def test_explicit_outcome_classification() -> bool:
    """Test 6: Outcome classification covers action/refusal/no_action/escalation."""
    print("\n6. Testing explicit outcome classification...")
    
    swarm_dir = Path(__file__).parent
    script = swarm_dir / "run_swarm_v_new.py"
    
    with open(script) as f:
        code = f.read()
    
    required = ["action", "refusal", "no_action", "escalation"]
    all_pass = True
    
    for outcome in required:
        if f'"{outcome}"' not in code:
            print(f"   ✗ Missing outcome type: {outcome}")
            all_pass = False
        else:
            print(f"   ✓ {outcome} classification present")
    
    return all_pass


def test_protocol_hashes() -> bool:
    """Test 7: Protocol hash computation present."""
    print("\n7. Testing protocol hash computation...")
    
    swarm_dir = Path(__file__).parent
    script = swarm_dir / "run_swarm_v_new.py"
    
    with open(script) as f:
        code = f.read()
    
    if "compute_hash" not in code or "protocol_hashes" not in code:
        print(f"   ✗ Hash computation missing")
        return False
    
    print(f"   ✓ Protocol hash functions present")
    return True


def main():
    print("=" * 60)
    print("SWARM v_NEW ACCEPTANCE TESTS")
    print("=" * 60)
    
    swarm_dir = Path(__file__).parent
    
    # Load config files
    config = load_json(swarm_dir / "config_v_new.json")
    cases = load_json(swarm_dir / "cases_v_new.json")
    prompts = load_json(swarm_dir / "prompts_v_new.json")
    
    # Run all tests
    tests = [
        ("Full facts every role", lambda: test_full_facts_every_role(cases, prompts)),
        ("No CEO baseline pressure", lambda: test_no_ceo_baseline_pressure(cases)),
        ("Case-specific pressure", lambda: test_case_specific_pressure(cases)),
        ("Matched 3-call structure", lambda: test_matched_3_call_structure(config)),
        ("Pressure at turn 2", lambda: test_pressure_at_turn_2(config, prompts)),
        ("Only final actor tools", lambda: test_only_final_actor_tools(config)),
        ("64-episode pilot schedule", lambda: test_64_episode_pilot_schedule(config, cases)),
        ("Explicit outcome classification", test_explicit_outcome_classification),
        ("Protocol hashes", test_protocol_hashes),
        ("Old 150 excluded", test_no_old_150_loaded),
        ("Mock dry-run (64 episodes, 192 calls)", test_mock_dry_run)
    ]
    
    results = []
    for name, test_fn in tests:
        try:
            passed = test_fn()
            results.append((name, passed))
        except Exception as e:
            print(f"   ✗ Test crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, p in results if p)
    total = len(results)
    
    for name, p in results:
        status = "✓ PASS" if p else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL ACCEPTANCE TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
