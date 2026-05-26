# Project Architecture Memory

## How This Works
I update this file as I learn more about each project's structure.
This gives me deep context so I never make architectural mistakes.

## Current Projects

### Project: Claude Code Setup (this repo)
- Type: Configuration / tooling
- Branch: claude/claude-code-behavior-ZaHl5
- Key files: .claude/settings.json, CLAUDE.md, .claude/hooks/*, .claude/commands/*
- Architecture: Hook-driven automation + memory system + self-evolution engine

## Architecture Patterns I've Learned
<!-- I update this as I work on real projects with Vipul -->

## Key Decisions Made
<!-- Important architectural decisions and why they were made -->

## Files I Should Never Touch
<!-- Files that are sensitive or auto-generated -->
- .env (secrets — never commit)
- node_modules/ (auto-generated)
- .next/ (build output)
- __pycache__/ (Python cache)
