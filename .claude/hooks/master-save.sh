#!/bin/bash
# MASTER SAVE — runs after every single operation
# Nothing ever disappears. Everything is always pushed to GitHub.

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0

# Not a git repo? Nothing to do
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# No remote? Nothing to push to
[ -n "$(git remote 2>/dev/null)" ] || exit 0

# Commit everything that is new or changed
if ! git diff --quiet 2>/dev/null || \
   ! git diff --cached --quiet 2>/dev/null || \
   [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
  git add -A 2>/dev/null || true
  git commit -m "auto-save: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null || true
fi

# Push any unpushed commits (with retry)
BRANCH=$(git branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
  UNPUSHED=$(git rev-list "origin/$BRANCH..HEAD" --count 2>/dev/null || echo "1")
  if [ "$UNPUSHED" -gt 0 ] 2>/dev/null; then
    for i in 1 2 3 4; do
      git push -u origin "$BRANCH" 2>/dev/null && break || sleep $((i * 2))
    done
  fi
fi

exit 0
