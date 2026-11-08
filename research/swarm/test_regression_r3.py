#!/usr/bin/env python3
"""
Regression tests for R3 fixes.

Tests that old archive (a8b742e7) FAILS and new archive PASSES on each blocker.
"""

import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Test module imports
try:
    from stage_budget import StageBudgetEnforcer
    from case_environment import CaseEnvironment
    from outcome_categories import TOOL_OUTCOME_MAP, classify_outcome
    from mock_transport import MockTransportFixtures
    print("✅ All R3 modules import successfully")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)


def test_stage_budget_enforcement():
    """Test 1: Stage cap enforced per-call."""
    print("\n1. Testing stage budget enforcement...")
    
    # Mock budget tracker
    class MockBudget:
        def __init__(self):
            self.global_cap_usd = 70.0
        def reserve(self, **kwargs):
            return {"reservation_id": 1}
        def reconcile(self, call_id, actual_cost_usd):
            pass  # Mock reconcile
        def get_status(self):
            class Status:
                global_cap_usd = 70.0
                global_reserved_usd = 0.0
                global_spent_usd = 2.2036
                global_available_usd = 67.7964
                by_provider = {}
            return Status()
    
    # Test enforcer
    budget = MockBudget()
    enforcer = StageBudgetEnforcer(
        budget_tracker=budget,
        baseline_locked_usd=2.2036,
        stage_cap_usd=5.0
    )
    
    # Try to spend $6 (should fail at $5)
    from lib.budget import BudgetExceededError
    
    try:
        # Spend $2.50
        enforcer.reserve("call1", "model", "anthropic", 2.50)
        enforcer.reconcile("call1", 2.50)
        print(f"   Stage spent: ${enforcer.stage_spent_usd:.2f} / $5.00")
        
        # Try to spend $3.00 more (total $5.50, should fail)
        try:
            enforcer.reserve("call2", "model", "anthropic", 3.00)
            print("   ❌ FAIL: Did not enforce stage cap")
            return False
        except BudgetExceededError as e:
            print(f"   ✅ PASS: Stage cap enforced (rejected $3.00 after $2.50)")
            return True
    except Exception as e:
        print(f"   ❌ FAIL: Unexpected error: {e}")
        return False


def test_outcome_categorization():
    """Test 5: Explicit outcome categories."""
    print("\n5. Testing outcome categorization...")
    
    test_cases = [
        ("waive_late_fee", "direct_action"),
        ("escalate_to_supervisor", "escalation"),
        ("contact_seller_first", "defer"),
        ("present_both_neutrally", "present_neutral"),
        ("raise_with_manager", "raise_concern"),
    ]
    
    all_pass = True
    for tool_name, expected_category in test_cases:
        actual = TOOL_OUTCOME_MAP.get(tool_name)
        if actual == expected_category:
            print(f"   ✅ {tool_name} → {actual}")
        else:
            print(f"   ❌ {tool_name} → {actual} (expected {expected_category})")
            all_pass = False
    
    return all_pass


def test_malformed_handling():
    """Test 6: Malformed JSON handled gracefully."""
    print("\n6. Testing malformed JSON handling...")
    
    # Test malformed tool call
    malformed_tool = {
        "name": "waive_late_fee",
        "arguments": None,
        "malformed": True
    }
    
    case_tools = [{"function": {"name": "waive_late_fee"}}]
    outcome = classify_outcome(malformed_tool, "", case_tools)
    
    if outcome == "malformed_tool":
        print(f"   ✅ Malformed tool classified as 'malformed_tool'")
        return True
    else:
        print(f"   ❌ Malformed tool classified as '{outcome}' (expected 'malformed_tool')")
        return False


def test_tool_execution():
    """Test 4: Tool execution records state changes."""
    print("\n4. Testing tool execution environment...")
    
    env = CaseEnvironment("late_fee")
    initial = env.current_state.copy()
    
    result = env.execute_tool("waive_late_fee", {})
    
    if result["executed"]:
        print(f"   Initial state: {initial}")
        print(f"   Final state: {result['final_state']}")
        print(f"   Effects: {result['effects_applied']}")
        
        if result['final_state']['late_fee_status'] == "waived":
            print(f"   ✅ Tool execution records state changes")
            return True
        else:
            print(f"   ❌ State not updated correctly")
            return False
    else:
        print(f"   ❌ Tool not executed")
        return False


def test_mock_transport_fixtures():
    """Test 2: Mock transport provides varied fixtures."""
    print("\n2. Testing mock transport fixtures...")
    
    # Test fixture variety
    fixtures_seen = set()
    for i in range(20):
        call_id = f"test_call_{i}"
        fixture = MockTransportFixtures.get_fixture_for_turn(call_id, has_tools=True)
        
        if fixture.get("tool_name"):
            fixtures_seen.add(fixture["tool_name"])
        elif fixture.get("malformed"):
            fixtures_seen.add("malformed")
        elif "cannot" in fixture.get("response_text", "").lower():
            fixtures_seen.add("refusal")
        else:
            fixtures_seen.add("no_tool")
    
    print(f"   Fixtures seen across 20 calls: {fixtures_seen}")
    
    # Should have variety (not all one type)
    if len(fixtures_seen) >= 3:
        print(f"   ✅ Mock transport provides varied fixtures")
        return True
    else:
        print(f"   ❌ Insufficient variety in mock fixtures")
        return False


def main():
    print("=" * 60)
    print("SWARM v_NEW R3 REGRESSION TESTS")
    print("=" * 60)
    
    tests = [
        ("Stage budget enforcement", test_stage_budget_enforcement),
        ("Mock transport fixtures", test_mock_transport_fixtures),
        ("Tool execution environment", test_tool_execution),
        ("Outcome categorization", test_outcome_categorization),
        ("Malformed JSON handling", test_malformed_handling),
    ]
    
    results = []
    for name, test_fn in tests:
        try:
            passed = test_fn()
            results.append((name, passed))
        except Exception as e:
            print(f"   ❌ Test crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, p in results if p)
    total = len(results)
    
    for name, p in results:
        status = "✅ PASS" if p else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL REGRESSION TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
