#!/bin/bash
# Run Study 1: Beneficiary Control
# Usage: bash run_study1.sh [canary|main]
set -euo pipefail

STAGE="${1:-canary}"

if [[ "$STAGE" != "canary" && "$STAGE" != "main" ]]; then
    echo "Error: Stage must be 'canary' or 'main'" >&2
    exit 1
fi

echo "========================================================================"
echo "STUDY 1: BENEFICIARY CONTROL - ${STAGE^^} STAGE"
echo "========================================================================"
echo

# Study 1 parameters
ITER="s1-${STAGE}"
MODELS=("claude-haiku-5.5" "gpt-oss-120b" "qwen3.6-27b" "gemini-3.8-flash")
CUES="benef_org,benef_self,benef_other,none"

if [[ "$STAGE" == "canary" ]]; then
    N_PER_CUE=8  # 8 per arm per level = 64 per model (256 total with 2 levels × 4 models)
    CAP=2.97
else
    N_PER_CUE=24  # 24 per arm per level = 192 per model (768 total with 2 levels × 4 models)
    CAP=8.92
fi

# Pre-flight checks
echo "Running pre-flight checks..."
if ! python3 -m pytest research/v3final/harness/v3/test_*.py research/v3final/test_*.py -v --tb=short; then
    echo "✗ Pre-flight tests failed" >&2
    exit 1
fi
echo "✓ Pre-flight tests passed"
echo

run_model() {
    local model="$1"
    
    echo "----------------------------------------"
    echo "Model: $model"
    echo "----------------------------------------"
    
    # Seed calibration from v3final
    mkdir -p "data/v3/$ITER/$model"
    cp "research/v3final/data/$model/calibration.json" "data/v3/$ITER/$model/calibration.json"
    
    # Record versions before
    python3 research/v3final/harness/v3/record_versions.py "$ITER" "$model" before
    
    # Run the harness with correct spec flags
    # --phases si: Only run SI phase (not say/ladder/press)
    # --preset full: Use full preset (not iter)
    # --cue-n X:N: Per-cue per-level n (8 or 24)
    # --cap: Hard budget cap per study/stage
    # Uses research/prereg/run_prereg.py which wraps v3final and validates calibration
    if python3 research/prereg/run_prereg.py "$model" \
        --iter "$ITER" \
        --stage main \
        --preset full \
        --phases si \
        --cues "$CUES" \
        --cue-n "benef_org:$N_PER_CUE,benef_self:$N_PER_CUE,benef_other:$N_PER_CUE,none:$N_PER_CUE" \
        --cap "$CAP" \
        --budget "$CAP" \
        --workers 8; then
        
        # Record versions after
        python3 research/v3final/harness/v3/record_versions.py "$ITER" "$model" after
        
        echo "✓ $model completed successfully"
        return 0
    else
        echo "✗ $model failed (errors remain after retries)"
        return 1
    fi
}

# Run all models
failed_models=()

for model in "${MODELS[@]}"; do
    if ! run_model "$model"; then
        failed_models+=("$model")
    fi
    echo
done

# Summary
echo "========================================================================"
echo "STUDY 1 ${STAGE^^} STAGE SUMMARY"
echo "========================================================================"
echo

if [[ ${#failed_models[@]} -eq 0 ]]; then
    echo "✓ All models completed successfully"
    echo
    echo "Next steps:"
    if [[ "$STAGE" == "canary" ]]; then
        echo "1. Run canary checks:"
        echo "     python canary_check.py s1 all"
        echo
        echo "2. If canary checks pass, run main stage:"
        echo "     bash run_study1.sh main"
        echo
        echo "Note: Main stage requires manual approval after canary validation."
    else
        echo "1. Run analysis:"
        echo "     python analyze_s1.py data/v3/$ITER/combined.jsonl --output results_s1_${STAGE}.json"
    fi
    exit 0
else
    echo "✗ Failed models: ${failed_models[*]}"
    echo
    echo "To retry failed models only:"
    echo "  bash run_study1.sh $STAGE --retry-only"
    exit 1
fi
