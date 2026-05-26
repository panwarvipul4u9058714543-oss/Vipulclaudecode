#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

echo "Setting up project environment..."

# Node.js / npm
if [ -f "package.json" ]; then
  echo "Found package.json — installing Node dependencies..."
  npm install
fi

# Python - pip
if [ -f "requirements.txt" ]; then
  echo "Found requirements.txt — installing Python dependencies..."
  pip install -r requirements.txt --quiet
fi

# Python - pyproject.toml / poetry
if [ -f "pyproject.toml" ]; then
  if command -v poetry &>/dev/null; then
    echo "Found pyproject.toml — installing via Poetry..."
    poetry install --no-interaction
  else
    pip install -e . --quiet 2>/dev/null || true
  fi
fi

# Python - pipenv
if [ -f "Pipfile" ]; then
  echo "Found Pipfile — installing via pipenv..."
  pip install pipenv --quiet
  pipenv install --dev --system 2>/dev/null || true
fi

# Ruby
if [ -f "Gemfile" ]; then
  echo "Found Gemfile — installing Ruby gems..."
  bundle install --quiet
fi

# Go
if [ -f "go.mod" ]; then
  echo "Found go.mod — downloading Go modules..."
  go mod download
fi

# Rust
if [ -f "Cargo.toml" ]; then
  echo "Found Cargo.toml — fetching Rust dependencies..."
  cargo fetch
fi

echo "Environment setup complete."
