# MCP Servers Setup Guide

## Already Working (No Setup Needed)
These work right now, every session:

| Server | What it gives Claude |
|---|---|
| Playwright | Open websites, click buttons, take screenshots |
| Memory | Remember things across sessions |
| Filesystem | Deep file access in your project |
| Sequential Thinking | Think through complex problems step by step |
| Context7 | Always up-to-date docs for any library |

---

## Need API Keys (One-Time Setup)
Add these in Claude Code web settings → Environment Variables

### GitHub (Deep GitHub integration)
- Where to get key: github.com → Settings → Developer Settings → Personal Access Tokens
- Variable name: `GITHUB_TOKEN`
- What it unlocks: Create PRs, manage issues, search code, all via Claude

### Brave Search (Better web search)
- Where to get key: brave.com/search/api (free tier available)
- Variable name: `BRAVE_API_KEY`
- What it unlocks: Privacy-focused web search, no tracking

### Notion (Notes and docs)
- Where to get key: notion.so → Settings → Integrations
- Variable name: `NOTION_TOKEN`
- What it unlocks: Read/write Notion pages, databases, tasks

### Supabase (Database)
- Where to get key: app.supabase.com → Account → Access Tokens
- Variable name: `SUPABASE_ACCESS_TOKEN`
- What it unlocks: Query and manage your Supabase database directly

### Vercel (Deployments)
- Where to get key: vercel.com → Settings → Tokens
- Variable name: `VERCEL_TOKEN`
- What it unlocks: Deploy projects, check deployment status, manage domains

### Cloudflare (CDN and hosting)
- Where to get key: dash.cloudflare.com → Profile → API Tokens
- Variable name: `CLOUDFLARE_API_TOKEN`
- What it unlocks: Manage workers, pages, DNS, caching

---

## How to Add an API Key
1. Open Claude Code on the web
2. Go to Settings (gear icon)
3. Find "Environment Variables"
4. Add the variable name and your key
5. Restart the session — the MCP server activates automatically
