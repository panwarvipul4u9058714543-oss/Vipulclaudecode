#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# ── Patch global stop hook to auto-commit before checking ────────────
# This re-applies every session since ~/.claude/ resets between containers
GLOBAL_HOOK="$HOME/.claude/stop-hook-git-check.sh"
if [ -f "$GLOBAL_HOOK" ] && ! grep -q "AUTO-SAVE" "$GLOBAL_HOOK"; then
  sed -i 's|# Check for uncommitted changes (both staged and unstaged)|# AUTO-SAVE: commit and push anything pending BEFORE checking\nif ! git diff --quiet 2>\/dev\/null || ! git diff --cached --quiet 2>\/dev\/null || [[ -n "$(git ls-files --others --exclude-standard 2>\/dev\/null)" ]]; then\n  git add -A 2>\/dev\/null || true\n  git commit -m "auto-save: $(date +\x27%Y-%m-%d %H:%M\x27)" 2>\/dev\/null || true\n  _branch=$(git branch --show-current 2>\/dev\/null)\n  for _i in 1 2 3 4; do git push -u origin "$_branch" 2>\/dev\/null \&\& break || sleep $((_i * 2)); done\nfi\n\n# Check for uncommitted changes (both staged and unstaged)|' "$GLOBAL_HOOK" 2>/dev/null || true
fi

echo "Setting up project environment..."

# ── Node.js ──────────────────────────────────────────────
if [ -f "package.json" ]; then
  echo "Installing Node.js dependencies..."
  npm install
fi

if [ -f "yarn.lock" ]; then
  yarn install --frozen-lockfile 2>/dev/null || true
fi

if [ -f "pnpm-lock.yaml" ]; then
  pnpm install --frozen-lockfile 2>/dev/null || true
fi

# ── Python ───────────────────────────────────────────────
if [ -f "requirements.txt" ]; then
  echo "Installing Python dependencies..."
  pip install -r requirements.txt --quiet
fi

if [ -f "requirements-dev.txt" ]; then
  pip install -r requirements-dev.txt --quiet
fi

if [ -f "pyproject.toml" ]; then
  if command -v poetry &>/dev/null; then
    poetry install --no-interaction
  else
    pip install -e . --quiet 2>/dev/null || true
  fi
fi

# ── Ruby ─────────────────────────────────────────────────
if [ -f "Gemfile" ]; then
  echo "Installing Ruby gems..."
  bundle install --quiet
fi

# ── Go ───────────────────────────────────────────────────
if [ -f "go.mod" ]; then
  echo "Downloading Go modules..."
  go mod download
fi

# ── Rust ─────────────────────────────────────────────────
if [ -f "Cargo.toml" ]; then
  echo "Fetching Rust dependencies..."
  cargo fetch
fi

# ── Git config ───────────────────────────────────────────
git config --global core.autocrlf input
git config --global pull.rebase false
git config --global init.defaultBranch main

# ── TypeScript check ─────────────────────────────────────
if [ -f "tsconfig.json" ]; then
  echo "TypeScript project detected."
  export TS_NODE_TRANSPILE_ONLY=true
fi

# ── Environment variables ────────────────────────────────
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

# ── Docker ───────────────────────────────────────────────
if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
  echo "Docker Compose project detected."
fi

echo "Environment setup complete."

# ── Smart daily briefing ─────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "   CLAUDE CODE — SESSION BRIEFING"
echo "   $(date '+%A, %B %d %Y — %H:%M')"
echo "════════════════════════════════════════"

PROGRESS="$PROJECT_DIR/.claude/memory/progress.md"
PROFILE="$PROJECT_DIR/.claude/memory/vipul-profile.md"
ERRORS="$PROJECT_DIR/.claude/memory/errors.md"

# ── CRITICAL: Always announce profile exists ──────────────
echo ""
echo "IMPORTANT — READ BEFORE RESPONDING:"
if [ -f "$PROFILE" ]; then
  echo "  ✅ vipul-profile.md EXISTS — Read it now (full cognitive + personality profile)"
  echo "  ✅ preferences.md EXISTS — Read it now"
  echo "  ✅ projects.md EXISTS — Read it now"
  echo "  ✅ mistakes.md EXISTS — Read it now"
  echo "  → Claude MUST read ALL memory files before responding to anything"
else
  echo "  ⚠️  Profile file missing — ask Vipul to reshare his profile"
fi

# Show last session summary
if [ -f "$PROGRESS" ]; then
  echo ""
  echo "LAST SESSION:"
  grep -A8 "^## " "$PROGRESS" 2>/dev/null | head -10 || \
  echo "  No previous session found."
fi

# Show any recent errors to be aware of
if [ -f "$ERRORS" ] && grep -q "Exit code" "$ERRORS" 2>/dev/null; then
  echo ""
  echo "RECENT ERRORS TO WATCH:"
  grep "Command:" "$ERRORS" 2>/dev/null | tail -3 | sed 's/^/  /'
fi

# Show available commands count
NEW_COMMANDS=$(ls "$PROJECT_DIR/.claude/commands/" 2>/dev/null | wc -l)
echo ""
echo "AVAILABLE COMMANDS: $NEW_COMMANDS custom slash commands ready"
echo "  Type /memory for full briefing, /evolve to self-improve"
echo "════════════════════════════════════════"
echo ""
