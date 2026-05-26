#!/bin/bash
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Update the activity log with session end timestamp — only once per minute
ACTIVITY_LOG="$PROJECT_DIR/.claude/memory/activity-log.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
if [ -f "$ACTIVITY_LOG" ] && ! grep -q "Session ended: $TIMESTAMP" "$ACTIVITY_LOG" 2>/dev/null; then
  echo "" >> "$ACTIVITY_LOG"
  echo "### Session ended: $TIMESTAMP" >> "$ACTIVITY_LOG"
  echo "" >> "$ACTIVITY_LOG"
fi

# Commit and push all work including memory updates
if [ -n "$(git status --porcelain)" ]; then
  echo "Auto-saving your work to GitHub..."
  git add -A
  git commit -m "Auto-save: $(date '+%Y-%m-%d %H:%M') — session end"
  for i in 1 2 3 4; do
    git push -u origin "$(git branch --show-current)" && break || sleep $((i * 2))
  done
  echo "Work saved successfully!"
else
  echo "Nothing new to save."
fi
