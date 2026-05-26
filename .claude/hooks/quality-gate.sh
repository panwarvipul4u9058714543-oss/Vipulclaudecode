#!/bin/bash
# Quality gate — runs before every git commit
# Ensures code always meets minimum standards

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

TOOL_INPUT=$(cat)
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only run on git commit commands
if ! echo "$COMMAND" | grep -qE 'git\s+commit'; then
  exit 0
fi

FAILED=0

# TypeScript type check
if [ -f "tsconfig.json" ]; then
  echo "Running TypeScript type check..."
  if ! npx tsc --noEmit --skipLibCheck 2>/dev/null; then
    echo "TYPE ERRORS found. Fix TypeScript errors before committing."
    FAILED=1
  fi
fi

# ESLint check
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ]; then
  echo "Running ESLint..."
  if ! npx eslint . --max-warnings=0 --quiet 2>/dev/null; then
    echo "LINT ERRORS found. Fix ESLint errors before committing."
    FAILED=1
  fi
fi

# Run tests if they exist
if [ -f "package.json" ] && grep -q '"test"' package.json 2>/dev/null; then
  echo "Running tests..."
  if ! npm test -- --passWithNoTests --watchAll=false 2>/dev/null; then
    echo "TESTS FAILING. Fix failing tests before committing."
    FAILED=1
  fi
fi

# Python checks
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  if command -v pytest &>/dev/null && [ -d "tests" ]; then
    echo "Running Python tests..."
    pytest --tb=short -q 2>/dev/null || true
  fi
fi

if [ "$FAILED" -eq 1 ]; then
  echo '{"decision": "block", "reason": "Quality gate failed. Fix errors above before committing."}'
  exit 0
fi

echo "Quality gate passed."
exit 0
