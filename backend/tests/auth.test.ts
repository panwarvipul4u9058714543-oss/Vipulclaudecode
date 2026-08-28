import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (declared before imports that use them) ────────────────────

vi.mock('../src/lib/auth', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

const userDb = new Map<string, any>();
const householdDb = new Map<string, any>();
const dealerDb = new Map<string, any>();

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn(async ({ where, include }: any) => {
        for (const u of userDb.values()) {
          if (where.firebaseUid && u.firebaseUid === where.firebaseUid) return u;
          if (where.id && u.id === where.id) {
            if (include) {
              return {
                ...u,
                household: include.household ? householdDb.get(u.id) ?? null : undefined,
                dealer: include.dealer ? dealerDb.get(u.id) ?? null : undefined,
              };
            }
            return u;
          }
        }
        return null;
      }),
      upsert: vi.fn(async ({ where, create }: any) => {
        for (const u of userDb.values()) {
          if (u.firebaseUid === where.firebaseUid) return u;
        }
        const created = {
          id: `u_${userDb.size + 1}`,
          role: null,
          name: null,
          profilePhoto: null,
          fcmToken: null,
          isBlocked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        userDb.set(created.id, created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = userDb.get(where.id);
        if (!u) throw new Error('user not found');
        Object.assign(u, data, { updatedAt: new Date() });
        return u;
      }),
    },
    householdProfile: {
      upsert: vi.fn(async ({ where, create }: any) => {
        const existing = householdDb.get(where.userId);
        if (existing) return existing;
        const row = { ...create, createdAt: new Date(), updatedAt: new Date() };
        householdDb.set(where.userId, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = householdDb.get(where.userId);
        if (!row) throw new Error('household profile not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    dealerProfile: {
      upsert: vi.fn(async ({ where, create }: any) => {
        const existing = dealerDb.get(where.userId);
        if (existing) return existing;
        const row = {
          ...create,
          isOnline: false,
          isVerified: false,
          totalPickups: 0,
          ratingSum: 0,
          ratingCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        dealerDb.set(where.userId, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = dealerDb.get(where.userId);
        if (!row) throw new Error('dealer profile not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn({
      user: {
        update: async ({ where, data }: any) => {
          const u = userDb.get(where.id);
          Object.assign(u, data);
          return u;
        },
      },
      householdProfile: {
        upsert: async ({ where, create }: any) => {
          const existing = householdDb.get(where.userId);
          if (existing) return existing;
          const row = { ...create };
          householdDb.set(where.userId, row);
          return row;
        },
      },
      dealerProfile: {
        upsert: async ({ where, create }: any) => {
          const existing = dealerDb.get(where.userId);
          if (existing) return existing;
          const row = { ...create, acceptedWasteTypes: create.acceptedWasteTypes ?? [] };
          dealerDb.set(where.userId, row);
          return row;
        },
      },
    })),
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
import { AppError } from '../src/lib/errors';

const asMock = <T>(v: T) => v as unknown as ReturnType<typeof vi.fn>;

function mockFirebase(uid: string, phone: string) {
  asMock(verifyFirebaseIdToken).mockResolvedValue({ uid, phoneNumber: phone });
}

const bearer = 'Bearer fake-id-token';

// ─── Tests ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/verify', () => {
  beforeEach(() => {
    userDb.clear();
    householdDb.clear();
    dealerDb.clear();
    vi.clearAllMocks();
  });

  it('rejects requests without an Authorization header', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/verify');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates a new user on first verify and returns needsRole=true', async () => {
    mockFirebase('firebase-uid-1', '+919000000001');
    const res = await request(buildApp())
      .post('/api/v1/auth/verify')
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('+919000000001');
    expect(res.body.user.role).toBeNull();
    expect(res.body.needsRole).toBe(true);
  });

  it('returns existing user on second verify (idempotent)', async () => {
    mockFirebase('firebase-uid-2', '+919000000002');
    const app = buildApp();
    const first = await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);
    const second = await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('rejects an invalid token', async () => {
    asMock(verifyFirebaseIdToken).mockRejectedValue(
      new AppError(401, 'UNAUTHORIZED', 'Invalid token'),
    );
    const res = await request(buildApp())
      .post('/api/v1/auth/verify')
      .set('Authorization', bearer);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/users/select-role', () => {
  beforeEach(() => {
    userDb.clear();
    householdDb.clear();
    dealerDb.clear();
    vi.clearAllMocks();
  });

  it('lets a new user become HOUSEHOLD and creates the profile row', async () => {
    mockFirebase('uid-h', '+919111111111');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);

    const res = await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'HOUSEHOLD', name: 'Anita' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('HOUSEHOLD');
    expect(res.body.user.name).toBe('Anita');
    expect(householdDb.size).toBe(1);
    expect(dealerDb.size).toBe(0);
  });

  it('lets a new user become DEALER and creates the dealer profile row', async () => {
    mockFirebase('uid-d', '+919222222222');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);

    const res = await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'DEALER', name: 'Ramesh' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('DEALER');
    expect(dealerDb.size).toBe(1);
  });

  it('rejects a role change once a role is set', async () => {
    mockFirebase('uid-hc', '+919333333333');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);
    await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'HOUSEHOLD', name: 'Deepa' });

    const change = await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'DEALER', name: 'Deepa' });

    expect(change.status).toBe(409);
    expect(change.body.error.code).toBe('CONFLICT');
  });

  it('validates the request body with Zod', async () => {
    mockFirebase('uid-v', '+919444444444');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);

    const res = await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'ADMIN', name: 'Nope' }); // ADMIN not allowed here

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/users/complete-profile', () => {
  beforeEach(() => {
    userDb.clear();
    householdDb.clear();
    dealerDb.clear();
    vi.clearAllMocks();
  });

  it('household path: saves address + lat/lng', async () => {
    mockFirebase('uid-hp', '+919555555555');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);
    await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'HOUSEHOLD', name: 'Maya' });

    const res = await request(app)
      .post('/api/v1/users/complete-profile')
      .set('Authorization', bearer)
      .send({
        defaultAddress: '221B, MG Road, Bengaluru',
        defaultLat: 12.9716,
        defaultLng: 77.5946,
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.defaultLat).toBe(12.9716);
    expect(res.body.profile.defaultAddress).toContain('Bengaluru');
  });

  it('dealer path: rejects an invalid Aadhaar', async () => {
    mockFirebase('uid-dp', '+919666666666');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);
    await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'DEALER', name: 'Suresh' });

    const res = await request(app)
      .post('/api/v1/users/complete-profile')
      .set('Authorization', bearer)
      .send({
        aadhaarNumber: '123', // too short
        vehicleType: 'CYCLE_CART',
        acceptedWasteTypes: ['iron', 'paper'],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('dealer path: hashes Aadhaar and never returns raw or hash', async () => {
    mockFirebase('uid-dp2', '+919777777777');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);
    await request(app)
      .post('/api/v1/users/select-role')
      .set('Authorization', bearer)
      .send({ role: 'DEALER', name: 'Suresh' });

    const res = await request(app)
      .post('/api/v1/users/complete-profile')
      .set('Authorization', bearer)
      .send({
        aadhaarNumber: '123456789012',
        vehicleType: 'AUTO',
        acceptedWasteTypes: ['iron', 'plastic'],
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.aadhaarNumberHash).toBeUndefined();
    expect(res.body.profile.vehicleType).toBe('AUTO');
    expect(res.body.profile.acceptedWasteTypes).toEqual(['iron', 'plastic']);
  });
});

describe('requireRole gate', () => {
  it('rejects a request from a user with no role selected', async () => {
    // Bypass authMiddleware by mocking prisma to return a role-less user
    mockFirebase('uid-noRole', '+919888888888');
    const app = buildApp();
    await request(app).post('/api/v1/auth/verify').set('Authorization', bearer);

    // complete-profile should error because no role was selected
    const res = await request(app)
      .post('/api/v1/users/complete-profile')
      .set('Authorization', bearer)
      .send({ defaultAddress: 'x', defaultLat: 0, defaultLng: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/role/i);
  });
});
