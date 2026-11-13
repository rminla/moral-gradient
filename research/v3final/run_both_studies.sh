#!/bin/bash
# Run both preregistered studies S1 and S2
# Usage: bash run_both_studies.sh [canary|main]
set -euo pipefail

STAGE="${1:-canary}"

if [[ "$STAGE" != "canary" && "$STAGE" != "main" ]]; then
    echo "Error: Stage must be 'canary' or 'main'" >&2
    exit 1
fi

echo "========================================================================"
echo "PREREGISTERED STUDIES S1 & S2 - ${STAGE^^} STAGE"
echo "========================================================================"
echo
echo "This script runs both studies in sequence:"
echo "  Study 1: Beneficiary Control (4 arms)"
echo "  Study 2: Role × Tools 2x2 (4 cells)"
echo
echo "Press Ctrl-C to cancel, or wait 5 seconds to continue..."
sleep 5

# Track overall status
s1_status=0
s2_status=0

# Run Study 1
echo
echo "========================================================================"
echo "RUNNING STUDY 1"
echo "========================================================================"
echo

if bash "$(dirname "$0")/run_study1.sh" "$STAGE"; then
    echo "✓ Study 1 completed"
else
    echo "✗ Study 1 failed"
    s1_status=1
fi

# Run Study 2
echo
echo "========================================================================"
echo "RUNNING STUDY 2"
echo "========================================================================"
echo

if bash "$(dirname "$0")/run_study2.sh" "$STAGE"; then
    echo "✓ Study 2 completed"
else
    echo "✗ Study 2 failed"
    s2_status=1
fi

# Final summary
echo
echo "========================================================================"
echo "COMBINED SUMMARY"
echo "========================================================================"
echo

if [[ $s1_status -eq 0 && $s2_status -eq 0 ]]; then
    echo "✓ Both studies completed successfully"
    echo
    
    if [[ "$STAGE" == "canary" ]]; then
        echo "Next steps:"
        echo "1. Run all canary checks:"
        echo "     python canary_check.py all"
        echo
        echo "2. Review canary results and cost validation"
        echo
        echo "3. If all checks pass, run main stage:"
        echo "     bash run_both_studies.sh main"
        echo
        echo "IMPORTANT: Do not proceed to main stage without manual review"
        echo "of canary results and explicit approval."
    else
        echo "Next steps:"
        echo "1. Run analyses:"
        echo "     python analyze_s1.py data/v3/s1-main/combined.jsonl --output results_s1.json"
        echo "     python analyze_s2.py data/v3/s2-main/combined.jsonl --output results_s2.json"
        echo
        echo "2. Generate final report with all results"
    fi
    
    exit 0
else
    if [[ $s1_status -ne 0 ]]; then
        echo "✗ Study 1 failed"
    fi
    if [[ $s2_status -ne 0 ]]; then
        echo "✗ Study 2 failed"
    fi
    echo
    echo "Review errors above and retry failed studies individually."
    exit 1
fi
