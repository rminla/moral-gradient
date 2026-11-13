#!/bin/bash
# Study 1 canary run (8 per cue)

set -e

ITER="s1-benef-canary"
STAGE="canary"
CAP=2.97  # Canary cap for Study 1

echo "=== Study 1 Canary Run ==="
echo "Iteration: $ITER"
echo "Budget cap: \$$CAP"
echo ""

# Record versions before
python -m v3.record_versions "$ITER-pre"

# Pre-flight tests
echo "Running pre-flight tests..."
python -m pytest v3/test_prereg.py -v -k "test_study1" || { echo "Pre-flight tests failed"; exit 1; }

# Run
echo "Executing canary..."
python -m v3.run \
  --iter "$ITER" \
  --stage "$STAGE" \
  --phases si \
  --preset full \
  --cues benef_org,benef_self,benef_other,none \
  --cue-n benef_org:8,benef_self:8,benef_other:8,none:8 \
  --reuse-calibration v3final

# Grade traces
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
