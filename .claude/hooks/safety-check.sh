#!/bin/bash
# Runs BEFORE every bash command — blocks genuinely dangerous operations

TOOL_INPUT=$(cat)
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Block accidental full-repo deletion
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+/\s*$|rm\s+-rf\s+\.\s*$|rm\s+-rf\s+/home|rm\s+-rf\s+/root'; then
  echo '{"decision": "block", "reason": "Dangerous rm -rf on root or home directory detected. Please confirm this is intentional."}'
  exit 0
fi

# Block force push to main
if echo "$COMMAND" | grep -qE 'git\s+push.*(--force|-f)\s+.*\bmain\b|git\s+push\s+(--force|-f)\s+origin\s+main'; then
  echo '{"decision": "block", "reason": "Force push to main branch blocked. This could destroy teammates work."}'
  exit 0
fi

# Block real database drop commands (only in actual DB CLI tools, not git commits)
if echo "$COMMAND" | grep -qE '^\s*(mysql|psql|sqlite3|mongo)\s+' && echo "$COMMAND" | grep -qiE 'DROP\s+(DATABASE|TABLE)'; then
  echo '{"decision": "block", "reason": "Destructive database DROP command detected. Please confirm you want to permanently delete this data."}'
  exit 0
fi

exit 0
