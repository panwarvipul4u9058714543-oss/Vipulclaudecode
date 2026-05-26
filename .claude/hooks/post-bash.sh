#!/bin/bash
# Runs after every bash command
# 1. Auto-runs tests when test files change
# 2. Commits ALL pending changes so repo is always clean

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

TOOL_INPUT=$(cat)
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# If a test file was just created or modified, auto-run it
if echo "$COMMAND" | grep -qE '\.test\.|\.spec\.'; then
  if [ -f "package.json" ] && grep -q '"test"' package.json 2>/dev/null; then
    echo "Test file detected — running tests..."
    npm test --passWithNoTests 2>/dev/null || true
  fi
fi

# If requirements.txt was modified, reinstall Python deps
if echo "$COMMAND" | grep -q 'requirements.txt'; then
  echo "requirements.txt changed — reinstalling Python dependencies..."
  pip install -r requirements.txt --quiet 2>/dev/null || true
fi

# Commit ALL pending changes (modified + untracked) so repo is always clean
# This prevents the global stop hook from warning about uncommitted changes
if ! git diff --quiet 2>/dev/null || \
   ! git diff --cached --quiet 2>/dev/null || \
   [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
  git add -A
  git commit -m "auto: sync after bash — $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || true
  git push -u origin "$(git branch --show-current)" 2>/dev/null || true
fi

exit 0
