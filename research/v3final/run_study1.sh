#!/bin/bash
# Run Study 1: Beneficiary Control
# Usage: bash run_study1.sh [canary|main] [--fake-transport]
set -euo pipefail

STAGE="${1:-canary}"
FAKE_TRANSPORT="${2:-}"

if [[ "$STAGE" != "canary" && "$STAGE" != "main" ]]; then
    echo "Error: Stage must be 'canary' or 'main'" >&2
    exit 1
fi

echo "========================================================================"
echo "STUDY 1: BENEFICIARY CONTROL - ${STAGE^^} STAGE"
echo "========================================================================"
echo

# Study 1 parameters
ITER="s1_${STAGE}"
MODELS=("claude-haiku-5.5" "gpt-oss-120b" "qwen3.6-27b" "gemini-3.8-flash")
CUES="benef_org,benef_self,benef_other,none"

if [[ "$STAGE" == "canary" ]]; then
    N_PER_CUE=8  # 8 per level × 2 levels = 16 per arm per model = 64 per model
    CAP=2.97
else
    N_PER_CUE=24  # 24 per level × 2 levels = 48 per arm per model = 192 per model
    CAP=8.92
fi

REAL_LEDGER=/workspace/moral-compass/runs/v4-20261108/ledger.db

# Set FAKE_TRANSPORT env var if requested
if [[ "$FAKE_TRANSPORT" == "--fake-transport" ]]; then
    export FAKE_TRANSPORT=1
    echo "✓ Fake transport enabled (zero real API calls)"
    ITER="${ITER}_dryrun"   # keep fake results out of the real run directory
    # Fake runs never write to the real ledger: default to a throwaway copy
    if [[ -z "${GLOBAL_LEDGER:-}" ]]; then
        GLOBAL_LEDGER="$(mktemp /tmp/fake_ledger_XXXXXX.db)"
        cp "$REAL_LEDGER" "$GLOBAL_LEDGER"
    fi
    if [[ "$(realpath "$GLOBAL_LEDGER")" == "$(realpath "$REAL_LEDGER")" ]]; then
        echo "✗ Refusing to write fake-transport rows into the real ledger" >&2
        exit 1
    fi
    echo "✓ Using throwaway ledger $GLOBAL_LEDGER"
else
    export FAKE_TRANSPORT=0
    GLOBAL_LEDGER="${GLOBAL_LEDGER:-$REAL_LEDGER}"
fi

# Fix #10: Pre-flight checks from research/prereg
echo "Running pre-flight checks..."
if ! python3 -m pytest research/prereg/ -q --tb=short; then
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
    
    # Fix #10: run_prereg.py handles calibration seeding
    # Fix #10: Pass --global-ledger
    # Fix: Use --phases si and --stage main --preset full
    if python3 research/prereg/run_prereg.py "$model" \
        --iter "$ITER" \
        --stage main \
        --preset full \
        --phases si \
        --cues "$CUES" \
        --cue-n "benef_org:$N_PER_CUE,benef_self:$N_PER_CUE,benef_other:$N_PER_CUE,none:$N_PER_CUE" \
        --cap "$CAP" \
        --budget "$CAP" \
        --global-ledger "$GLOBAL_LEDGER" \
        --workers 8; then
        
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

# Reasoning-trace grading (prereg secondary measure; same experiment and stage cap in the global ledger)
if [[ ${#failed_models[@]} -eq 0 ]]; then
    echo "Running reasoning-trace grading for $ITER..."
    if ! python3 research/prereg/run_traces_prereg.py "$ITER" --cap "$CAP" --global-ledger "$GLOBAL_LEDGER"; then
        failed_models+=("trace-grading")
    fi
fi

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
        echo "     for m in ${MODELS[*]}; do python research/prereg/canary_check.py $ITER \$m --data-dir research/v3final/harness/run_${ITER}_main/data/v3 --cost-estimates research/v3/cost_estimates.json; done"
        echo
        echo "2. If canary checks pass, run main stage:"
        echo "     bash run_study1.sh main"
    else
        echo "1. Run analysis:"
        echo "     python research/prereg/analyze_s1_prereg.py"
    fi
    exit 0
else
    echo "✗ Failed models: ${failed_models[*]}"
    exit 1
fi
