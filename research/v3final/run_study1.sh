#!/bin/bash
# Run Study 1: Beneficiary Control
# Usage: bash run_study1.sh [canary|main] [--retry-only]
set -euo pipefail

STAGE="${1:-canary}"
RETRY_ONLY="${2:-}"

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
    N_PER_CUE=16  # 16 per arm per level per model = 64 per model (256 total)
    CAP=2.97
else
    N_PER_CUE=48  # 48 per arm per level per model = 192 per model (768 total)
    CAP=8.92
fi

# Retry parameters
MAX_RETRIES=3
RETRY_DELAY=5

run_model() {
    local model="$1"
    local attempt=1
    
    echo "----------------------------------------"
    echo "Model: $model"
    echo "----------------------------------------"
    
    while [[ $attempt -le $MAX_RETRIES ]]; do
        echo "Attempt $attempt of $MAX_RETRIES..."
        
        if [[ "$RETRY_ONLY" == "--retry-only" ]]; then
            # Retry mode: only run units that failed or are missing
            echo "  Running in retry mode (only missing/failed units)"
        fi
        
        # Run the harness
        # --cap: Hard budget cap
        # --cue-n: Per-cue per-level n
        # --cues: Comma list of cues
        # --preset iter: Use iteration preset (smaller n for other phases)
        # --stage main: Run main stage (not calibrate)
        if python3 harness/v3/run.py "$model" \
            --iter "$ITER" \
            --stage main \
            --preset iter \
            --cues "$CUES" \
            --cue-n "benef_org:$N_PER_CUE,benef_self:$N_PER_CUE,benef_other:$N_PER_CUE,none:$N_PER_CUE" \
            --cap "$CAP" \
            --workers 8; then
            
            echo "✓ $model completed successfully"
            return 0
        else
            echo "✗ $model failed on attempt $attempt"
            
            if [[ $attempt -lt $MAX_RETRIES ]]; then
                echo "  Retrying in ${RETRY_DELAY}s..."
                sleep "$RETRY_DELAY"
                ((attempt++))
            else
                echo "  Max retries reached, moving to next model"
                return 1
            fi
        fi
    done
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
