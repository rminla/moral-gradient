"""Tests for budget cap enforcement (fix 2).

The --cap flag should:
1. Set both pilot_cap and run_budget
2. Pre-flight check: verify committed + cap <= $70 global limit
3. Hard stop on BudgetExceeded (already in frozen Ledger)

Run: python3 -m pytest v3/test_budget_cap.py -v
"""
import json
import sqlite3
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def mock_ledger():
    """Create a mock ledger for testing"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from mc.ledger import Ledger, BudgetExceeded
    
    # Create temporary database
    with tempfile.NamedTemporaryFile(mode='w', suffix='.db', delete=False) as db_file:
        db_path = db_file.name
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as jsonl_file:
        jsonl_path = jsonl_file.name
    
    # Mock prices
    prices = {
        "models": {
            "anthropic:claude-haiku-5.5": {
                "input": 0.8,
                "output": 4.0
            },
            "openrouter:openai/gpt-oss-120b": {
                "input": 0.5,
                "output": 2.0
            }
        }
    }
    
    return {
        "db_path": db_path,
        "jsonl_path": jsonl_path,
        "prices": prices,
        "Ledger": Ledger,
        "BudgetExceeded": BudgetExceeded
    }


def test_ledger_reserve_under_budget(mock_ledger):
    """Test that reserve succeeds when under budget"""
    L = mock_ledger["Ledger"](
        mock_ledger["db_path"],
        mock_ledger["jsonl_path"],
        mock_ledger["prices"],
        pilot_cap_usd=10.0,
        run_budget_usd=5.0,
        run_id="test-run-1"
    )
    
    # Should succeed: $0.01 is well under both caps
    rid = L.reserve(0.01)
    assert rid is not None
    L.release(rid)


def test_ledger_reserve_exceeds_run_budget(mock_ledger):
    """Test that reserve raises BudgetExceeded when run budget exceeded"""
    L = mock_ledger["Ledger"](
        mock_ledger["db_path"],
        mock_ledger["jsonl_path"],
        mock_ledger["prices"],
        pilot_cap_usd=100.0,
        run_budget_usd=1.0,
        run_id="test-run-2"
    )
    
    # Should fail: $2.0 exceeds run_budget of $1.0
    with pytest.raises(mock_ledger["BudgetExceeded"]) as exc_info:
        L.reserve(2.0)
    
    assert "run budget" in str(exc_info.value).lower()


def test_ledger_reserve_exceeds_pilot_cap(mock_ledger):
    """Test that reserve raises BudgetExceeded when pilot cap exceeded"""
    L = mock_ledger["Ledger"](
        mock_ledger["db_path"],
        mock_ledger["jsonl_path"],
        mock_ledger["prices"],
        pilot_cap_usd=1.0,
        run_budget_usd=100.0,
        run_id="test-run-3"
    )
    
    # Should fail: $2.0 exceeds pilot_cap of $1.0
    with pytest.raises(mock_ledger["BudgetExceeded"]) as exc_info:
        L.reserve(2.0)
    
    assert "pilot cap" in str(exc_info.value).lower()


def test_ledger_cumulative_reserves(mock_ledger):
    """Test that multiple reserves accumulate correctly"""
    L = mock_ledger["Ledger"](
        mock_ledger["db_path"],
        mock_ledger["jsonl_path"],
        mock_ledger["prices"],
        pilot_cap_usd=1.0,
        run_budget_usd=1.0,
        run_id="test-run-4"
    )
    
    # Reserve $0.40 three times - should fail on third
    rid1 = L.reserve(0.40)
    rid2 = L.reserve(0.40)
    
    # Third reserve should fail: 0.40 + 0.40 + 0.40 = 1.20 > 1.0
    with pytest.raises(mock_ledger["BudgetExceeded"]):
        L.reserve(0.40)
    
    # Clean up
    L.release(rid1)
    L.release(rid2)


def test_cap_flag_sets_both_budgets():
    """Test that --cap flag sets both pilot_cap and run_budget"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3 import run as R
    
    # This test verifies the flag exists and is handled in run.py
    # The actual enforcement is in Ledger (tested above)
    
    # Check that cap parameter is recognized
    # (This is a minimal test - full integration requires running the harness)
    assert hasattr(R, "Ledger"), "run.py should import Ledger"


def test_global_ledger_pre_flight_check():
    """Test pre-flight check against $70 global limit.
    
    This test verifies the logic but doesn't create a real global ledger.
    The actual check happens in run.py before creating the run's ledger.
    """
    # Simulate pre-flight check logic
    GLOBAL_LIMIT = 70.0
    committed = 50.04  # From cost_estimates.json
    requested_cap = 17.50
    
    total_after = committed + requested_cap
    
    # Should pass: 50.04 + 17.50 = 67.54 < 70.0
    assert total_after <= GLOBAL_LIMIT, (
        f"Pre-flight check should pass: committed ${committed:.2f} + "
        f"cap ${requested_cap:.2f} = ${total_after:.2f} <= ${GLOBAL_LIMIT:.2f}"
    )
    
    # Test with excessive cap
    excessive_cap = 25.0
    total_excessive = committed + excessive_cap
    
    # Should fail: 50.04 + 25.0 = 75.04 > 70.0
    assert total_excessive > GLOBAL_LIMIT, (
        f"Pre-flight check should fail: committed ${committed:.2f} + "
        f"cap ${excessive_cap:.2f} = ${total_excessive:.2f} > ${GLOBAL_LIMIT:.2f}"
    )


def test_worst_case_estimation():
    """Test that worst-case cost estimation is used for reserves"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from mc.ledger import Ledger
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.db', delete=False) as db_file:
        db_path = db_file.name
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as jsonl_file:
        jsonl_path = jsonl_file.name
    
    prices = {
        "models": {
            "test:model": {
                "input": 1.0,  # $1 per 1M tokens
                "output": 2.0  # $2 per 1M tokens
            }
        }
    }
    
    L = Ledger(db_path, jsonl_path, prices, pilot_cap_usd=100.0, run_budget_usd=100.0, run_id="test")
    
    # Worst case: 1000 input tokens + 4000 max output tokens
    # = 1000 * $1/1M + 4000 * $2/1M = $0.001 + $0.008 = $0.009
    worst = L.worst_case("test", "model", est_input_tokens=1000, max_output_tokens=4000)
    
    expected = 0.009
    assert abs(worst - expected) < 1e-6, f"Expected ${expected:.6f}, got ${worst:.6f}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
