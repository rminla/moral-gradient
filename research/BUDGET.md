# Budget Management - Critical Information

## Absolute Shared Ledger Limit: $70 USD

**IMPORTANT**: The `--budget-cap` argument is the **absolute shared limit** across ALL experiments, retries, and grading using the same ledger database.

### Ledger is Incremental and Shared

The `research/ledger.db` file accumulates costs across:
- Quiz comparison runs
- Swarm experiment runs  
- Any retries or re-runs
- Future grading passes (if implemented)

**The ledger is NEVER reset between experiments** unless you explicitly delete `ledger.db`.

### Budget Cap Recommendations

For approved $70 total budget:

```bash
# 1. Quiz first (validates infrastructure)
python3 quiz/run_quiz.py --budget-cap 70.00
# After quiz completes: ~$1.30-4.00 spent, ~$66-68.70 remaining

# 2. Optional: Small swarm smoke test
python3 swarm/run_swarm.py --config swarm/config_test.json --budget-cap 70.00
# After smoke: ~$2-6 total spent, ~$64-68 remaining

# 3. Main swarm experiment
python3 swarm/run_swarm.py --budget-cap 70.00
# Will stop if total (quiz + smoke + swarm) would exceed $70
```

### How Budget Cap Works

Each run checks the **current total spent** in `ledger.db` before making calls:

1. **Before quiz**: Ledger empty, $0 spent → $70 available
2. **Before swarm**: Ledger has quiz costs → $70 - quiz_spent available
3. **During execution**: Each call reserves worst-case, reconciles actual
4. **Hard stop**: Execution stops if next reservation would exceed cap

### Checking Current Spend

```bash
# Total spent so far
sqlite3 ledger.db "SELECT SUM(actual_cost_usd) as total FROM calls"

# Per-experiment breakdown
sqlite3 ledger.db "SELECT experiment, SUM(actual_cost_usd) as cost FROM calls GROUP BY experiment"

# Available budget (manual calculation)
# available = 70.00 - total_spent
```

### Budget Cap is NOT Per-Experiment

**WRONG**: "Run quiz with $5 cap, then swarm with $65 cap" (would allow $70 total)  
**CORRECT**: "Run everything with $70 cap" (stops at $70 cumulative)

The `--budget-cap` value should be set to your **total approved budget** ($70) for all runs using the same ledger.

### Resetting the Ledger

If you need to start fresh (e.g., after failed runs):

```bash
# Delete the ledger (destroys all cost history)
rm research/ledger.db

# Now first run starts from $0 again
```

**Warning**: Only do this if you're certain no legitimate costs need accounting.

### Per-Run Sub-Caps (Advanced)

If you want different limits per experiment, you must track manually:

```bash
# Quiz with effective $5 sub-cap
python3 quiz/run_quiz.py --budget-cap 5.00
# Stops at $5

# Then swarm with remaining budget
QUIZ_SPENT=$(sqlite3 ledger.db "SELECT SUM(actual_cost_usd) FROM calls WHERE experiment='quiz'")
REMAINING=$(python3 -c "print(70.00 - $QUIZ_SPENT)")
python3 swarm/run_swarm.py --budget-cap $REMAINING
```

But this is more complex and error-prone. **Recommended**: Use $70 cap for all runs.

### Safety Guarantees

- ✅ Atomic worst-case reservation before each call
- ✅ Stops immediately if cap would be exceeded
- ✅ No concurrent runs can exceed cap (SQLite locks)
- ✅ Idempotent calls (no duplicate charges)
- ✅ Checkpoint/resume preserves budget tracking

### Common Mistakes

❌ Setting `--budget-cap 5` for quiz then `--budget-cap 65` for swarm
   → Second run would stop immediately (total already over 5)

❌ Expecting ledger to reset between runs
   → Ledger accumulates until you delete it

❌ Running multiple experiments in parallel with same ledger
   → SQLite handles concurrency but cap applies to combined total

✅ Use `--budget-cap 70.00` for all runs
✅ Check `ledger.db` total before each run
✅ Delete `ledger.db` only when starting completely fresh
