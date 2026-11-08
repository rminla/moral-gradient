#!/usr/bin/env python3
"""Test for budget tracker deadlock fix (reserve + get_status nested access)."""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker
from lib.models import Provider


def test_reserve_no_deadlock():
    """Test that reserve doesn't deadlock when checking budget."""
    print("Testing reserve + status nested access (deadlock fix)...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        # This should NOT deadlock
        reservation = tracker.reserve(
            call_id="test_1",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=2.0
        )
        
        print(f"  ✓ Reserved ${reservation.reserved_usd:.2f} without deadlock")
        
        # Should be able to get status after
        status = tracker.get_status()
        assert status.global_reserved_usd == 2.0
        print(f"  ✓ get_status() works after reserve()")
        
        # Reconcile
        tracker.reconcile(
            call_id="test_1",
            model_version="test",
            prompt_tokens=100,
            completion_tokens=50,
            actual_cost_usd=0.5,
            duration_ms=1000,
            experiment="test"
        )
        
        # Get status again
        status = tracker.get_status()
        assert status.global_spent_usd == 0.5
        assert status.global_reserved_usd == 0.0
        print(f"  ✓ Reconciliation works correctly")
        
        return True


if __name__ == "__main__":
    try:
        test_reserve_no_deadlock()
        print("\n✓ Deadlock test PASSED")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Deadlock test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
