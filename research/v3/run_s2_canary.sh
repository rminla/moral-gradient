#!/bin/bash
# Study 2 canary run (8 per level)

set -e

ITER="s2-role-canary"
STAGE="canary"
CAP=1.40  # Canary cap for Study 2

echo "=== Study 2 Canary Run ==="
echo "Iteration: $ITER"
echo "Budget cap: \$$CAP"
echo ""

# Record versions before
python -m v3.record_versions "$ITER-pre"

# Pre-flight tests
echo "Running pre-flight tests..."
python -m pytest v3/test_prereg.py -v -k "test_study2" || { echo "Pre-flight tests failed"; exit 1; }

# Run
echo "Executing canary..."
python -m v3.run \
  --iter "$ITER" \
  --stage "$STAGE" \
  --phases role \
  --role-n 8 \
  --reuse-calibration v3final

# Grade traces (minimal for role phase)
echo "Grading traces..."
python -m v3.traces "$ITER"

# Canary gate check
echo "Running canary gate checks..."
python -m v3.canary_check "$ITER"

# Record versions after
python -m v3.record_versions "$ITER-post"

echo ""
echo "=== Canary run complete ==="
echo "Review canary_check output before proceeding to main run."
