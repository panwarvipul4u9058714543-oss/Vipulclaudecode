#!/bin/bash
# Runs automatically after every file edit
# 1. Auto-lints and formats code
# 2. Logs the edit to activity-log.md for memory

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

TOOL_INPUT=$(cat)
FILE=$(echo "$TOOL_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")

if [ -z "$FILE" ]; then
  exit 0
fi

EXT="${FILE##*.}"

# Auto-lint JavaScript/TypeScript files
if [[ "$EXT" == "js" || "$EXT" == "jsx" || "$EXT" == "ts" || "$EXT" == "tsx" ]]; then
  if [ -f "$PROJECT_DIR/.eslintrc"* ] || [ -f "$PROJECT_DIR/eslint.config"* ] 2>/dev/null; then
    npx eslint "$FILE" --fix --quiet 2>/dev/null || true
  fi
fi

# Auto-format with prettier
if [[ "$EXT" == "js" || "$EXT" == "jsx" || "$EXT" == "ts" || "$EXT" == "tsx" || "$EXT" == "css" || "$EXT" == "json" || "$EXT" == "md" ]]; then
  if ls "$PROJECT_DIR"/.prettierrc* "$PROJECT_DIR"/prettier.config* 2>/dev/null | grep -q .; then
    npx prettier --write "$FILE" --log-level silent 2>/dev/null || true
  fi
fi

# Log activity and immediately commit so repo stays clean at all times
ACTIVITY_LOG="$PROJECT_DIR/.claude/memory/activity-log.md"
if [ -f "$ACTIVITY_LOG" ] && [[ "$FILE" != *"activity-log.md"* ]]; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  RELATIVE_FILE="${FILE#$PROJECT_DIR/}"
  echo "- \`$TIMESTAMP\` → edited \`$RELATIVE_FILE\`" >> "$ACTIVITY_LOG"

  # Stage and commit ALL changes (not just this file) so repo is always clean
  git add -A 2>/dev/null || true
  git diff --cached --quiet || git commit -m "edit: $RELATIVE_FILE — $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || true
  git push -u origin "$(git branch --show-current)" 2>/dev/null || true
fi

exit 0
