"""Tests for budget tracking system."""

import sqlite3
import tempfile
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.models import Provider


def test_budget_initialization():
    """Test budget tracker initialization."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=100.0)
        
        # Check initial status
        status = tracker.get_status()
        assert status.global_cap_usd == 100.0
        assert status.global_reserved_usd == 0.0
        assert status.global_spent_usd == 0.0
        assert status.global_available_usd == 100.0


def test_reservation():
    """Test atomic budget reservation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        # Reserve budget
        reservation = tracker.reserve(
            call_id="test_call_1",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=2.0
        )
        
        assert reservation.call_id == "test_call_1"
        assert reservation.reserved_usd == 2.0
        
        # Check status
        status = tracker.get_status()
        assert status.global_reserved_usd == 2.0
        assert status.global_available_usd == 8.0


def test_budget_exceeded():
    """Test budget cap enforcement."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=5.0)
        
        # First reservation succeeds
        tracker.reserve(
            call_id="test_call_1",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=3.0
        )
        
        # Second reservation would exceed cap
        with pytest.raises(BudgetExceededError):
            tracker.reserve(
                call_id="test_call_2",
                model_id="anthropic/claude-haiku-5-5",
                provider=Provider.ANTHROPIC,
                worst_case_usd=3.0
            )


def test_reconciliation():
    """Test reconciling reservation with actual usage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        # Reserve
        tracker.reserve(
            call_id="test_call_1",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=2.0
        )
        
        # Reconcile with actual usage (lower than reserved)
        tracker.reconcile(
            call_id="test_call_1",
            model_version="claude-haiku-5-5-20261007",
            prompt_tokens=100,
            completion_tokens=50,
            actual_cost_usd=0.5,
            duration_ms=1000,
            experiment="test"
        )
        
        # Check status
        status = tracker.get_status()
        assert status.global_reserved_usd == 0.0  # Reconciled
        assert status.global_spent_usd == 0.5
        assert status.global_available_usd == 9.5


def test_idempotency():
    """Test that duplicate call_ids are rejected."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        # First reservation
        tracker.reserve(
            call_id="test_call_1",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=1.0
        )
        
        # Duplicate reservation should fail
        with pytest.raises(ValueError, match="already reserved"):
            tracker.reserve(
                call_id="test_call_1",
                model_id="anthropic/claude-haiku-5-5",
                provider=Provider.ANTHROPIC,
                worst_case_usd=1.0
            )
        
        # Reconcile
        tracker.reconcile(
            call_id="test_call_1",
            model_version="test",
            prompt_tokens=100,
            completion_tokens=50,
            actual_cost_usd=0.3,
            duration_ms=1000,
            experiment="test"
        )
        
        # After reconciliation, check_call_exists should return True
        assert tracker.check_call_exists("test_call_1")


def test_per_provider_tracking():
    """Test per-provider budget breakdown."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=20.0)
        
        # Reserve from different providers
        tracker.reserve(
            call_id="anthropic_call",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=3.0
        )
        
        tracker.reserve(
            call_id="groq_call",
            model_id="groq/openai/gpt-oss-120b",
            provider=Provider.GROQ,
            worst_case_usd=2.0
        )
        
        # Check per-provider status
        status = tracker.get_status()
        assert "anthropic" in status.by_provider
        assert "groq" in status.by_provider
        assert status.by_provider["anthropic"]["reserved_usd"] == 3.0
        assert status.by_provider["groq"]["reserved_usd"] == 2.0


def test_experiment_cost_tracking():
    """Test tracking costs by experiment."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=20.0)
        
        # Make calls for different experiments
        for exp in ["quiz", "swarm"]:
            for i in range(2):
                call_id = f"{exp}_call_{i}"
                tracker.reserve(
                    call_id=call_id,
                    model_id="anthropic/claude-haiku-5-5",
                    provider=Provider.ANTHROPIC,
                    worst_case_usd=1.0
                )
                tracker.reconcile(
                    call_id=call_id,
                    model_version="test",
                    prompt_tokens=100,
                    completion_tokens=50,
                    actual_cost_usd=0.3,
                    duration_ms=1000,
                    experiment=exp
                )
        
        # Check experiment costs
        quiz_cost = tracker.get_experiment_cost("quiz")
        swarm_cost = tracker.get_experiment_cost("swarm")
        
        assert quiz_cost == 0.6  # 2 × 0.3
        assert swarm_cost == 0.6


def test_sequential_reservations():
    """Test that budget frees up after reconciliation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=5.0)
        
        # Reserve most of budget
        tracker.reserve(
            call_id="call_1",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=4.5
        )
        
        # Can't reserve more
        with pytest.raises(BudgetExceededError):
            tracker.reserve(
                call_id="call_2",
                model_id="anthropic/claude-haiku-5-5",
                provider=Provider.ANTHROPIC,
                worst_case_usd=1.0
            )
        
        # Reconcile first call (actual usage much lower)
        tracker.reconcile(
            call_id="call_1",
            model_version="test",
            prompt_tokens=100,
            completion_tokens=50,
            actual_cost_usd=0.5,
            duration_ms=1000,
            experiment="test"
        )
        
        # Now we can reserve again
        tracker.reserve(
            call_id="call_2",
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=3.0
        )
        
        status = tracker.get_status()
        assert status.global_spent_usd == 0.5
        assert status.global_reserved_usd == 3.0
        assert status.global_available_usd == 1.5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
