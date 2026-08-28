# Project Architecture Memory

## How This Works
I update this file as I learn more about each project's structure.
This gives me deep context so I never make architectural mistakes.

## Current Projects

### Project: Waste Management App — Backend
- Location: `backend/`
- Branch: `claude/waste-management-app-5kbg5t`
- Language: TypeScript strict, Node.js 20+
- Framework: Express + Socket.IO
- Database: PostgreSQL 16 + PostGIS extension via Prisma ORM
- Cache/live layer: Redis (ioredis) — `GEOSEARCH` for nearby-dealer lookups, `SET NX` for race-safe accept
- Auth: Firebase Admin SDK (phone OTP), verified via `verifyIdToken`
- Push: Firebase Cloud Messaging (FCM) — same Firebase project as auth
- Uploads: Cloudinary signed direct-uploads (backend never streams bytes)
- Validation: Zod at every request boundary
- Deploy target: Railway (Dockerfile + railway.json committed)

Key architectural decisions:
1. **Postgres is source of truth, Redis is the accelerator** — dealer online state is written to both, but Postgres is authoritative
2. **Redis GEO for nearby dealers** — `GEOSEARCH FROMLONLAT ... BYRADIUS ... km ASC` returns matches in ~1ms
3. **Redis `SET NX` lock for accept** — first dealer wins, others get 409 (race-safe, tested with 10-parallel-accept test)
4. **Signed uploads for photos** — client uploads directly to Cloudinary, backend just returns a signature (no image bytes flow through us)
5. **Firebase phone OTP** — standard for Indian apps, free up to 10k/month
6. **Socket.IO room per user** — `user:<userId>` room lets us push to any device that user is on
7. **Background expiry worker** — setInterval that expires stale OPEN pickups and re-broadcasts at wider radius (30s tick)
8. **Layered auth** — `authMiddleware` sets `req.user`, `requireRole('HOUSEHOLD'|'DEALER'|'ADMIN')` gates each route

### Project: Claude Code Setup (this repo)
- Type: Configuration / tooling
- Key files: .claude/settings.json, CLAUDE.md, .claude/hooks/*, .claude/commands/*
- Architecture: Hook-driven automation + memory system + self-evolution engine

## Architecture Patterns I've Learned
- **Prisma + PostGIS**: Prisma doesn't model generated geography columns natively → keep a hand-written SQL migration alongside (`prisma/sql/postgis-index.sql`) applied after `prisma migrate deploy`
- **Test-friendly Firebase**: wrap `firebase-admin.auth().verifyIdToken` in a small `lib/auth.ts` function so tests can mock the wrapper instead of the SDK
- **Vitest `vi.mock` hoisting**: mock factories are hoisted above imports; use `vi.hoisted(() => ({...}))` to reference values from inside factories
- **`.d.ts` files with declaration merging**: don't add a runtime `import './types/express'`; TypeScript picks them up via `tsconfig.include` alone (Vitest can't resolve pure `.d.ts` at runtime)

## Key Decisions Made
- Broadcast + first-accept-wins matching model (like Rapido/early Uber)
- Cash-on-pickup payment (no gateway integration for MVP; UPI can layer in later)
- Phone-OTP auth (Firebase) over email/password — Indian market standard
- Railway over AWS for MVP — one-click Postgres+Redis, GitHub auto-deploy

## Files I Should Never Touch
- .env (secrets — never commit)
- node_modules/ (auto-generated)
- .next/ (build output)
- __pycache__/ (Python cache)
- prisma/migrations/*/migration.sql once applied to production (they are immutable history)
