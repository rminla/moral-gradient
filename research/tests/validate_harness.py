#!/usr/bin/env python3
"""
Simple validation script for research harness (no pytest).
Runs basic sanity checks to verify the harness works.
"""

import sys
import tempfile
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import Message, ProviderClient
from lib.models import Provider, verify_model_availability


def test_budget_basic():
    """Test basic budget tracking."""
    print("Testing budget tracker...")
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        # Check initial status
        status = tracker.get_status()
        assert status.global_cap_usd == 10.0
        assert status.global_available_usd == 10.0
        print("  ✓ Initialization")
        
        # Make reservation
        tracker.reserve(
            call_id="test_1",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=2.0
        )
        
        status = tracker.get_status()
        assert status.global_reserved_usd == 2.0
        print("  ✓ Reservation")
        
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
        
        status = tracker.get_status()
        assert status.global_spent_usd == 0.5
        assert status.global_reserved_usd == 0.0
        print("  ✓ Reconciliation")
        
        # Budget exceeded
        try:
            tracker.reserve(
                call_id="test_2",
                model_id="anthropic/claude-haiku-5-5",
                provider=Provider.ANTHROPIC,
                worst_case_usd=20.0
            )
            assert False, "Should have raised BudgetExceededError"
        except BudgetExceededError:
            print("  ✓ Budget cap enforcement")


def test_provider_mock():
    """Test mock provider calls."""
    print("\nTesting mock provider...")
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        client = ProviderClient(
            budget_tracker=tracker,
            experiment="test",
            dry_run=True
        )
        
        # Make mock call
        response = client.call_model(
            call_id="mock_1",
            model_id="anthropic/claude-haiku-5-5",
            messages=[Message(role="user", content="Test")],
            max_tokens=100
        )
        
        assert response.content.startswith("[MOCK RESPONSE")
        assert response.actual_cost_usd > 0
        print("  ✓ Mock call")
        
        # Check cost was tracked
        status = tracker.get_status()
        assert status.global_spent_usd > 0
        print("  ✓ Cost tracking")


def test_model_configs():
    """Test model configurations."""
    print("\nTesting model configs...")
    
    available = verify_model_availability()
    assert len(available) == 4
    print(f"  ✓ Found {len(available)} models")
    
    for model_id, is_available in available.items():
        status = "available" if is_available else "unavailable"
        print(f"    - {model_id}: {status}")


def main():
    print("="*60)
    print("Research Harness Validation")
    print("="*60)
    
    try:
        test_budget_basic()
        test_provider_mock()
        test_model_configs()
        
        print("\n" + "="*60)
        print("✓ ALL VALIDATION CHECKS PASSED")
        print("="*60)
        return 0
    
    except Exception as e:
        print(f"\n✗ VALIDATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
