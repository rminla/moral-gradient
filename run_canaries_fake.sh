#!/bin/bash
set -e

# Script to run both fake canaries for S1 and S2
# Zero paid API calls via FAKE_TRANSPORT=1

export FAKE_TRANSPORT=1

# Use a temporary global ledger for fake runs
TEMP_LEDGER="/tmp/fake_global_ledger_$$.db"

# Create empty ledger from schema
sqlite3 "$TEMP_LEDGER" < research/prereg/global-ledger-schema.sql
echo "✓ Created temp global ledger: $TEMP_LEDGER"

echo "========================================================================"
echo "RUNNING S1 CANARY (256 units) WITH FAKE TRANSPORT"
echo "========================================================================"

# S1 canary: 4 models × 64 units/model = 256 total
# 4 arms × 16 units/arm/model (8 per level × 2 levels)
MODELS="claude-haiku-5.5 gpt-oss-120b qwen3.6-27b gemini-3.8-flash"

for model in $MODELS; do
    echo "Running S1 canary for $model..."
    python3 research/prereg/run_prereg.py "$model" \
        --iter s1_canary_fake \
        --stage main \
        --preset full \
        --phases si \
        --cues "benef_org,benef_self,benef_other,none" \
        --cue-n "benef_org:8,benef_self:8,benef_other:8,none:8" \
        --cap 2.97 \
        --budget 2.97 \
        --global-ledger "$TEMP_LEDGER" \
        --workers 8
done

echo ""
echo "========================================================================"
echo "RUNNING S2 CANARY (256 units) WITH FAKE TRANSPORT"
echo "========================================================================"

# S2 canary: 4 models × 64 units/model = 256 total  
# 4 cells × 16 units/cell/model (8 per level × 2 levels)
for model in $MODELS; do
    echo "Running S2 canary for $model..."
    python3 research/prereg/run_prereg.py "$model" \
        --iter s2_canary_fake \
        --stage main \
        --preset full \
        --phases role \
        --role-n 8 \
        --cap 1.40 \
        --budget 1.40 \
        --global-ledger "$TEMP_LEDGER" \
        --workers 8
done

# Generate evidence summaries
mkdir -p research/prereg/evidence

echo ""
echo "Counting results..."

# Count S1 main.jsonl across all models
python3 -c "
import json
from pathlib import Path

data = []
for model in ['claude-haiku-5.5', 'gpt-oss-120b', 'qwen3.6-27b', 'gemini-3.8-flash']:
    path = Path('research/v3final/harness/data/v3/s1_canary_fake') / model / 'main.jsonl'
    if path.exists():
        with open(path) as f:
            for line in f:
                data.append(json.loads(line))

summary = {
    'total_units': len(data),
    'by_model': {},
    'by_cue': {},
    'by_outcome': {}
}

for row in data:
    model = row.get('target', 'unknown')
    cue = row.get('cue', 'unknown')
    outcome = row.get('outcome', 'unknown')
    summary['by_model'][model] = summary['by_model'].get(model, 0) + 1
    summary['by_cue'][cue] = summary['by_cue'].get(cue, 0) + 1
    summary['by_outcome'][outcome] = summary['by_outcome'].get(outcome, 0) + 1

with open('research/prereg/evidence/s1_canary_counts.json', 'w') as f:
    json.dump(summary, f, indent=2)

print('S1 Canary Results:')
print(f'Total: {summary[\"total_units\"]}')
for model, count in sorted(summary['by_model'].items()):
    print(f'  {model}: {count}')
"

# Count S2 main.jsonl across all models
python3 -c "
import json
from pathlib import Path

data = []
for model in ['claude-haiku-5.5', 'gpt-oss-120b', 'qwen3.6-27b', 'gemini-3.8-flash']:
    path = Path('research/v3final/harness/data/v3/s2_canary_fake') / model / 'main.jsonl'
    if path.exists():
        with open(path) as f:
            for line in f:
                data.append(json.loads(line))

summary = {
    'total_units': len(data),
    'by_model': {},
    'by_cell': {},
    'by_outcome': {}
}

for row in data:
    model = row.get('target', 'unknown')
    cell = row.get('cell', 'unknown')
    outcome = row.get('outcome', 'unknown')
    summary['by_model'][model] = summary['by_model'].get(model, 0) + 1
    summary['by_cell'][cell] = summary['by_cell'].get(cell, 0) + 1
    summary['by_outcome'][outcome] = summary['by_outcome'].get(outcome, 0) + 1

with open('research/prereg/evidence/s2_canary_counts.json', 'w') as f:
    json.dump(summary, f, indent=2)

print('S2 Canary Results:')
print(f'Total: {summary[\"total_units\"]}')
for model, count in sorted(summary['by_model'].items()):
    print(f'  {model}: {count}')
"

echo ""
echo "========================================================================"
echo "CANARY RUNS COMPLETE"
echo "========================================================================"
echo "Evidence saved to: research/prereg/evidence"
echo "Temp ledger: $TEMP_LEDGER"
