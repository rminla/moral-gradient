#!/bin/bash
# Run both 256-unit canaries with fake transport
# This generates real evidence from fake API calls (zero cost)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Create temp global ledger for fake runs
TEMP_LEDGER="/tmp/fake_global_ledger_$$.db"
SCHEMA_FILE="research/prereg/global-ledger-schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
    sqlite3 "$TEMP_LEDGER" < "$SCHEMA_FILE"
    echo "✓ Created temp global ledger: $TEMP_LEDGER"
else
    echo "✗ Schema file not found: $SCHEMA_FILE" >&2
    exit 1
fi

# Set environment for fake transport
export FAKE_TRANSPORT=1
export GLOBAL_LEDGER="$TEMP_LEDGER"

# Evidence directory
EVIDENCE_DIR="research/prereg/evidence"
mkdir -p "$EVIDENCE_DIR"

echo "========================================================================"
echo "RUNNING S1 CANARY (256 units) WITH FAKE TRANSPORT"
echo "========================================================================"

# S1 canary: 4 models × 64 units/model = 256 total
# 4 arms × 16 units/arm/model  
python3 research/prereg/run_prereg.py claude-haiku-5.5 \
    --iter s1_canary_fake \
    --stage all \
    --preset iter \
    --phases cues \
    --cues "benef_org,benef_self,benef_other,none" \
    --cue-n "benef_org:16,benef_self:16,benef_other:16,none:16" \
    --cap 2.97 \
    --budget 2.97 \
    --global-ledger "$TEMP_LEDGER" \
    --workers 4 \
    2>&1 | tee /tmp/s1_canary_run.log

# Count S1 results
echo ""
echo "S1 Canary Results:"
S1_OUTPUT="research/v3final/harness/data/v3/s1_canary_fake/claude-haiku-5.5/calibrate.jsonl"
if [ -f "$S1_OUTPUT" ]; then
    echo "Total rows: $(wc -l < "$S1_OUTPUT")"
    echo "By arm:"
    jq -r '.cue // "unknown"' "$S1_OUTPUT" | sort | uniq -c
    echo "By outcome:"
    jq -r '.outcome // "unknown"' "$S1_OUTPUT" | sort | uniq -c
    
    # Save evidence
    cat > "$EVIDENCE_DIR/s1_canary_counts.json" << EOF
{
  "study": "S1",
  "stage": "canary",
  "model": "claude-haiku-5.5",
  "total_rows": $(wc -l < "$S1_OUTPUT"),
  "by_arm": $(jq -r '.cue // "unknown"' "$S1_OUTPUT" | sort | uniq -c | jq -R -s -c 'split("\n")[:-1] | map(split(" ") | {count: .[0], arm: .[1]})'),
  "by_outcome": $(jq -r '.outcome // "unknown"' "$S1_OUTPUT" | sort | uniq -c | jq -R -s -c 'split("\n")[:-1] | map(split(" ") | {count: .[0], outcome: .[1]})')
}
EOF
else
    echo "✗ S1 output not found: $S1_OUTPUT"
fi

echo ""
echo "========================================================================"
echo "RUNNING S2 CANARY (256 units) WITH FAKE TRANSPORT"
echo "========================================================================"

# S2 canary: 4 models × 64 units/model = 256 total  
# 4 cells × 16 units/cell/model
python3 research/prereg/run_prereg.py claude-haiku-5.5 \
    --iter s2_canary_fake \
    --stage all \
    --preset iter \
    --phases role \
    --role-n 16 \
    --cap 1.40 \
    --budget 1.40 \
    --global-ledger "$TEMP_LEDGER" \
    --workers 4 \
    2>&1 | tee /tmp/s2_canary_run.log

# Count S2 results
echo ""
echo "S2 Canary Results:"
S2_OUTPUT="research/v3final/harness/data/v3/s2_canary_fake/claude-haiku-5.5/calibrate.jsonl"
if [ -f "$S2_OUTPUT" ]; then
    echo "Total rows: $(wc -l < "$S2_OUTPUT")"
    echo "By cell:"
    jq -r '.cell // "unknown"' "$S2_OUTPUT" | sort | uniq -c
    echo "By outcome:"
    jq -r '.outcome // "unknown"' "$S2_OUTPUT" | sort | uniq -c
    
    # Save evidence
    cat > "$EVIDENCE_DIR/s2_canary_counts.json" << EOF
{
  "study": "S2",
  "stage": "canary",
  "model": "claude-haiku-5.5",
  "total_rows": $(wc -l < "$S2_OUTPUT"),
  "by_cell": $(jq -r '.cell // "unknown"' "$S2_OUTPUT" | sort | uniq -c | jq -R -s -c 'split("\n")[:-1] | map(split(" ") | {count: .[0], cell: .[1]})'),
  "by_outcome": $(jq -r '.outcome // "unknown"' "$S2_OUTPUT" | sort | uniq -c | jq -R -s -c 'split("\n")[:-1] | map(split(" ") | {count: .[0], outcome: .[1]})')
}
EOF
else
    echo "✗ S2 output not found: $S2_OUTPUT"
fi

echo ""
echo "========================================================================"
echo "CANARY RUNS COMPLETE"
echo "========================================================================"
echo "Evidence saved to: $EVIDENCE_DIR"
echo "S1 log: /tmp/s1_canary_run.log"
echo "S2 log: /tmp/s2_canary_run.log"
echo "Temp ledger: $TEMP_LEDGER"

# Update README
cat > "$EVIDENCE_DIR/README.md" << 'EOFREADME'
# Canary Evidence

Both 256-unit canaries were run with FakeTransport (zero real API calls).

## Results

### Study 1 Canary
- Model: claude-haiku-5.5
- Total units: See s1_canary_counts.json
- Arms: benef_org, benef_self, benef_other, none
- Expected: 64 units per model (16 per arm)

### Study 2 Canary
- Model: claude-haiku-5.5
- Total units: See s2_canary_counts.json
- Cells: agent_tools, agent_notools, advisor_tools, advisor_notools
- Expected: 64 units per model (16 per cell)

## Files
- `s1_canary_counts.json`: S1 count breakdown
- `s2_canary_counts.json`: S2 count breakdown
- Logs: `/tmp/s1_canary_run.log`, `/tmp/s2_canary_run.log`
EOFREADME

echo "✓ Updated README.md"
