# Publishing New Drift Data

This document explains how to add a new drift experiment suite to the site.

## Overview

The `/drift` page is fully data-driven:
- **Numbers** are generated from `research-data/drift/` bundles
- **Claims** (interpretive text) are in `content/drift-claims.json` with machine-checked conditions
- The page renders only from `data/drift.json` (generated) and `drift-claims.json`

No numbers or claim text are hardcoded in the page TSX.

## Adding a New Suite

### 1. Drop the Bundle In

Place the new suite bundle in `research-data/drift/YYYYMMDD/`:
- `graded.jsonl` - One row per graded decision
- `runs.json` - Run metadata (dates, costs, stop reasons, etc.)
- `published_quotes.json` - Verbatim quote sources
- `README.md` - Bundle documentation
- `compute_check.py` - Python checker (for validation)

Files must remain byte-identical to the authoritative bundle.

### 2. Add to Index

Edit `research-data/drift/index.json`:

```json
{
  "suites": [
    "20261110",
    "YYYYMMDD"
  ]
}
```

The generator processes suites in order. If multiple suites exist, decide whether to:
- Keep only the new one
- Pool data across suites
- Show the most recent

Currently the generator uses the last suite in the list.

### 3. Build

Run the generator:

```bash
npm run prebuild  # or: node scripts/build-drift-data.mjs
```

This:
1. Reads all suites in the index
2. Computes counts, accuracy, Fisher exact, McNemar exact
3. Validates all claims in `content/drift-claims.json` against generated data
4. Writes `data/drift.json`

If any claim's `requires` conditions fail, the build fails with a clear message naming the claim and showing the conflicting numbers.

### 4. Test

```bash
npm test
```

This validates the generated numbers against expected values from `compute_check.py`.

### 5. If a Claim Fails

When the generator reports a claim validation failure:

1. **Review the numbers**: Are they correct? Run `python3 research-data/drift/YYYYMMDD/compute_check.py` to verify.

2. **Check the claim**: Does it still hold with the new data? For example, if Qwen alone skip rate is no longer > team skip rate, the claim is outdated.

3. **Draft new wording**: Update `content/drift-claims.json`:
   - Change the `text` to match the new data
   - Update `requires` conditions
   - Update `approved_on` to the review date
   - Update `approved_suite` to the new suite ID

4. **Get approval**: Claims with interpretive weight should be reviewed before publishing.

5. **Rebuild**: Once claims are updated, the build succeeds.

## Claim Structure

Each claim in `content/drift-claims.json` has:

```json
{
  "text": "The claim text, shown on the page",
  "requires": [
    {
      "metric": "skipRate",
      "experiment": "r9-1",
      "model": "gpt-oss-120b",
      "condition": "alone",
      "op": ">",
      "value": 0.05
    },
    {
      "left": { "metric": "skipRate", "experiment": "r9-1", "model": "gpt-oss-120b", "condition": "alone" },
      "op": ">",
      "right": { "metric": "skipRate", "experiment": "r9-1", "model": "gpt-oss-120b", "condition": "team" }
    }
  ]
}
```

**Metrics**:
- `skipRate`: skipped / total
- `skipCount`: number of skipped decisions
- `accuracy`: correct / total
- `fisherP`: Fisher exact p-value

**Operators**: `>`, `<`, `>=`, `<=`, `==`

The generator evaluates every condition. If any fail, the build stops.

## What Gets Regenerated

**On every build** (`npm run prebuild`):
- `data/drift.json` - All numbers, metadata, quotes

**Manual update needed**:
- `content/drift-claims.json` - Claims and their conditions
- `app/drift/page.tsx` - Layout and presentation (reads from JSON, no hardcoded data)

## Testing Locally

```bash
# Generate data
node scripts/build-drift-data.mjs

# Run tests
node scripts/test-drift-data.mjs

# Build the site
npm run build

# Start dev server
npm run dev
```

Visit `http://localhost:3000/drift` to preview.

## Verifying Numbers

To confirm generated numbers match the research analysis:

```bash
cd research-data/drift/YYYYMMDD
python3 compute_check.py
```

This prints every number and compares against published baselines. The generator must match these values to 3 significant figures.

## Troubleshooting

**Build fails with "Claim validation failed"**:
- A claim's conditions don't match the new data
- Review the error output (shows claim, condition, and values)
- Update the claim or investigate the data discrepancy

**Test fails with "Expected X, got Y"**:
- Generated number doesn't match expected value
- Check `scripts/test-drift-data.mjs` expected values
- Verify `compute_check.py` baseline
- If the new data is correct, update test expectations

**Page shows "–" or missing data**:
- Check `data/drift.json` was regenerated
- Verify the model/experiment exists in the data
- Check browser console for errors

## Archival

Old suites stay in `research-data/drift/` but can be removed from the index when no longer needed. The site only shows suites listed in `index.json`.
