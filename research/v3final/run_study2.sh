#!/bin/bash
# Run Study 2: Role × Tools 2x2
# Usage: bash run_study2.sh [canary|main] [--fake-transport]
set -euo pipefail

STAGE="${1:-canary}"
FAKE_TRANSPORT="${2:-}"

if [[ "$STAGE" != "canary" && "$STAGE" != "main" ]]; then
    echo "Error: Stage must be 'canary' or 'main'" >&2
    exit 1
fi

echo "========================================================================"
echo "STUDY 2: ROLE × TOOLS 2x2 - ${STAGE^^} STAGE"
echo "========================================================================"
echo

# Study 2 parameters
ITER="s2_${STAGE}"
MODELS=("claude-haiku-5.5" "gpt-oss-120b" "qwen3.6-27b" "gemini-3.8-flash")

if [[ "$STAGE" == "canary" ]]; then
    ROLE_N=8  # 8 per level × 2 levels = 16 per cell per model = 64 per model
    CAP=1.40
else
    ROLE_N=24  # 24 per level × 2 levels = 48 per cell per model = 192 per model
    CAP=4.21
fi

REAL_LEDGER=/workspace/moral-compass/runs/v4-20261108/ledger.db

# Set FAKE_TRANSPORT env var if requested
if [[ "$FAKE_TRANSPORT" == "--fake-transport" ]]; then
    export FAKE_TRANSPORT=1
    echo "✓ Fake transport enabled (zero real API calls)"
    # Fake runs never write to the real ledger: default to a throwaway copy
    if [[ -z "${GLOBAL_LEDGER:-}" ]]; then
        GLOBAL_LEDGER="$(mktemp /tmp/fake_ledger_XXXXXX.db)"
        cp "$REAL_LEDGER" "$GLOBAL_LEDGER"
    fi
    if [[ "$(realpath "$GLOBAL_LEDGER")" == "$(realpath "$REAL_LEDGER")" ]]; then
        echo "✗ Refusing to write fake-transport rows into the real ledger" >&2
        exit 1
    fi
    # Ensure ledger has mock rows
    if ! sqlite3 "$GLOBAL_LEDGER" "SELECT COUNT(*) FROM calls WHERE is_mock = 1" | grep -q '^[1-9]'; then
        echo "✗ Fake transport requires a ledger with mock rows" >&2
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
    # Fix: Use --stage main --preset full
    if python3 research/prereg/run_prereg.py "$model" \
        --iter "$ITER" \
        --stage main \
        --preset full \
        --phases role \
        --role-n "$ROLE_N" \
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
        echo "     for m in ${MODELS[*]}; do python research/prereg/canary_check.py $ITER \$m --data-dir research/v3final/harness/run_${ITER}_main/data/v3 --cost-estimates research/v3/cost_estimates.json; done"
        echo
        echo "2. If canary checks pass, run main stage:"
        echo "     bash run_study2.sh main"
    else
        echo "1. Run analysis:"
        echo "     python research/prereg/analyze_s2_prereg.py"
    fi
    exit 0
else
    echo "✗ Failed models: ${failed_models[*]}"
    exit 1
fi
