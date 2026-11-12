"""Test parallel execution safety and correctness."""

import json
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import pytest

from lib.budget import BudgetTracker
from lib.models import Provider
from quiz.run_quiz import CircuitBreaker


def test_circuit_breaker():
    """Test circuit breaker disables models after consecutive failures."""
    cb = CircuitBreaker(max_failures=3)
    
    model = "test/model"
    
    # Should not be disabled initially
    assert not cb.is_disabled(model)
    
    # Record failures
    assert not cb.record_failure(model)  # 1st failure
    assert not cb.record_failure(model)  # 2nd failure
    assert cb.record_failure(model)      # 3rd failure -> disabled
    
    # Now should be disabled
    assert cb.is_disabled(model)
    assert model in cb.get_disabled()
    
    # Success should not re-enable (once disabled, stays disabled)
    cb.record_success(model)
    assert cb.is_disabled(model)


def test_circuit_breaker_reset_on_success():
    """Test circuit breaker resets failure count on success."""
    cb = CircuitBreaker(max_failures=3)
    
    model = "test/model"
    
    # 2 failures, then success
    cb.record_failure(model)
    cb.record_failure(model)
    cb.record_success(model)
    
    # Should reset count, so 3 more failures needed
    cb.record_failure(model)
    cb.record_failure(model)
    assert not cb.is_disabled(model)
    cb.record_failure(model)
    assert cb.is_disabled(model)


def test_circuit_breaker_thread_safety():
    """Test circuit breaker is thread-safe."""
    cb = CircuitBreaker(max_failures=10)
    
    model = "test/model"
    failure_count = 0
    lock = threading.Lock()
    
    def record_failures(n):
        nonlocal failure_count
        for _ in range(n):
            cb.record_failure(model)
            with lock:
                failure_count += 1
    
    # Run 5 threads each recording 3 failures = 15 total
    threads = [threading.Thread(target=record_failures, args=(3,)) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    
    # Should have disabled after 10 failures
    assert cb.is_disabled(model)
    assert failure_count == 15


def test_budget_tracker_thread_safety():
    """Test BudgetTracker reserve/reconcile is thread-safe under concurrent load."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ledger_path = Path(tmpdir) / "ledger.db"
        budget = BudgetTracker(ledger_path, 10.0)
        
        errors = []
        success_count = threading.Event()
        success_count.value = 0
        lock = threading.Lock()
        
        def worker(worker_id):
            try:
                for i in range(5):
                    call_id = f"worker_{worker_id}_call_{i}"
                    
                    # Reserve
                    budget.reserve(
                        call_id=call_id,
                        model_id="test/model",
                        provider=Provider.ANTHROPIC,
                        worst_case_usd=0.1
                    )
                    
                    # Simulate work
                    time.sleep(0.001)
                    
                    # Reconcile
                    budget.reconcile(
                        call_id=call_id,
                        model_version="v1",
                        prompt_tokens=100,
                        completion_tokens=50,
                        actual_cost_usd=0.05,
                        duration_ms=100,
                        experiment="test"
                    )
                    
                    with lock:
                        success_count.value += 1
                        
            except Exception as e:
                errors.append(str(e))
        
        # Run 10 workers each making 5 calls = 50 total calls
        # Total cost: 50 * 0.05 = 2.50 (well under 10.0 cap)
        workers = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for w in workers:
            w.start()
        for w in workers:
            w.join()
        
        # Verify no errors
        assert not errors, f"Errors occurred: {errors}"
        assert success_count.value == 50
        
        # Verify ledger integrity
        status = budget.get_status()
        assert status.global_spent_usd == 2.50
        assert status.global_reserved_usd == 0.0  # All reconciled
        
        # Verify no duplicate call_ids in database
        with budget._get_conn() as conn:
            call_ids = conn.execute("SELECT call_id FROM calls").fetchall()
            assert len(call_ids) == 50
            assert len(set(r['call_id'] for r in call_ids)) == 50  # All unique


def test_budget_cap_enforcement_concurrent():
    """Test budget cap is strictly enforced under concurrent load."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ledger_path = Path(tmpdir) / "ledger.db"
        cap = 1.0
        budget = BudgetTracker(ledger_path, cap)
        
        reservation_attempts = 0
        reservations_succeeded = 0
        budget_exceeded_errors = 0
        lock = threading.Lock()
        
        def worker(worker_id):
            nonlocal reservation_attempts, reservations_succeeded, budget_exceeded_errors
            
            for i in range(20):
                call_id = f"worker_{worker_id}_call_{i}"
                
                with lock:
                    reservation_attempts += 1
                
                try:
                    # Try to reserve 0.1 (can fit ~10 concurrent)
                    budget.reserve(
                        call_id=call_id,
                        model_id="test/model",
                        provider=Provider.ANTHROPIC,
                        worst_case_usd=0.1
                    )
                    
                    with lock:
                        reservations_succeeded += 1
                    
                    # Simulate work
                    time.sleep(0.01)
                    
                    # Reconcile (lower actual cost)
                    budget.reconcile(
                        call_id=call_id,
                        model_version="v1",
                        prompt_tokens=100,
                        completion_tokens=50,
                        actual_cost_usd=0.05,
                        duration_ms=100,
                        experiment="test"
                    )
                    
                except Exception as e:
                    if "exceed budget cap" in str(e):
                        with lock:
                            budget_exceeded_errors += 1
                    else:
                        raise
        
        # Run 5 workers each attempting 20 calls = 100 attempts
        # Cap is 1.0, so only ~10-20 should succeed depending on timing
        workers = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
        for w in workers:
            w.start()
        for w in workers:
            w.join()
        
        print(f"\nAttempts: {reservation_attempts}")
        print(f"Succeeded: {reservations_succeeded}")
        print(f"Budget exceeded: {budget_exceeded_errors}")
        
        # Verify budget never exceeded
        status = budget.get_status()
        print(f"Final spent: ${status.global_spent_usd:.4f}")
        print(f"Final reserved: ${status.global_reserved_usd:.4f}")
        print(f"Final available: ${status.global_available_usd:.4f}")
        
        # Total spent + reserved should never exceed cap
        assert status.global_spent_usd + status.global_reserved_usd <= cap
        
        # Should have some budget exceeded errors
        assert budget_exceeded_errors > 0


def test_duplicate_call_id_rejection():
    """Test that duplicate call_ids are rejected atomically."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ledger_path = Path(tmpdir) / "ledger.db"
        budget = BudgetTracker(ledger_path, 10.0)
        
        call_id = "duplicate_test"
        
        errors = []
        success_count = threading.Event()
        success_count.value = 0
        lock = threading.Lock()
        
        def worker(worker_id):
            try:
                # All workers try to reserve same call_id
                budget.reserve(
                    call_id=call_id,
                    model_id="test/model",
                    provider=Provider.ANTHROPIC,
                    worst_case_usd=0.1
                )
                
                with lock:
                    success_count.value += 1
                    
            except ValueError as e:
                # Expected: duplicate rejection
                if "already" in str(e).lower():
                    pass  # Expected
                else:
                    errors.append(str(e))
            except Exception as e:
                errors.append(str(e))
        
        # Run 10 workers all trying to reserve same call_id
        workers = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for w in workers:
            w.start()
        for w in workers:
            w.join()
        
        # Verify no unexpected errors
        assert not errors, f"Unexpected errors: {errors}"
        
        # Only ONE should succeed
        assert success_count.value == 1


def test_cross_process_lock():
    """Test that second process cannot acquire lock while first holds it."""
    import subprocess
    
    with tempfile.TemporaryDirectory() as tmpdir:
        ledger_path = Path(tmpdir) / "ledger.db"
        
        # Create a script that acquires lock and sleeps
        lock_script = Path(tmpdir) / "hold_lock.py"
        lock_script.write_text("""
import sys
import time

# Add research to path
sys.path.insert(0, '/agent/repos/moral-gradient/research')
sys.path.insert(0, '/agent/repos/moral-gradient')

try:
    from pathlib import Path
    from quiz.run_quiz import acquire_process_lock
    
    ledger_path = Path(sys.argv[1])
    lock_file = acquire_process_lock(ledger_path)
    
    if lock_file:
        sys.stdout.write("ACQUIRED\\n")
        sys.stdout.flush()
        time.sleep(2)  # Hold lock for 2 seconds
        lock_file.close()
        sys.stdout.write("RELEASED\\n")
        sys.stdout.flush()
        sys.exit(0)
    else:
        sys.stdout.write("BLOCKED\\n")
        sys.stdout.flush()
        sys.exit(1)
except Exception as e:
    sys.stderr.write(f"ERROR: {e}\\n")
    sys.stderr.flush()
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(2)
""")
        
        # Start first process
        proc1 = subprocess.Popen(
            [sys.executable, str(lock_script), str(ledger_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for first process to acquire lock
        time.sleep(0.2)
        
        # Try to acquire with second process (should fail)
        proc2 = subprocess.Popen(
            [sys.executable, str(lock_script), str(ledger_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for both to complete
        out1, err1 = proc1.communicate(timeout=5)
        out2, err2 = proc2.communicate(timeout=5)
        
        print(f"\nProcess 1 output: {out1}")
        print(f"Process 2 output: {out2}")
        
        # First should succeed, second should be blocked
        assert "ACQUIRED" in out1
        assert "RELEASED" in out1
        assert "BLOCKED" in out2
        assert proc1.returncode == 0
        assert proc2.returncode == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
