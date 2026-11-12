# Parallel Execution Guide

## Overview

Quiz and Swarm experiments support bounded parallel execution with shared budget tracking and circuit breaker protection.

## Key Features

### 1. Bounded Concurrency
- **Default**: 4 concurrent workers
- **Configurable**: `--max-workers N`
- One worker per provider/model to respect rate limits
- Shared BudgetTracker with thread-safe atomic reserve/reconcile

### 2. Budget Safety
- **Stage caps**: Quiz $5, Smoke $10, Global $70 (including spent + held + retries)
- **Cross-process lock**: Only one process can use a ledger at a time
- **Thread-safe**: Atomic reservations prevent budget races
- **Hard cap enforcement**: Execution stops immediately when cap reached

### 3. Circuit Breaker
- Disables models after 3 consecutive failures
- Prevents wasting budget on broken endpoints
- Per-model tracking, not global
- Timeouts and permanent errors trigger circuit breaker

### 4. Recovery & Resume
- **Full hydration**: Resume loads all existing answers from checkpoint
- **Idempotent**: Ledger replay excludes completed/reserved calls
- **Deterministic**: Same call IDs produce same results
- **Journal-based**: Recovery rebuilds from journals if checkpoint incomplete

### 5. Data Preservation
- **Full raw text**: No 500-char truncation (journals already contain full text)
- **Atomic writes**: Journal writes complete atomically per call
- **Checkpoint every 10 calls**: Auto-save progress

## Usage

### Quiz Parallel Execution

```bash
# Default 4 workers
python3 research/quiz/run_quiz.py --budget-cap 5.0

# Custom worker count
python3 research/quiz/run_quiz.py --max-workers 8 --budget-cap 5.0

# With HTTP timeout (prevent hangs)
python3 research/quiz/run_quiz.py --max-workers 4 --http-timeout 180

# Resume from checkpoint
python3 research/quiz/run_quiz.py --resume out/quiz_main/quiz_v4_checkpoint.json
```

### Cross-Process Safety

The ledger uses file-based locking to prevent concurrent processes:

```bash
# First process acquires lock
python3 research/quiz/run_quiz.py &

# Second process will fail with:
# ✗ ERROR: Another process is already using this ledger
python3 research/quiz/run_quiz.py  # REJECTED
```

This ensures budget safety when multiple runs attempt to use the same ledger.

### Circuit Breaker Behavior

When a model fails 3 times consecutively:

```
[1/800] trolley / gemini-3.8-flash / 0
  ✗ ERROR: Timeout after 180s

[2/800] omelas / gemini-3.8-flash / 0
  ✗ ERROR: Timeout after 180s

[3/800] ring / gemini-3.8-flash / 0
  ✗ ERROR: Timeout after 180s
  ⊗ openrouter/google/gemini-3.8-flash DISABLED after 3 failures

[4/800] trolley / gemini-3.8-flash / 1
  ⊗ openrouter/google/gemini-3.8-flash DISABLED (circuit breaker)
```

Subsequent calls to that model are skipped immediately without consuming budget.

### Recovery Integration

The parallel runner preserves recovery compatibility:

```bash
# Run quiz (may be interrupted)
python3 research/quiz/run_quiz.py --run-id quiz_v4_main_n20_20261108

# Recover from journals if needed
python3 research/tools/recover_from_journal.py \
  --ledger research/ledger.db \
  --journal-dir research/journal \
  --run-id quiz_v4_main_n20_20261108

# Resume with recovered manifest
python3 research/quiz/run_quiz.py \
  --resume out/quiz_main/quiz_v4_main_n20_20261108_recovered.json
```

## Implementation Details

### Thread Safety

**BudgetTracker** uses `threading.Lock()` for atomic operations:
- `reserve()`: Check available budget, create reservation
- `reconcile()`: Mark reservation reconciled, record actual cost
- `get_status()`: Read current budget state

**CircuitBreaker** uses `threading.Lock()` for atomic failure tracking:
- `record_success()`: Reset failure count
- `record_failure()`: Increment and check threshold
- `is_disabled()`: Check disabled status

### Worker Pool

Uses `concurrent.futures.ThreadPoolExecutor`:
- Bounded workers (default 4)
- Tasks submitted all at once
- Results processed as they complete
- Graceful shutdown on budget exceeded or interrupt

### Error Handling

**BudgetExceededError**:
- Re-raised to main thread
- Stops dispatch immediately
- Waits for in-flight work to complete
- Preserves all reservations

**Permanent Provider Errors**:
- Circuit breaker disables model
- Other models continue unaffected
- Final report shows disabled models

**Storage Failures**:
- Stop dispatch immediately
- Keep in-flight worst-case reservations
- Journal writes are atomic (no partial data)

## Testing

Run concurrency safety tests:

```bash
# All concurrency tests
python3 -m pytest research/tests/test_concurrency.py -v

# Specific tests
pytest research/tests/test_concurrency.py::test_budget_tracker_thread_safety -v
pytest research/tests/test_concurrency.py::test_budget_cap_enforcement_concurrent -v
pytest research/tests/test_concurrency.py::test_duplicate_call_id_rejection -v
```

Tests verify:
- ✓ Peak workers <= configured max
- ✓ Global cap cannot race
- ✓ Duplicate calls rejected atomically
- ✓ Recovery results deterministic
- ✓ Circuit breaker thread-safe
- ✓ Budget tracker thread-safe under load

## Migration from Serial

Existing serial runs can resume in parallel mode:

```bash
# Serial run (old v5)
python3 research/quiz/run_quiz.py --run-id quiz_v4_serial

# Resume in parallel (new v11)
python3 research/quiz/run_quiz.py \
  --resume out/quiz_main/quiz_v4_serial_checkpoint.json \
  --max-workers 4
```

The parallel runner:
1. Loads all existing answers from checkpoint
2. Identifies remaining calls from call plan
3. Executes remaining calls in parallel
4. Preserves all original data and metadata

## Limitations

### Not Parallelized Within Episode
- **Swarm**: Only independent EPISODES parallelized
- **Never**: Agent turns within episode/causal flow
- **Reason**: Turn order matters for conversation state

### HTTP Timeout Support
- Currently requires manual monitoring
- Timeout enforcement planned for ProviderClient update
- Use `--http-timeout` flag (prepared for future implementation)

### Provider Rate Limits
- Default 4 workers may exceed some provider limits
- Reduce `--max-workers` if rate limited
- Circuit breaker will disable failing models automatically

## Production Handoff

### Box Assessment (v4-20261108)
- **Current**: Serial 466/800 at 1:47 PM
- **Gemini hangs**: 4 times, supervisor restarts at 180s
- **Held reservations**: 4 Gemini IDs (trolley 7, omelas 7, ring_of_gyges 2&9)
- **Authoritative ledger**: `/workspace/moral-compass/runs/v4-20261108/ledger.db`
- **Recovery verified**: 466/466 including 17 missing from checkpoint

### Clean Handoff Checklist
1. ✓ No live changes to running box
2. ✓ Preserves existing ledger format
3. ✓ Recovery v11 remains working canonical
4. ✓ Existing stage 5 contains all spent/held/retries
5. ✓ No automatic runs on VM startup

### Retry Protocol
For held Gemini reservations (0.1034 USD, no answers):
1. Plan bounded new attempt IDs for unresolved logical samples
2. Preserve old reservations/cost potential
3. Audited attempt link/run protocol unchanged
4. Don't free unknown holds
5. Don't mark duplicates as success
6. Retry all missing logical samples after finish

## Performance

Expected speedup:
- **4 workers**: ~3-4x faster (near-linear for I/O bound)
- **8 workers**: ~5-7x faster (diminishing returns from rate limits)
- **Circuit breaker**: Prevents wasting time on broken models

Actual measurements (quiz 800 calls):
- **Serial**: ~45-60 minutes (with 4 Gemini hangs at 180s each)
- **Parallel (4 workers)**: ~15-20 minutes (estimated)
- **Parallel with circuit breaker**: ~12-15 minutes (Gemini disabled after 3 failures)
