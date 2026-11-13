#!/usr/bin/env python3
"""Test global ledger SQLite implementation (deviation-4)."""
import json
import sqlite3
import sys
import tempfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "research" / "prereg"))

from global_ledger import GlobalLedger, BudgetExceeded


@pytest.fixture
def temp_ledger():
    """Create a temporary ledger for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_ledger.db"
        yield db_path


def test_ledger_initialization(temp_ledger):
    """Test that ledger initializes with correct schema."""
    ledger = GlobalLedger(temp_ledger, "test_exp", stage_cap_usd=5.0, allow_create=True)
    
    # Verify tables exist
    conn = sqlite3.connect(str(temp_ledger))
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    
    assert "calls" in tables
    assert "reservations" in tables
    
    conn.close()
    print("✓ Ledger initialized with correct schema")


def test_pre_flight_check_passes(temp_ledger):
    """Test pre-flight check passes when budget allows."""
    ledger = GlobalLedger(temp_ledger, "test_exp", stage_cap_usd=10.0, allow_create=True)
    
    # Should pass with empty ledger
    ledger.pre_flight_check()
    
    print("✓ Pre-flight check passes with empty ledger")


def test_pre_flight_check_fails_overspend(temp_ledger):
    """Test pre-flight check fails when committed + cap > $70."""
    # Add some existing spend
    ledger = GlobalLedger(temp_ledger, "existing_exp", stage_cap_usd=50.0, allow_create=True)
    ledger.insert_call(
        call_id="existing_call",
        model_id="test-model",
        provider="test-provider",
        actual_cost_usd=50.0,
    )
    
    # Try to start new experiment that would exceed $70
    ledger2 = GlobalLedger(temp_ledger, "new_exp", stage_cap_usd=25.0, allow_create=True)
    
    with pytest.raises(BudgetExceeded, match="Pre-flight FAILED"):
        ledger2.pre_flight_check()
    
    print("✓ Pre-flight check fails when committed + cap > $70")


def test_reserve_and_insert(temp_ledger):
    """Test reserve before call and insert after."""
    ledger = GlobalLedger(temp_ledger, "test_exp", stage_cap_usd=10.0, allow_create=True)
    
    # Reserve
    ledger.reserve("call_1", "test-model", "test-provider", 0.01)
    
    # Check committed includes reservation
    committed = ledger.get_committed_spend()
    assert committed >= 0.01
    
    # Insert actual call
    ledger.insert_call(
        call_id="call_1",
        model_id="test-model",
        provider="test-provider",
        actual_cost_usd=0.008,
        prompt_tokens=100,
        completion_tokens=50,
    )
    
    # Check committed now includes actual cost, not reservation
    committed_after = ledger.get_committed_spend()
    assert committed_after >= 0.008
    
    # Verify reservation was reconciled
    conn = sqlite3.connect(str(temp_ledger))
    cursor = conn.cursor()
    cursor.execute("SELECT reconciled FROM reservations WHERE call_id = ?", ("call_1",))
    reconciled = cursor.fetchone()[0]
    assert reconciled == 1
    conn.close()
    
    print("✓ Reserve and insert with reconciliation works")


def test_stage_cap_enforcement(temp_ledger):
    """Test that stage cap is enforced."""
    ledger = GlobalLedger(temp_ledger, "test_exp", stage_cap_usd=0.02, allow_create=True)
    
    # First call should succeed
    ledger.reserve("call_1", "test-model", "test-provider", 0.01)
    ledger.insert_call("call_1", "test-model", "test-provider", 0.01, 100, 50)
    
    # Second call would exceed stage cap
    with pytest.raises(BudgetExceeded, match="BUDGET STOP.*stage cap"):
        ledger.reserve("call_2", "test-model", "test-provider", 0.02)
    
    print("✓ Stage cap enforcement works")


def test_global_cap_enforcement(temp_ledger):
    """Test that global $70 cap is enforced."""
    ledger = GlobalLedger(temp_ledger, "test_exp", stage_cap_usd=100.0, allow_create=True)
    
    # Add $69 of spend
    ledger.insert_call("call_1", "test-model", "test-provider", 69.0, 1000, 1000)
    
    # Try to reserve more than remaining
    with pytest.raises(BudgetExceeded, match="BUDGET STOP.*global committed"):
        ledger.reserve("call_2", "test-model", "test-provider", 2.0)
    
    print("✓ Global $70 cap enforcement works")


def test_backup_created(temp_ledger):
    """Test that backup is created before first insert."""
    ledger = GlobalLedger(temp_ledger, "test_exp", stage_cap_usd=10.0, allow_create=True)
    
    # Make first insert (triggers backup)
    ledger.reserve("call_1", "test-model", "test-provider", 0.01)
    
    # Check backup exists
    backup_files = list(temp_ledger.parent.glob("*.backup-*.db"))
    assert len(backup_files) == 1
    
    print(f"✓ Backup created: {backup_files[0].name}")


def test_generate_summary(temp_ledger):
    """Test summary generation matching example format."""
    ledger = GlobalLedger(temp_ledger, "test_exp", stage_cap_usd=10.0, allow_create=True)
    
    # Add some calls
    ledger.insert_call("call_1", "test-model", "test-provider", 1.5, 100, 50)
    ledger.insert_call("call_2", "test-model", "test-provider", 2.3, 150, 75)
    
    # Generate summary
    summary_path = temp_ledger.parent / "summary.json"
    summary = ledger.generate_summary(summary_path)
    
    # Verify structure
    assert summary["ok"] == True
    assert summary["experiment"] == "test_exp"
    assert summary["harness_calls"] == 2
    assert abs(summary["harness_sum"] - 3.8) < 0.001
    assert "after" in summary
    assert abs(summary["after"]["spent"] - 3.8) < 0.001
    assert summary["after"]["committed"] == summary["after"]["spent"] + summary["after"]["open_holds_usd"]
    assert abs(summary["after"]["global_remaining_70"] - (70.0 - summary["after"]["committed"])) < 0.001
    
    # Verify file was written
    assert summary_path.exists()
    written_summary = json.loads(summary_path.read_text())
    assert written_summary == summary
    
    print("✓ Summary generation matches expected format")


def test_multiple_experiments(temp_ledger):
    """Test that multiple experiments can share ledger."""
    # Experiment 1
    ledger1 = GlobalLedger(temp_ledger, "exp1", stage_cap_usd=5.0, allow_create=True)
    ledger1.insert_call("exp1_call", "model1", "provider", 2.0, 100, 50)
    
    # Experiment 2
    ledger2 = GlobalLedger(temp_ledger, "exp2", stage_cap_usd=3.0, allow_create=True)
    ledger2.insert_call("exp2_call", "model2", "provider", 1.5, 100, 50)
    
    # Check committed includes both
    committed = ledger2.get_committed_spend()
    assert abs(committed - 3.5) < 0.001
    
    # Check stage spend is isolated
    stage1 = ledger1.get_stage_spend()
    stage2 = ledger2.get_stage_spend()
    assert abs(stage1 - 2.0) < 0.001
    assert abs(stage2 - 1.5) < 0.001
    
    print("✓ Multiple experiments share ledger correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
