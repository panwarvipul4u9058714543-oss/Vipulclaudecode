#!/bin/bash
# Self-evolution engine
# Reads activity log, detects patterns, auto-writes new commands

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

ACTIVITY_LOG="$PROJECT_DIR/.claude/memory/activity-log.md"
COMMANDS_DIR="$PROJECT_DIR/.claude/commands"
PATTERNS_FILE="$PROJECT_DIR/.claude/memory/patterns.md"
TODAY=$(date '+%Y-%m-%d')

[ -f "$ACTIVITY_LOG" ] || exit 0

# ── Count file type edits to detect what is being worked on most ──
TS_COUNT=$(grep -c '\.tsx\?`' "$ACTIVITY_LOG" 2>/dev/null | tail -1 || echo 0)
PY_COUNT=$(grep -c '\.py`' "$ACTIVITY_LOG" 2>/dev/null | tail -1 || echo 0)
CSS_COUNT=$(grep -c '\.css`\|\.scss`\|tailwind' "$ACTIVITY_LOG" 2>/dev/null | tail -1 || echo 0)
TEST_COUNT=$(grep -c '\.test\.\|\.spec\.' "$ACTIVITY_LOG" 2>/dev/null | tail -1 || echo 0)
API_COUNT=$(grep -c 'api\|route\|endpoint\|controller' "$ACTIVITY_LOG" 2>/dev/null | tail -1 || echo 0)
# Ensure values are plain integers
TS_COUNT=${TS_COUNT##*$'\n'}
PY_COUNT=${PY_COUNT##*$'\n'}
CSS_COUNT=${CSS_COUNT##*$'\n'}
TEST_COUNT=${TEST_COUNT##*$'\n'}
API_COUNT=${API_COUNT##*$'\n'}

# ── Auto-create commands based on detected patterns ──

# Pattern: lots of TypeScript/React work → create /component command if missing
if [ "$TS_COUNT" -gt 3 ] && [ ! -f "$COMMANDS_DIR/component.md" ]; then
  cat > "$COMMANDS_DIR/component.md" << 'EOF'
Build a React component for me. As you build it:
1. Tell me what the component will do in simple words
2. Use TypeScript
3. Use Tailwind CSS for styling
4. Explain each prop (input) the component accepts
5. Show me how to use it with an example

Component to build: $ARGUMENTS
EOF
  echo "AUTO-CREATED: /component command (detected heavy TypeScript/React usage)"
fi

# Pattern: lots of Python work → create /script command if missing
if [ "$PY_COUNT" -gt 3 ] && [ ! -f "$COMMANDS_DIR/script.md" ]; then
  cat > "$COMMANDS_DIR/script.md" << 'EOF'
Write a Python script for me. As you write it:
1. Explain what the script will do before writing any code
2. Write clean, simple Python with type hints
3. Add a main() function
4. Handle errors gracefully and explain them
5. Show example usage

Script to write: $ARGUMENTS
EOF
  echo "AUTO-CREATED: /script command (detected heavy Python usage)"
fi

# Pattern: lots of test files → create /testfile command if missing
if [ "$TEST_COUNT" -gt 2 ] && [ ! -f "$COMMANDS_DIR/testfile.md" ]; then
  cat > "$COMMANDS_DIR/testfile.md" << 'EOF'
Write a complete test file for the given code. Include:
1. Unit tests for every function
2. Integration tests if applicable
3. Edge cases (empty input, null, wrong types)
4. Mock any external services
5. Explain what each test block is checking

Code to test: $ARGUMENTS
EOF
  echo "AUTO-CREATED: /testfile command (detected heavy testing activity)"
fi

# Pattern: API/route work → create /endpoint command if missing
if [ "$API_COUNT" -gt 3 ] && [ ! -f "$COMMANDS_DIR/endpoint.md" ]; then
  cat > "$COMMANDS_DIR/endpoint.md" << 'EOF'
Build an API endpoint for me. Include:
1. The route handler with proper HTTP method
2. Input validation (check all user inputs)
3. Error handling with proper status codes
4. TypeScript types for request and response
5. A simple explanation of what the endpoint does

Endpoint to build: $ARGUMENTS
EOF
  echo "AUTO-CREATED: /endpoint command (detected heavy API/route work)"
fi

# ── Log patterns detected ──
cat >> "$PATTERNS_FILE" << EOF

## $TODAY
- TypeScript/React edits: $TS_COUNT
- Python edits: $PY_COUNT
- CSS/Tailwind edits: $CSS_COUNT
- Test file edits: $TEST_COUNT
- API/Route edits: $API_COUNT
EOF

echo "Evolution check complete."
exit 0
