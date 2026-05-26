#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Check if there are any unsaved changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Auto-saving your work to GitHub..."
  git add -A
  git commit -m "Auto-save: $(date '+%Y-%m-%d %H:%M')"
  git push -u origin "$(git branch --show-current)"
  echo "Work saved successfully!"
else
  echo "Nothing new to save."
fi
