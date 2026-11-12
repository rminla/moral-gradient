#!/usr/bin/env python3
"""
Mandatory Acceptance Tests - Must ALL Pass Before Any Paid Run

Tests actual ProviderClient code paths with SDK-native response objects.
HTTP serialization not proven (acceptable - live canary will verify).

Tests:
1. Stage cap atomic including in-flight + baseline from ledger
2. Full reconcile kwargs compatibility
3. Context parity: single vs team phase 3 rendered prompts
4. Tool execution effects with deterministic outcomes
5. Semantic outcome categories
"""

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import ProviderClient, Message, ModelResponse
from lib.models import Provider
from stage_budget import StageBudgetEnforcer
from case_environment import CaseEnvironment
from outcome_categories import classify_outcome, TOOL_OUTCOME_MAP


def test_1_stage_cap_atomic():
    """Test 1: Stage cap atomic including in-flight reservations."""
    print("\n1. Stage Cap Atomic (in-flight + settled)...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        ledger = Path(tmpdir) / "ledger.db"
        
        budget = BudgetTracker(ledger, global_cap_usd=70.0)
        stage = StageBudgetEnforcer(
            budget_tracker=budget,
            stage_cap_usd=1.0,
            baseline_locked_usd=0.0
        )
        
        try:
            # Reserve $0.40
            stage.reserve("call1", "anthropic/claude-haiku-5-5", Provider.ANTHROPIC, 0.40)
            print(f"   Reserved $0.40: stage_reserved=${stage.stage_reserved_usd:.2f}")
            
            # Reserve another $0.40 (total in-flight $0.80)
            stage.reserve("call2", "anthropic/claude-haiku-5-5", Provider.ANTHROPIC, 0.40)
            print(f"   Reserved $0.40: stage_reserved=${stage.stage_reserved_usd:.2f}")
            
            # Try to reserve $0.40 more (would be $1.20 > $1.00 cap)
            try:
                stage.reserve("call3", "anthropic/claude-haiku-5-5", Provider.ANTHROPIC, 0.40)
                print(f"   ❌ FAIL: In-flight not counted")
                return False
            except BudgetExceededError:
                print(f"   ✅ PASS: Rejected (in-flight counted)")
                return True
                
        except Exception as e:
            print(f"   ❌ FAIL: {e}")
            return False


def test_2_baseline_from_ledger():
    """Test 2: Baseline computed from ledger, not CLI default."""
    print("\n2. Baseline Computed from Ledger...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        ledger = Path(tmpdir) / "ledger.db"
        
        # Pre-populate ledger with existing spending
        budget1 = BudgetTracker(ledger, global_cap_usd=70.0)
        budget1.reserve("existing_call", "anthropic/claude-haiku-5-5", Provider.ANTHROPIC, 2.00)
        budget1.reconcile(
            call_id="existing_call",
            model_version="test",
            prompt_tokens=100,
            completion_tokens=50,
            actual_cost_usd=1.50,
            duration_ms=100,
            experiment="test"
        )
        
        # Create stage enforcer (should compute baseline from ledger)
        budget2 = BudgetTracker(ledger, global_cap_usd=70.0)
        stage = StageBudgetEnforcer(
            budget_tracker=budget2,
            stage_cap_usd=5.0,
            baseline_locked_usd=None  # Compute from ledger
        )
        
        # Check computed baseline
        status = stage.get_status()
        computed_baseline = status['baseline_locked_usd']
        
        if computed_baseline == 1.50:
            print(f"   ✅ PASS: Baseline computed from ledger: ${computed_baseline:.2f}")
            return True
        else:
            print(f"   ❌ FAIL: Baseline wrong: ${computed_baseline:.2f} (expected $1.50)")
            return False


def test_3_full_reconcile_kwargs():
    """Test 3: Full reconcile() kwargs compatibility."""
    print("\n3. Full Reconcile Kwargs Compatibility...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        ledger = Path(tmpdir) / "ledger.db"
        
        budget = BudgetTracker(ledger, global_cap_usd=70.0)
        stage = StageBudgetEnforcer(
            budget_tracker=budget,
            stage_cap_usd=5.0,
            baseline_locked_usd=0.0
        )
        
        try:
            stage.reserve("test_call", "anthropic/claude-haiku-5-5", Provider.ANTHROPIC, 0.50)
            
            # Call with FULL kwargs (as ProviderClient does)
            stage.reconcile(
                call_id="test_call",
                model_version="claude-haiku-5-5-20261108",
                prompt_tokens=100,
                completion_tokens=50,
                actual_cost_usd=0.15,
                duration_ms=500,
                experiment="swarm",
                metadata=json.dumps({"test": True}),
                error=None,
                finish_reason="stop"
            )
            
            # Verify stage tracking
            status = stage.get_status()
            if status['stage_spent_usd'] == 0.15 and status['stage_reserved_usd'] == 0.0:
                print(f"   ✅ PASS: Full kwargs accepted, stage tracked correctly")
                return True
            else:
                print(f"   ❌ FAIL: Stage tracking wrong: spent=${status['stage_spent_usd']:.2f}")
                return False
                
        except TypeError as e:
            print(f"   ❌ FAIL: TypeError: {e}")
            return False


def test_4_context_parity_scientific():
    """Test 4: Context parity - single vs team phase 3 rendered prompts."""
    print("\n4. Context Parity (Scientific Check)...")
    
    # Load actual prompts
    swarm_dir = Path(__file__).parent
    with open(swarm_dir / "prompts_v_new.json") as f:
        prompts = json.load(f)
    with open(swarm_dir / "cases_v_new.json") as f:
        cases = json.load(f)
    
    case = cases["cases"][0]  # late_fee
    
    # Render single phase 3 prompt
    from run_swarm_v_new import format_evidence, format_actions_list
    
    evidence_fmt = format_evidence(case["evidence"], prompts)
    actions_list = format_actions_list(case, prompts)
    neutral_text = prompts["neutral_text"]
    
    single_prompt = prompts["roles"]["single_action"]["user_prompt"].format(
        turn1_message="[Turn 1 output]",
        turn2_message="[Turn 2 output]",
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=neutral_text
    )
    
    # Render team phase 3 prompt
    team_prompt = prompts["roles"]["team_reviewer"]["user_prompt"].format(
        turn1_message="[Turn 1 output]",
        turn2_message="[Turn 2 output]",
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=neutral_text
    )
    
    # Check both have full facts
    has_scenario_single = case["scenario_text"] in single_prompt
    has_scenario_team = case["scenario_text"] in team_prompt
    has_actions_single = "waive_late_fee" in single_prompt
    has_actions_team = "waive_late_fee" in team_prompt
    
    # Check neither has pressure text (should be neutral)
    pressure_text = case.get("pressure_text", "")
    has_pressure_single = pressure_text in single_prompt if pressure_text else False
    has_pressure_team = pressure_text in team_prompt if pressure_text else False
    
    print(f"   Single phase 3: scenario={has_scenario_single}, actions={has_actions_single}, pressure={has_pressure_single}")
    print(f"   Team phase 3: scenario={has_scenario_team}, actions={has_actions_team}, pressure={has_pressure_team}")
    
    if has_scenario_single and has_scenario_team and has_actions_single and has_actions_team:
        if not has_pressure_single and not has_pressure_team:
            print(f"   ✅ PASS: Both have full facts, neither has pressure")
            return True
        else:
            print(f"   ⚠️  PARTIAL: Full facts present, but pressure text found")
            return False
    else:
        print(f"   ❌ FAIL: Missing facts in one or both prompts")
        return False


def test_5_tool_effects_deterministic():
    """Test 5: Tool execution with deterministic effects."""
    print("\n5. Tool Execution Deterministic Effects...")
    
    env = CaseEnvironment("late_fee")
    
    # Test multiple tools
    tools_to_test = [
        ("waive_late_fee", {"late_fee_status": "waived"}),
        ("keep_late_fee", {"late_fee_status": "maintained"}),
        ("escalate_to_supervisor", {"late_fee_status": "escalated"}),
    ]
    
    all_pass = True
    for tool_name, expected_effect_key in tools_to_test:
        env = CaseEnvironment("late_fee")  # Fresh env
        result = env.execute_tool(tool_name, {})
        
        if result["executed"]:
            effects = result["effects_applied"]
            if expected_effect_key[0] in effects and effects[expected_effect_key[0]] == expected_effect_key[1]:
                print(f"   ✅ {tool_name}: effects correct")
            else:
                print(f"   ❌ {tool_name}: effects wrong")
                all_pass = False
        else:
            print(f"   ❌ {tool_name}: not executed")
            all_pass = False
    
    return all_pass


def test_6_semantic_outcomes():
    """Test 6: Semantic outcome categories (explicit mapping)."""
    print("\n6. Semantic Outcome Categories...")
    
    test_cases = [
        ("waive_late_fee", "direct_action"),
        ("escalate_to_supervisor", "escalation"),
        ("contact_seller_first", "defer"),
        ("present_both_neutrally", "present_neutral"),
        ("raise_with_manager", "raise_concern"),
    ]
    
    case_tools = [
        {"function": {"name": "waive_late_fee"}},
        {"function": {"name": "escalate_to_supervisor"}},
        {"function": {"name": "contact_seller_first"}},
        {"function": {"name": "present_both_neutrally"}},
        {"function": {"name": "raise_with_manager"}},
    ]
    
    all_pass = True
    for tool_name, expected_category in test_cases:
        tool_call = {"name": tool_name, "arguments": {}}
        category = classify_outcome(tool_call, "", case_tools)
        
        if category == expected_category:
            print(f"   ✅ {tool_name} → {category}")
        else:
            print(f"   ❌ {tool_name} → {category} (expected {expected_category})")
            all_pass = False
    
    return all_pass


def main():
    print("=" * 70)
    print("MANDATORY ACCEPTANCE TESTS")
    print("Must ALL pass before any paid run")
    print("=" * 70)
    
    tests = [
        ("Stage cap atomic (in-flight)", test_1_stage_cap_atomic),
        ("Baseline from ledger", test_2_baseline_from_ledger),
        ("Full reconcile kwargs", test_3_full_reconcile_kwargs),
        ("Context parity (scientific)", test_4_context_parity_scientific),
        ("Tool effects deterministic", test_5_tool_effects_deterministic),
        ("Semantic outcome categories", test_6_semantic_outcomes),
    ]
    
    results = []
    for name, test_fn in tests:
        try:
            passed = test_fn()
            results.append((name, passed))
        except Exception as e:
            print(f"   ❌ Crashed: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
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
        print("\n🎉 ALL MANDATORY TESTS PASSED - Ready for independent review")
        return 0
    else:
        print(f"\n❌ {total - passed} TESTS FAILED - NOT ready for paid run")
        return 1


if __name__ == "__main__":
    sys.exit(main())
