# Waste Management Backend

Backend API for the waste-management-app (India). Households post waste pickup requests; nearby scrap dealers (kabadiwalas) get pinged in real time and race to accept — Rapido-style matching.

## Tech Stack

- **Node.js 20+** + **TypeScript** + **Express**
- **PostgreSQL 16 + PostGIS** for the source of truth (with geographic indexes)
- **Redis** for live dealer locations (`GEOSEARCH`) and accept locks
- **Prisma** ORM
- **Firebase Auth** (phone OTP) + **Firebase Cloud Messaging** (push)
- **Socket.IO** for realtime updates
- **Cloudinary** for photo uploads
- **Vitest** + **Supertest** for tests

## Quick Start (Local Dev)

Requirements: Node 20+, npm 10+, Docker.

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in secrets (Firebase, Cloudinary)
cp .env.example .env

# 3. Start Postgres + Redis in Docker (from repo root)
npm run db:up

# 4. Generate Prisma client + apply migrations
npm run prisma:migrate

# 5. Start the dev server (hot reload via tsx)
npm run dev
```

Visit http://localhost:3000/healthz — you should see `{ok: true, db: true, redis: true}`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled build (production entry) |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | TypeScript check without emitting files |
| `npm run lint` | ESLint over `src/` and `tests/` |
| `npm run format` | Prettier auto-format |
| `npm run prisma:migrate` | Create+apply a new Prisma migration |
| `npm run prisma:studio` | Open Prisma's DB browser |
| `npm run db:up` | Start Postgres+Redis via Docker Compose |
| `npm run db:down` | Stop the Docker services |

## Folder Layout

```
backend/
├── prisma/           # Schema + migrations
├── src/
│   ├── config/       # env, prisma, redis, logger
│   ├── middleware/   # auth, error handler, rate limit
│   ├── modules/      # feature modules (auth, pickups, dealer, …)
│   ├── realtime/     # Socket.IO server
│   ├── lib/          # shared helpers (geo, errors, notify)
│   ├── types/        # shared TS + Zod schemas
│   ├── app.ts        # Express app builder (used by tests too)
│   └── index.ts      # Process entry — boot + graceful shutdown
├── tests/
└── package.json
```

## Environment Variables

See `.env.example`. Every var is validated at startup by `src/config/env.ts` — if anything is missing or malformed the process exits with a clear message. No silent misconfigurations.

## Build Phases

The backend is built in 8 phases (see `/root/.claude/plans/i-want-to-build-encapsulated-giraffe.md`):

- **Phase 1** — Foundations (this) ✅
- **Phase 2** — Auth + user model
- **Phase 3** — Pickup CRUD + Cloudinary
- **Phase 4** — Dealer online/offline + Redis GEO
- **Phase 5** — Matching algorithm
- **Phase 6** — Lifecycle + reviews
- **Phase 7** — Admin API
- **Phase 8** — Hardening + Railway deploy
