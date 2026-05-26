#!/bin/bash
# Runs BEFORE every bash command — blocks dangerous operations

TOOL_INPUT=$(cat)
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Block accidental full-repo deletion
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+/|rm\s+-rf\s+\.\s*$|rm\s+-rf\s+\*'; then
  echo '{"decision": "block", "reason": "Dangerous rm -rf detected. Please confirm this is intentional before proceeding."}'
  exit 0
fi

# Block force push to main
if echo "$COMMAND" | grep -qE 'git push.*--force.*main|git push.*-f.*main'; then
  echo '{"decision": "block", "reason": "Force push to main blocked. This could destroy team members work."}'
  exit 0
fi

# Block dropping production databases
if echo "$COMMAND" | grep -qiE 'DROP\s+DATABASE|DROP\s+TABLE.*CASCADE'; then
  echo '{"decision": "block", "reason": "Destructive database command blocked. Please confirm this is intentional."}'
  exit 0
fi

exit 0
