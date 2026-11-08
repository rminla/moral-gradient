#!/usr/bin/env bash
# Pre-commit guard: prevent committing private fixtures, journals, ledgers
set -e

FORBIDDEN_PATTERNS=(
    "regfix/"
    "cloud-fixture-"
    "ledger.db"
    "ledger_copy.db"
    ".journal"
)

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

VIOLATIONS=""
for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    matches=$(echo "$STAGED_FILES" | grep -F "$pattern" || true)
    if [ -n "$matches" ]; then
        VIOLATIONS="${VIOLATIONS}Forbidden pattern '$pattern' found in:\n${matches}\n\n"
    fi
done

if [ -n "$VIOLATIONS" ]; then
    echo "❌ COMMIT BLOCKED: Private fixtures detected in staged files"
    echo ""
    echo -e "$VIOLATIONS"
    echo "These files contain private research data and must not be committed."
    echo "Remove them from staging with: git reset HEAD <file>"
    exit 1
fi

echo "✓ No private fixtures detected in staged files"
exit 0
