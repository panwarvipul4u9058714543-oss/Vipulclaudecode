#!/bin/bash
# Runs automatically after every file edit
# Checks for obvious code problems using available linters

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Get the file that was just edited from stdin (Claude passes tool info)
TOOL_INPUT=$(cat)
FILE=$(echo "$TOOL_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")

if [ -z "$FILE" ]; then
  exit 0
fi

EXT="${FILE##*.}"

# Auto-lint JavaScript/TypeScript files after editing
if [[ "$EXT" == "js" || "$EXT" == "jsx" || "$EXT" == "ts" || "$EXT" == "tsx" ]]; then
  if [ -f "$PROJECT_DIR/.eslintrc*" ] || [ -f "$PROJECT_DIR/eslint.config*" ]; then
    echo "Auto-checking code quality for: $FILE"
    npx eslint "$FILE" --fix --quiet 2>/dev/null || true
  fi
fi

# Auto-format code with prettier
if [[ "$EXT" == "js" || "$EXT" == "jsx" || "$EXT" == "ts" || "$EXT" == "tsx" || "$EXT" == "css" || "$EXT" == "json" || "$EXT" == "md" ]]; then
  if [ -f "$PROJECT_DIR/.prettierrc*" ] || [ -f "$PROJECT_DIR/prettier.config*" ]; then
    npx prettier --write "$FILE" --log-level silent 2>/dev/null || true
  fi
fi

exit 0
