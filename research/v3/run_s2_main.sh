#!/bin/bash
# Study 2 main run (24 per level)

set -e

ITER="s2-role"
STAGE="main"
CAP=4.21  # Main cap for Study 2 (excluding canary spend)

echo "=== Study 2 Main Run ==="
echo "Iteration: $ITER"
echo "Budget cap: \$$CAP"
echo ""

# Record versions before
python -m v3.record_versions "$ITER-pre"

# Pre-flight tests
echo "Running pre-flight tests..."
python -m pytest v3/test_prereg.py -v -k "test_study2" || { echo "Pre-flight tests failed"; exit 1; }

# Run
echo "Executing main run..."
python -m v3.run \
  --iter "$ITER" \
  --stage "$STAGE" \
  --phases role \
  --role-n 24 \
  --reuse-calibration v3final

# Grade traces (minimal for role phase)
echo "Grading traces..."
python -m v3.traces "$ITER"

# Analyze
echo "Running preregistered analysis..."
python -m v3.analyze_s2 "output/$ITER/graded.jsonl"

# Record versions after
python -m v3.record_versions "$ITER-post"

echo ""
echo "=== Main run complete ==="
