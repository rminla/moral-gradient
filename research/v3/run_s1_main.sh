#!/bin/bash
# Study 1 main run (24 per cue)

set -e

ITER="s1-benef"
STAGE="main"
CAP=8.92  # Main cap for Study 1 (excluding canary spend)

echo "=== Study 1 Main Run ==="
echo "Iteration: $ITER"
echo "Budget cap: \$$CAP"
echo ""

# Record versions before
python -m v3.record_versions "$ITER-pre"

# Pre-flight tests
echo "Running pre-flight tests..."
python -m pytest v3/test_prereg.py -v -k "test_study1" || { echo "Pre-flight tests failed"; exit 1; }

# Run
echo "Executing main run..."
python -m v3.run \
  --iter "$ITER" \
  --stage "$STAGE" \
  --phases si \
  --preset full \
  --cues benef_org,benef_self,benef_other,none \
  --cue-n benef_org:24,benef_self:24,benef_other:24,none:24 \
  --reuse-calibration v3final

# Grade traces
echo "Grading traces..."
python -m v3.traces "$ITER"

# Analyze
echo "Running preregistered analysis..."
python -m v3.analyze_s1 "output/$ITER/graded.jsonl"

# Record versions after
python -m v3.record_versions "$ITER-post"

echo ""
echo "=== Main run complete ==="
