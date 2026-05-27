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

# ── Session briefing — prints profile directly so Claude cannot miss it ──
PROGRESS="$PROJECT_DIR/.claude/memory/progress.md"
PROFILE="$PROJECT_DIR/.claude/memory/vipul-profile.md"
PREFERENCES="$PROJECT_DIR/.claude/memory/preferences.md"
PROJECTS="$PROJECT_DIR/.claude/memory/projects.md"
MISTAKES="$PROJECT_DIR/.claude/memory/mistakes.md"

echo ""
echo "════════════════════════════════════════════════════════"
echo "   CLAUDE CODE — SESSION BRIEFING"
echo "   $(date '+%A, %B %d %Y — %H:%M')"
echo "════════════════════════════════════════════════════════"

# ── Print WHO the user is directly — no file reading needed ──
echo ""
echo "WHO YOU ARE TALKING TO:"
if [ -f "$PROFILE" ]; then
  grep -E "^- |^## Who|^## Core" "$PROFILE" 2>/dev/null | head -12 | sed 's/^/  /'
else
  echo "  Vipul — student from India, learning to code, building AI education product"
fi

# ── Print current projects ──
echo ""
echo "WHAT VIPUL IS BUILDING:"
if [ -f "$PROJECTS" ]; then
  grep -A3 "^### " "$PROJECTS" 2>/dev/null | head -10 | sed 's/^/  /'
fi

# ── Print key preferences ──
echo ""
echo "HOW TO COMMUNICATE:"
if [ -f "$PREFERENCES" ]; then
  grep -A2 "^## Explanation Style" "$PREFERENCES" 2>/dev/null | head -5 | sed 's/^/  /'
fi

# ── Print last session summary ──
echo ""
echo "LAST SESSION:"
if [ -f "$PROGRESS" ]; then
  grep -A6 "^## 20" "$PROGRESS" 2>/dev/null | head -8 | sed 's/^/  /' || \
  echo "  No previous session logged."
fi

# ── Print mistakes to never repeat ──
echo ""
echo "MISTAKES TO NEVER REPEAT:"
if [ -f "$MISTAKES" ]; then
  grep -E "^- |^### " "$MISTAKES" 2>/dev/null | head -5 | sed 's/^/  /' || \
  echo "  None logged yet."
fi

# ── Commands available ──
NEW_COMMANDS=$(ls "$PROJECT_DIR/.claude/commands/" 2>/dev/null | wc -l)
echo ""
echo "COMMANDS: $NEW_COMMANDS slash commands ready"
echo "  /memory = full briefing  |  /evolve = self-improve  |  /build = build features"
echo "════════════════════════════════════════════════════════"
echo ""
