#!/usr/bin/env python3
"""
Integration test: verify budget ledger is incremental across quiz and swarm.
Tests with mocked providers to ensure no paid calls.
"""

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker
from lib.providers import Message, ProviderClient


def test_incremental_ledger():
    """Test that ledger accumulates across experiments."""
    print("Testing incremental ledger across quiz/swarm...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Use single ledger path for all experiments
        ledger_path = Path(tmpdir) / "shared_ledger.db"
        
        # Experiment 1: Quiz
        tracker1 = BudgetTracker(ledger_path, global_cap_usd=10.0)
        client1 = ProviderClient(tracker1, "quiz", dry_run=True)
        
        response1 = client1.call_model(
            call_id="quiz_call_1",
            model_id="anthropic/claude-haiku-5-5",
            messages=[Message(role="user", content="Test quiz")],
            max_tokens=100
        )
        
        status_after_quiz = tracker1.get_status()
        quiz_spent = status_after_quiz.global_spent_usd
        print(f"  After quiz: ${quiz_spent:.6f} spent")
        assert quiz_spent > 0
        
        # Experiment 2: Swarm (same ledger)
        tracker2 = BudgetTracker(ledger_path, global_cap_usd=10.0)
        client2 = ProviderClient(tracker2, "swarm", dry_run=True)
        
        response2 = client2.call_model(
            call_id="swarm_call_1",
            model_id="anthropic/claude-haiku-5-5",
            messages=[Message(role="user", content="Test swarm")],
            max_tokens=100
        )
        
        status_after_swarm = tracker2.get_status()
        total_spent = status_after_swarm.global_spent_usd
        print(f"  After swarm: ${total_spent:.6f} spent")
        
        # Verify ledger accumulated
        assert total_spent == quiz_spent + response2.actual_cost_usd
        
        # Verify per-experiment tracking
        quiz_cost = tracker2.get_experiment_cost("quiz")
        swarm_cost = tracker2.get_experiment_cost("swarm")
        
        print(f"  Quiz total: ${quiz_cost:.6f}")
        print(f"  Swarm total: ${swarm_cost:.6f}")
        
        assert quiz_cost == quiz_spent
        assert swarm_cost == response2.actual_cost_usd
        assert quiz_cost + swarm_cost == total_spent
        
        print("  ✓ Ledger is incremental and accumulates correctly")


def test_no_placeholder_detection():
    """Test that placeholder detection works."""
    print("\nTesting placeholder detection...")
    
    # Test that valid content passes
    cases_path = Path(__file__).parent.parent / "swarm" / "cases.json"
    prompts_path = Path(__file__).parent.parent / "swarm" / "prompts.json"
    
    with open(cases_path) as f:
        cases_content = f.read()
    with open(prompts_path) as f:
        prompts_content = f.read()
    
    if "[TO BE FINALIZED]" in cases_content:
        print("  ✗ FAIL: cases.json still contains placeholders!")
        return False
    
    if "[TO BE FINALIZED]" in prompts_content:
        print("  ✗ FAIL: prompts.json still contains placeholders!")
        return False
    
    print("  ✓ No placeholders found in cases or prompts")
    return True


def main():
    print("="*60)
    print("Integration Test: Incremental Budget & Placeholder Check")
    print("="*60)
    
    try:
        test_incremental_ledger()
        if not test_no_placeholder_detection():
            return 1
        
        print("\n" + "="*60)
        print("✓ ALL INTEGRATION TESTS PASSED")
        print("="*60)
        return 0
    
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
