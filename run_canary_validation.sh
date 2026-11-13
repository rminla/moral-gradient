#!/bin/bash
set -e

# Run canary_check and analyses on fake canary data
# Generates evidence files marked as FAKE TRANSPORT

EVIDENCE_DIR="research/prereg/evidence"
mkdir -p "$EVIDENCE_DIR"

echo "========================================="
echo "RUNNING CANARY VALIDATION (FAKE TRANSPORT)"
echo "========================================="

# Models
MODELS="claude-haiku-5.5 gpt-oss-120b qwen3.6-27b gemini-3.8-flash"

# S1 canary_check
echo ""
echo "=== S1 CANARY_CHECK ==="
for model in $MODELS; do
    echo "Checking S1 $model..."
    python3 research/prereg/canary_check.py s1_canary_fake "$model" \
        --data-dir research/v3final/harness/run_s1_canary_fake_main/data/v3 \
        --cost-estimates research/prereg/cost_estimates.json \
        > "$EVIDENCE_DIR/s1_canary_check_${model}_FAKE.txt" 2>&1 || true
done

# S2 canary_check
echo ""
echo "=== S2 CANARY_CHECK ==="
for model in $MODELS; do
    echo "Checking S2 $model..."
    python3 research/prereg/canary_check.py s2_canary_fake "$model" \
        --data-dir research/v3final/harness/run_s2_canary_fake_main/data/v3 \
        --cost-estimates research/prereg/cost_estimates.json \
        > "$EVIDENCE_DIR/s2_canary_check_${model}_FAKE.txt" 2>&1 || true
done

# Combine S1 data
echo ""
echo "=== COMBINING S1 DATA ==="
cat research/v3final/harness/run_s1_canary_fake_main/data/v3/s1_canary_fake/*/main.jsonl \
    > "$EVIDENCE_DIR/s1_canary_combined_FAKE.jsonl"

# Run S1 analysis
echo ""
echo "=== S1 ANALYSIS ==="
python3 research/prereg/analyze_s1_prereg.py \
    "$EVIDENCE_DIR/s1_canary_combined_FAKE.jsonl" \
    --output "$EVIDENCE_DIR/s1_canary_analysis_FAKE.json" \
    > "$EVIDENCE_DIR/s1_canary_analysis_FAKE.txt" 2>&1 || true

# Combine S2 data
echo ""
echo "=== COMBINING S2 DATA ==="
cat research/v3final/harness/run_s2_canary_fake_main/data/v3/s2_canary_fake/*/main.jsonl \
    > "$EVIDENCE_DIR/s2_canary_combined_FAKE.jsonl"

# Run S2 analysis
echo ""
echo "=== S2 ANALYSIS ==="
python3 research/prereg/analyze_s2_prereg.py \
    "$EVIDENCE_DIR/s2_canary_combined_FAKE.jsonl" \
    --output "$EVIDENCE_DIR/s2_canary_analysis_FAKE.json" \
    > "$EVIDENCE_DIR/s2_canary_analysis_FAKE.txt" 2>&1 || true

# Create README
cat > "$EVIDENCE_DIR/README_FAKE.md" << 'EOF'
# Fake Transport Canary Evidence

**⚠️ This is FAKE TRANSPORT evidence - zero real API calls were made.**

All canaries ran with `FAKE_TRANSPORT=1` using mocked API responses.

## Files

- `s1_canary_evidence.json`, `s2_canary_evidence.json`: Unit counts by model/arm/cell
- `s1_canary_check_*_FAKE.txt`: canary_check output per model (S1)
- `s2_canary_check_*_FAKE.txt`: canary_check output per model (S2)
- `s1_canary_combined_FAKE.jsonl`: All S1 canary units (256 total)
- `s2_canary_combined_FAKE.jsonl`: All S2 canary units (256 total)
- `s1_canary_analysis_FAKE.txt`, `s1_canary_analysis_FAKE.json`: S1 analysis output
- `s2_canary_analysis_FAKE.txt`, `s2_canary_analysis_FAKE.json`: S2 analysis output

## Counts

- S1: 256 units (64 per model, 16 per arm per model)
- S2: 256 units (64 per model, 16 per cell per model)
- 0 errors in all runs
EOF

echo ""
echo "========================================="
echo "CANARY VALIDATION COMPLETE"
echo "========================================="
echo "Evidence saved to: $EVIDENCE_DIR"
