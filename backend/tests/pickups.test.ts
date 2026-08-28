import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── In-memory fake tables ────────────────────────────────────────────

const userDb = new Map<string, any>();
const pickupDb = new Map<string, any>();

let uuidCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++uuidCounter}`;

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('../src/lib/auth', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        for (const u of userDb.values()) {
          if (where.firebaseUid && u.firebaseUid === where.firebaseUid) return u;
          if (where.id && u.id === where.id) return u;
        }
        return null;
      }),
    },
    pickupRequest: {
      create: vi.fn(async ({ data }: any) => {
        const row = {
          id: nextId('pk'),
          status: 'OPEN',
          acceptedDealerId: null,
          acceptedAt: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelledReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        pickupDb.set(row.id, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const row = pickupDb.get(where.id);
        if (!row) return null;
        if (!include) return row;
        return {
          ...row,
          household: include.household ? userDb.get(row.householdId) ?? null : undefined,
          dealer: include.dealer && row.acceptedDealerId
            ? userDb.get(row.acceptedDealerId) ?? null
            : null,
        };
      }),
      findMany: vi.fn(async ({ where, take, cursor, skip, orderBy }: any) => {
        let rows = [...pickupDb.values()].filter((r) => {
          if (where.householdId && r.householdId !== where.householdId) return false;
          if (where.status && r.status !== where.status) return false;
          return true;
        });
        rows.sort((a, b) => {
          if (orderBy?.createdAt === 'desc') {
            return b.createdAt.getTime() - a.createdAt.getTime();
          }
          return 0;
        });
        if (cursor) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          rows = idx >= 0 ? rows.slice(idx + (skip ?? 0)) : rows;
        }
        return rows.slice(0, take);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = pickupDb.get(where.id);
        if (!row) throw new Error('pickup not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
  },
}));

vi.mock('../src/config/redis', () => ({
  redis: { on: vi.fn(), quit: vi.fn() },
  pingRedis: vi.fn().mockResolvedValue(true),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────

import request from 'supertest';
import { buildApp } from '../src/app';
import { verifyFirebaseIdToken } from '../src/lib/auth';

const asMock = <T>(v: T) => v as unknown as ReturnType<typeof vi.fn>;

function seedUser(overrides: Partial<any> = {}) {
  const id = overrides.id ?? nextId('u');
  const u = {
    id,
    firebaseUid: overrides.firebaseUid ?? `fb_${id}`,
    phone: overrides.phone ?? '+919000000000',
    role: overrides.role ?? null,
    name: overrides.name ?? null,
    profilePhoto: null,
    fcmToken: null,
    isBlocked: false,
    ...overrides,
  };
  userDb.set(id, u);
  return u;
}

function loginAs(uid: string, phone: string) {
  asMock(verifyFirebaseIdToken).mockResolvedValue({ uid, phoneNumber: phone });
}

const bearer = 'Bearer fake-token';

// Valid Bengaluru coords for the "plausible India" check
const BLR = { lat: 12.9716, lng: 77.5946 };

const validCreateBody = {
  wasteTypes: ['iron', 'plastic'],
  photoUrls: ['https://res.cloudinary.com/demo/image/upload/v1/w/a.jpg'],
  estimatedWeightKg: 5,
  description: 'Old bucket + bottles',
  pickupAddress: '221B MG Road, Bengaluru',
  pickupLat: BLR.lat,
  pickupLng: BLR.lng,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('POST /api/v1/pickups', () => {
  beforeEach(() => {
    userDb.clear();
    pickupDb.clear();
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  it('rejects requests from a DEALER', async () => {
    const dealer = seedUser({ role: 'DEALER', firebaseUid: 'fb-d', phone: '+919111111111' });
    loginAs(dealer.firebaseUid, dealer.phone);

    const res = await request(buildApp())
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreateBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects when household hasn\'t selected a role yet', async () => {
    const u = seedUser({ role: null, firebaseUid: 'fb-nr', phone: '+919222222222' });
    loginAs(u.firebaseUid, u.phone);

    const res = await request(buildApp())
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreateBody);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/role/i);
  });

  it('creates a pickup for a HOUSEHOLD with valid body', async () => {
    const h = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-h', phone: '+919333333333' });
    loginAs(h.firebaseUid, h.phone);

    const res = await request(buildApp())
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreateBody);

    expect(res.status).toBe(201);
    expect(res.body.pickup.status).toBe('OPEN');
    expect(res.body.pickup.wasteTypes).toEqual(['iron', 'plastic']);
    expect(res.body.pickup.householdId).toBe(h.id);
    expect(new Date(res.body.pickup.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(pickupDb.size).toBe(1);
  });

  it('rejects a body with no photos', async () => {
    const h = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-hp', phone: '+919444444444' });
    loginAs(h.firebaseUid, h.phone);

    const res = await request(buildApp())
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send({ ...validCreateBody, photoUrls: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects coordinates outside India', async () => {
    const h = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-hi', phone: '+919555555555' });
    loginAs(h.firebaseUid, h.phone);

    // London coords
    const res = await request(buildApp())
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send({ ...validCreateBody, pickupLat: 51.5, pickupLng: -0.12 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/region/i);
  });

  it('rejects an unknown waste type', async () => {
    const h = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-hw', phone: '+919666666666' });
    loginAs(h.firebaseUid, h.phone);

    const res = await request(buildApp())
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send({ ...validCreateBody, wasteTypes: ['uranium'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/pickups/mine', () => {
  beforeEach(() => {
    userDb.clear();
    pickupDb.clear();
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  it('returns only the household\'s own pickups', async () => {
    const h1 = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-h1', phone: '+919111000001' });
    const h2 = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-h2', phone: '+919111000002' });
    loginAs(h1.firebaseUid, h1.phone);

    const app = buildApp();
    await request(app).post('/api/v1/pickups').set('Authorization', bearer).send(validCreateBody);
    await request(app).post('/api/v1/pickups').set('Authorization', bearer).send(validCreateBody);

    loginAs(h2.firebaseUid, h2.phone);
    await request(app).post('/api/v1/pickups').set('Authorization', bearer).send(validCreateBody);

    loginAs(h1.firebaseUid, h1.phone);
    const res = await request(app).get('/api/v1/pickups/mine').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    for (const p of res.body.items) {
      expect(p.householdId).toBe(h1.id);
    }
  });
});

describe('POST /api/v1/pickups/:id/cancel', () => {
  beforeEach(() => {
    userDb.clear();
    pickupDb.clear();
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  it('cancels an OPEN pickup', async () => {
    const h = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-c', phone: '+919777000001' });
    loginAs(h.firebaseUid, h.phone);
    const app = buildApp();

    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreateBody);

    const res = await request(app)
      .post(`/api/v1/pickups/${created.body.pickup.id}/cancel`)
      .set('Authorization', bearer)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.pickup.status).toBe('CANCELLED');
    expect(res.body.pickup.cancelledReason).toBe('Changed my mind');
  });

  it('refuses to cancel a COMPLETED pickup', async () => {
    const h = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-cc', phone: '+919777000002' });
    loginAs(h.firebaseUid, h.phone);
    const app = buildApp();

    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreateBody);
    // Force-flip state to COMPLETED
    pickupDb.get(created.body.pickup.id).status = 'COMPLETED';

    const res = await request(app)
      .post(`/api/v1/pickups/${created.body.pickup.id}/cancel`)
      .set('Authorization', bearer)
      .send({});

    expect(res.status).toBe(409);
  });

  it('refuses when a different household tries to cancel', async () => {
    const h1 = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-x1', phone: '+919888000001' });
    const h2 = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-x2', phone: '+919888000002' });
    loginAs(h1.firebaseUid, h1.phone);
    const app = buildApp();

    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreateBody);

    loginAs(h2.firebaseUid, h2.phone);
    const res = await request(app)
      .post(`/api/v1/pickups/${created.body.pickup.id}/cancel`)
      .set('Authorization', bearer)
      .send({});

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/pickups/:id', () => {
  beforeEach(() => {
    userDb.clear();
    pickupDb.clear();
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  it('returns 404 for a non-existent id', async () => {
    const h = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-nf', phone: '+919999000001' });
    loginAs(h.firebaseUid, h.phone);

    const res = await request(buildApp())
      .get('/api/v1/pickups/does-not-exist')
      .set('Authorization', bearer);

    expect(res.status).toBe(404);
  });

  it('returns 403 when a household tries to peek at another household\'s pickup', async () => {
    const h1 = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-p1', phone: '+919999000010' });
    const h2 = seedUser({ role: 'HOUSEHOLD', firebaseUid: 'fb-p2', phone: '+919999000011' });
    loginAs(h1.firebaseUid, h1.phone);
    const app = buildApp();

    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreateBody);

    loginAs(h2.firebaseUid, h2.phone);
    const res = await request(app)
      .get(`/api/v1/pickups/${created.body.pickup.id}`)
      .set('Authorization', bearer);

    expect(res.status).toBe(403);
  });
});
