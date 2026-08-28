# Waste Management Backend

Backend API for the waste-management-app (India). Households post waste pickup requests; nearby scrap dealers (kabadiwalas) get pinged in real time and race to accept — Rapido-style matching.

## Tech Stack

- **Node.js 20+** + **TypeScript** + **Express**
- **PostgreSQL 16 + PostGIS** for the source of truth (with geographic indexes)
- **Redis** for live dealer locations (`GEOSEARCH`) and race-safe accept locks (`SET NX`)
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

# 4. Apply Prisma migrations (creates tables + enables PostGIS extension)
npm run prisma:migrate

# 5. Apply the PostGIS spatial index (one-time, hand-written SQL)
psql "$DATABASE_URL" -f prisma/sql/postgis-index.sql

# 6. Start the dev server (hot reload via tsx)
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

## API Surface (v1)

All auth-required routes need `Authorization: Bearer <firebase-id-token>`.

### Auth + Users

- `POST /api/v1/auth/verify` — verify Firebase ID token, upsert User
- `POST /api/v1/users/select-role` — first-launch role pick (HOUSEHOLD/DEALER)
- `POST /api/v1/users/complete-profile` — role-specific fields
- `POST /api/v1/users/fcm-token` — register device push token
- `PATCH /api/v1/users/me` — update name/photo
- `GET /api/v1/users/me` — full profile with role side

### Household

- `POST /api/v1/pickups` — post a waste pickup (triggers dealer broadcast)
- `GET /api/v1/pickups/mine` — list own pickups
- `GET /api/v1/pickups/:id` — pickup detail (owner-guarded)
- `POST /api/v1/pickups/:id/cancel` — cancel while OPEN or ACCEPTED
- `POST /api/v1/pickups/:id/review` — rate the dealer after completion

### Dealer

- `POST /api/v1/dealer/online` — start receiving requests (adds to Redis GEO)
- `POST /api/v1/dealer/offline` — stop; removes from Redis
- `POST /api/v1/dealer/location` — heartbeat (every ~10s while online)
- `GET /api/v1/pickups/available` — fallback list of nearby OPEN pickups
- `POST /api/v1/pickups/:id/accept` — race-safe accept (Redis `SET NX`)
- `POST /api/v1/pickups/:id/start` — mark IN_PROGRESS on arrival
- `POST /api/v1/pickups/:id/complete` — enter weight + amount, create txn

### Uploads

- `GET /api/v1/uploads/signature?folder=waste-app/pickups` — Cloudinary signed upload signature; app uploads image directly to Cloudinary, then posts the returned URL to `/pickups`

### Admin

- `GET /api/v1/admin/users` (filter by role, blocked; paginated)
- `PATCH /api/v1/admin/users/:id/block`
- `PATCH /api/v1/admin/dealers/:id/verify`
- `GET /api/v1/admin/pickups`
- `GET /api/v1/admin/analytics`

### Realtime (Socket.IO)

Client connects with `{auth: {token: '<firebase-id-token>'}}`; server auto-joins them to `user:<userId>`.

Server-emitted events:
- `pickup:new-request` — sent to dealers when a nearby pickup opens
- `pickup:accepted` — sent to household when a dealer accepts
- `pickup:in-progress` — sent to household when dealer marks arrived
- `pickup:completed` — sent to household after completion
- `pickup:taken` — broadcast to other dealers so their list updates

## Deploying to Railway

1. Push this repo to GitHub.
2. In Railway, create a new project → **Deploy from GitHub repo** → select this repo.
3. Add two plugins from the dashboard:
   - **PostgreSQL** — Railway will set `DATABASE_URL` automatically.
   - **Redis** — Railway will set `REDIS_URL` automatically.
4. Enable the **PostGIS** extension on the Postgres instance:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
   (One-off via the Railway Postgres shell.)
5. Set the remaining env vars from `.env.example`:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
6. `railway.json` already declares:
   - Build via `backend/Dockerfile`
   - Start command runs `prisma migrate deploy` then `node dist/index.js`
   - Health check on `/healthz`
7. After first deploy, apply the PostGIS spatial index once:
   ```
   psql "$DATABASE_URL" -f backend/prisma/sql/postgis-index.sql
   ```
8. Deploy — Railway auto-deploys on every push to `main`.

## Folder Layout

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/            # created by `npm run prisma:migrate`
│   └── sql/postgis-index.sql  # hand-written spatial index (one-off)
├── src/
│   ├── config/                # env, prisma, redis, firebase, cloudinary, logger
│   ├── middleware/            # auth, requireRole, rateLimit, errorHandler
│   ├── modules/               # feature modules (auth, users, pickups, dealer, admin, uploads, health)
│   ├── realtime/socket.ts     # Socket.IO server
│   ├── lib/                   # geo, dealerGeo, notify, errors, auth
│   ├── types/                 # shared TS + ambient declarations
│   ├── app.ts                 # Express app builder (used by tests)
│   └── index.ts               # Process entry — boot + graceful shutdown
├── tests/                     # Vitest suite (57 tests)
├── scripts/smoke.sh
├── Dockerfile
├── railway.json
└── package.json
```

## Test Coverage

- `healthz.test.ts` — liveness probe (3 tests)
- `auth.test.ts` — Firebase token verify, role selection, profile completion (12)
- `pickups.test.ts` — CRUD, role gating, geographic validation (12)
- `dealer.test.ts` — online/offline/heartbeat routes (7)
- `dealerGeo.test.ts` — Redis GEO wrapper unit tests (6)
- `matching.test.ts` — broadcast filtering + **race-condition accept test** (6)
- `lifecycle.test.ts` — end-to-end post → accept → start → complete → review (5)
- `admin.test.ts` — role gate + list/block/verify/analytics (6)

Run: `npm test` — all 57 pass, ~2s.

## Roadmap Complete

- [x] Phase 1 — Foundations
- [x] Phase 2 — Auth + user model
- [x] Phase 3 — Pickup CRUD + Cloudinary
- [x] Phase 4 — Dealer online/offline + Redis GEO
- [x] Phase 5 — Matching algorithm (broadcast + first-accept lock)
- [x] Phase 6 — Lifecycle + reviews
- [x] Phase 7 — Admin API
- [x] Phase 8 — Hardening + Railway deploy

## Next: Android App

With the backend done, the mobile app work begins. Key integrations:
- Firebase Auth (phone OTP) — same Firebase project as backend
- Google Maps SDK for the map view + live dealer tracking (Socket.IO)
- Cloudinary upload widget for the pickup photos
- FCM handler to receive `pickup:new-request` push notifications
