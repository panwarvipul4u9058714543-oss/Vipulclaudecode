#!/bin/bash
# Auto-debug hook — fires after every bash command
# If a command failed with an error, logs it for Claude to analyze and fix

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ERRORS_LOG="$PROJECT_DIR/.claude/memory/errors.md"
TODAY=$(date '+%Y-%m-%d %H:%M')

TOOL_INPUT=$(cat)
EXIT_CODE=$(echo "$TOOL_INPUT" | jq -r '.tool_response.exit_code // 0' 2>/dev/null || echo "0")
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
OUTPUT=$(echo "$TOOL_INPUT" | jq -r '.tool_response.stdout // ""' 2>/dev/null || echo "")
STDERR=$(echo "$TOOL_INPUT" | jq -r '.tool_response.stderr // ""' 2>/dev/null || echo "")

# Only act on failed commands (non-zero exit)
if [ "$EXIT_CODE" != "0" ] && [ "$EXIT_CODE" != "null" ] && [ -n "$COMMAND" ]; then
  # Skip git commands — they often exit non-zero harmlessly
  if echo "$COMMAND" | grep -qE '^git\s'; then
    exit 0
  fi

  # Log the error for memory
  mkdir -p "$(dirname "$ERRORS_LOG")"
  cat >> "$ERRORS_LOG" << EOF

## $TODAY — Exit code: $EXIT_CODE
**Command:** \`$COMMAND\`
**Error output:** $STDERR
**Status:** Logged for review

EOF

  # Signal to Claude that something failed and needs attention
  echo "COMMAND FAILED (exit $EXIT_CODE): $COMMAND"
  echo "Error: $STDERR"
  echo "Claude should analyze and fix this automatically."
fi

exit 0
