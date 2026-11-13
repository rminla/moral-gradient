#!/bin/bash
# Run Study 2: Role × Tools 2x2
# Usage: bash run_study2.sh [canary|main] [--retry-only]
set -euo pipefail

STAGE="${1:-canary}"
RETRY_ONLY="${2:-}"

if [[ "$STAGE" != "canary" && "$STAGE" != "main" ]]; then
    echo "Error: Stage must be 'canary' or 'main'" >&2
    exit 1
fi

echo "========================================================================"
echo "STUDY 2: ROLE × TOOLS 2x2 - ${STAGE^^} STAGE"
echo "========================================================================"
echo

# Study 2 parameters
ITER="s2-${STAGE}"
MODELS=("claude-haiku-5.5" "gpt-oss-120b" "qwen3.6-27b" "gemini-3.8-flash")

if [[ "$STAGE" == "canary" ]]; then
    ROLE_N=16  # 16 per cell per level per model = 64 per model (256 total)
    CAP=1.40
else
    ROLE_N=48  # 48 per cell per level per model = 192 per model (768 total)
    CAP=4.21
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
        # --role-n: Per-level n for role phase
        # --phases: Only run role phase
        # --preset iter: Use iteration preset
        # --stage main: Run main stage (not calibrate)
        if python3 harness/v3/run.py "$model" \
            --iter "$ITER" \
            --stage main \
            --preset iter \
            --role-n "$ROLE_N" \
            --phases role \
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
echo "STUDY 2 ${STAGE^^} STAGE SUMMARY"
echo "========================================================================"
echo

if [[ ${#failed_models[@]} -eq 0 ]]; then
    echo "✓ All models completed successfully"
    echo
    echo "Next steps:"
    if [[ "$STAGE" == "canary" ]]; then
        echo "1. Run canary checks:"
        echo "     python canary_check.py s2 all"
        echo
        echo "2. If canary checks pass, run main stage:"
        echo "     bash run_study2.sh main"
        echo
        echo "Note: Main stage requires manual approval after canary validation."
    else
        echo "1. Run analysis:"
        echo "     python analyze_s2.py data/v3/$ITER/combined.jsonl --output results_s2_${STAGE}.json"
    fi
    exit 0
else
    echo "✗ Failed models: ${failed_models[*]}"
    echo
    echo "To retry failed models only:"
    echo "  bash run_study2.sh $STAGE --retry-only"
    exit 1
fi
