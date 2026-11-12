# Ledger Migration Guide

## Purpose

After real box smoke test, the production `ledger.db` was contaminated with mock test data and orphaned reservations from failed Qwen 400 errors. This migration tool cleans the ledger while preserving all real paid API calls.

## What the Migration Does

1. **Backs up** the original `ledger.db` (timestamped)
2. **Marks mock data** as excluded from billable totals (preserves audit trail)
3. **Reconciles orphaned reservations** from 400-rejected calls
4. **Reports billable totals** excluding mock data

## Mock Data Detection

Mock rows are identified by:
- `model_version` contains `-mock`
- `actual_cost_usd` < $0.0001 (suspiciously low for real calls)
- `call_id` patterns from test runs
- `experiment = 'test'`

## Usage

### Audit Only (Safe - No Changes)

```bash
python3 research/tools/migrate_ledger.py research/ledger.db --audit
```

**Output:**
- Real paid calls count and cost
- Mock test calls count and fake cost
- Unreleased reservations

### Dry Run (Preview Changes)

```bash
python3 research/tools/migrate_ledger.py research/ledger.db --backup --dry-run
```

**Output:**
- What would be marked as mock
- Final billable total (after marking)

### Migrate (Real Execution)

```bash
python3 research/tools/migrate_ledger.py research/ledger.db --backup
```

**Actions:**
1. Creates `ledger.db.backup-YYYYMMDD_HHMMSS`
2. Marks contaminated rows with `mock_data=1`
3. Shows before/after billable totals

## Box Smoke Test Migration Example

From real box run:

**Before migration:**
- 70 total rows in ledger
- 30 mock Haiku rows (fake `$0.0008` cost)
- 40 real calls (20 gpt-oss, 20 Gemini, `$0.0472` actual)
- 20 Qwen rows with orphaned reservations (`$0.1914` unreleased)

**After migration:**
```bash
$ python3 research/tools/migrate_ledger.py /workspace/moral-compass/runs/v4-20261108/harness-v3/research/ledger.db --backup

✓ Backup created: ledger.db.backup-20261108_204500

Ledger Analysis:
  Real paid calls: 40 ($0.0472)
  Mock test calls: 30 ($0.0008)

✓ Marked 30 rows as mock_data=1
  (Mock rows excluded from billable totals but preserved for audit)

Sample mock rows:
  scenario_model_0                                    claude-haiku-5-5-mock     $0.000027 test
  scenario_model_1                                    claude-haiku-5-5-mock     $0.000027 test
  ...

✓ Billable total (mock_data=0): 40 calls, $0.0472
```

## Important Notes

1. **No Data Loss**: Mock rows are marked, not deleted. Full audit trail preserved.
2. **Real Calls Safe**: Only marks mock data; never touches real paid API calls.
3. **Billable Totals**: After migration, queries should filter `WHERE mock_data = 0` for accurate costs.
4. **Backup Recommended**: Always use `--backup` flag for production ledgers.

## Query Billable Totals After Migration

```sql
-- Total billable cost (excluding mock data)
SELECT SUM(actual_cost_usd) FROM calls WHERE mock_data = 0;

-- Per-experiment costs (excluding mock)
SELECT experiment, COUNT(*) as calls, SUM(actual_cost_usd) as cost
FROM calls
WHERE mock_data = 0
GROUP BY experiment;
```

## Integration with Tests

All offline tests now use isolated temporary ledgers:
- Tests create `tempfile.TemporaryDirectory()` for ledger paths
- Never write to production `research/ledger.db`
- No mock data contamination from test runs

## Files Modified

- `research/tools/migrate_ledger.py` - Migration utility
- `research/lib/budget.py` - Added `mock_data` and `error` columns to `calls` table
- `research/tests/*.py` - All tests use temp ledgers with explicit `ledger_path` parameter
