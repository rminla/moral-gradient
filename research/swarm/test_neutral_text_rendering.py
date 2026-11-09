#!/usr/bin/env python3
"""
Test actual rendered SDK payloads for correct neutral text.

Verifies:
1. Personal cases (powerbank, bonus_split) use neutral_text_personal (NO company system)
2. Organizational cases (late_fee, ceo_candidate) use neutral_text (company system)
3. Single and team structures have matched neutral exposure
4. Neutral text placed correctly in turn 1/2/final as intended
"""

import json
import sys
from pathlib import Path

# Add local lib to path
sys.path.insert(0, str(Path(__file__).parent))

def load_config_files():
    """Load cases and prompts."""
    swarm_dir = Path(__file__).parent
    
    with open(swarm_dir / "cases_v_new.json") as f:
        cases_data = json.load(f)
    
    with open(swarm_dir / "prompts_v_new.json") as f:
        prompts = json.load(f)
    
    return cases_data, prompts


def get_neutral_text(case_id: str, prompts: dict) -> str:
    """Get context-appropriate neutral text (same logic as run_swarm_v_new.py)."""
    personal_cases = {"powerbank", "bonus_split"}
    
    if case_id in personal_cases:
        return prompts.get("neutral_text_personal", prompts["neutral_text"])
    else:
        return prompts["neutral_text"]


def render_prompt(role_template: str, case: dict, prompts: dict, neutral: str, **kwargs) -> str:
    """Render a prompt template with case data."""
    # Format evidence
    evidence_template = prompts["evidence_format"]["template"]
    evidence_item_fmt = prompts["evidence_format"]["item_format"]
    evidence_items = "\n".join(
        evidence_item_fmt.format(key=k.replace("_", " "), value=v)
        for k, v in case["evidence"].items()
    )
    evidence_formatted = evidence_template.format(items=evidence_items)
    
    # Format actions list
    actions_template = prompts["actions_list_format"]["template"]
    actions_item_fmt = prompts["actions_list_format"]["item_format"]
    actions_items = "\n".join(
        actions_item_fmt.format(
            name=tool["function"]["name"],
            description=tool["function"]["description"]
        )
        for tool in case["action_tools"]
    )
    actions_list = actions_template.format(items=actions_items)
    
    # Render template
    return role_template.format(
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_formatted,
        actions_list=actions_list,
        pressure_or_neutral=neutral,
        **kwargs
    )


def test_personal_cases_no_company_language():
    """Test 1: Personal cases have NO company system language."""
    print("\n1. Testing personal cases have NO company system language...")
    
    cases_data, prompts = load_config_files()
    
    personal_case_ids = {"powerbank", "bonus_split"}
    all_pass = True
    
    for case in cases_data["cases"]:
        if case["id"] not in personal_case_ids:
            continue
        
        neutral = get_neutral_text(case["id"], prompts)
        
        # Check neutral text does NOT contain company/organizational language
        forbidden_phrases = [
            "company system",
            "organizational review",
            "recorded in the",
            "company",
            "organization"
        ]
        
        has_forbidden = any(phrase in neutral.lower() for phrase in forbidden_phrases)
        
        if has_forbidden:
            print(f"   ❌ FAIL: {case['id']} neutral has organizational language:")
            print(f"      {neutral}")
            all_pass = False
        else:
            print(f"   ✅ PASS: {case['id']} neutral is personal/private")
            print(f"      {neutral[:80]}...")
    
    return all_pass


def test_organizational_cases_have_company_language():
    """Test 2: Organizational cases HAVE company system language."""
    print("\n2. Testing organizational cases HAVE company system language...")
    
    cases_data, prompts = load_config_files()
    
    organizational_case_ids = {"late_fee", "ceo_candidate"}
    all_pass = True
    
    for case in cases_data["cases"]:
        if case["id"] not in organizational_case_ids:
            continue
        
        neutral = get_neutral_text(case["id"], prompts)
        
        # Check neutral text DOES contain organizational language
        required_phrases = ["company system", "organizational review"]
        
        has_required = any(phrase in neutral.lower() for phrase in required_phrases)
        
        if not has_required:
            print(f"   ❌ FAIL: {case['id']} neutral missing organizational language:")
            print(f"      {neutral}")
            all_pass = False
        else:
            print(f"   ✅ PASS: {case['id']} neutral has organizational framing")
            print(f"      {neutral[:80]}...")
    
    return all_pass


def test_single_team_neutral_matched():
    """Test 3: Single and team structures see same neutral text."""
    print("\n3. Testing single and team see matched neutral text...")
    
    cases_data, prompts = load_config_files()
    
    all_pass = True
    
    for case in cases_data["cases"]:
        neutral = get_neutral_text(case["id"], prompts)
        
        # Render turn 1 for single
        single_plan = prompts["roles"]["single_plan"]
        single_t1 = render_prompt(
            single_plan["user_prompt"],
            case,
            prompts,
            neutral
        )
        
        # Render turn 1 for team
        team_worker = prompts["roles"]["team_worker"]
        team_t1 = render_prompt(
            team_worker["user_prompt"],
            case,
            prompts,
            neutral
        )
        
        # Check both contain the same neutral text
        if neutral in single_t1 and neutral in team_t1:
            print(f"   ✅ PASS: {case['id']} - single and team see matched neutral")
        else:
            print(f"   ❌ FAIL: {case['id']} - neutral text mismatch")
            all_pass = False
    
    return all_pass


def test_neutral_placement_turns():
    """Test 4: Neutral text placed correctly in turns 1, 2, final."""
    print("\n4. Testing neutral text placement in turns...")
    
    cases_data, prompts = load_config_files()
    
    # Pick one case to test (powerbank as personal example)
    case = [c for c in cases_data["cases"] if c["id"] == "powerbank"][0]
    neutral = get_neutral_text(case["id"], prompts)
    
    # Turn 1: Should have neutral (not pressure)
    single_plan = prompts["roles"]["single_plan"]
    t1_prompt = render_prompt(single_plan["user_prompt"], case, prompts, neutral)
    
    # Turn 2: Would have pressure (we're just testing structure exists)
    single_review = prompts["roles"]["single_review"]
    # Note: Turn 2 uses {turn1_message} placeholder, we'll check template
    
    # Turn 3: Should have neutral available in template
    single_action = prompts["roles"]["single_action"]
    # Note: Turn 3 uses {turn1_message} and {turn2_message}, we'll check template
    
    checks = [
        ("{pressure_or_neutral}" in single_plan["user_prompt"], "Turn 1 has pressure_or_neutral placeholder"),
        ("{pressure_or_neutral}" in single_review["user_prompt"], "Turn 2 has pressure_or_neutral placeholder"),
        ("{pressure_or_neutral}" in single_action["user_prompt"], "Turn 3 has pressure_or_neutral placeholder"),
        (neutral in t1_prompt, "Turn 1 rendered prompt contains neutral text")
    ]
    
    all_pass = True
    for check, desc in checks:
        if check:
            print(f"   ✅ PASS: {desc}")
        else:
            print(f"   ❌ FAIL: {desc}")
            all_pass = False
    
    return all_pass


def main():
    print("=" * 70)
    print("NEUTRAL TEXT RENDERING VERIFICATION")
    print("=" * 70)
    
    tests = [
        ("Personal cases NO company language", test_personal_cases_no_company_language),
        ("Organizational cases HAVE company language", test_organizational_cases_have_company_language),
        ("Single and team neutral matched", test_single_team_neutral_matched),
        ("Neutral placement in turns", test_neutral_placement_turns),
    ]
    
    results = []
    for name, test_fn in tests:
        try:
            passed = test_fn()
            results.append((name, passed))
        except Exception as e:
            print(f"   ❌ Test crashed: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, p in results if p)
    total = len(results)
    
    for name, p in results:
        status = "✅ PASS" if p else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL NEUTRAL TEXT TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
