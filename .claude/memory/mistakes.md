# Mistakes Log — Things Claude Must Never Repeat

## How This Works
Every time I make a mistake, I log it here with the date.
Next session I read this first so I never repeat the same error.

## Logged Mistakes

### 2026-05-26
- Safety hook was too aggressive — blocked "DROP DATABASE" inside a git commit message
  - Fix: Only block DROP DATABASE when it's inside actual DB CLI commands (mysql, psql, sqlite3)
  - Lesson: Always check the CONTEXT of a command, not just the text

<!-- Claude: Add new mistakes below this line after each session -->
