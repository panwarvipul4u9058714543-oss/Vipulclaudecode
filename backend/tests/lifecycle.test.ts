import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── State ────────────────────────────────────────────────────────────

const userDb = new Map<string, any>();
const householdProfileDb = new Map<string, any>();
const dealerDb = new Map<string, any>();
const pickupDb = new Map<string, any>();
const transactionDb = new Map<string, any>();
const reviewDb = new Map<string, any>();
const redisStore = new Map<string, string>();

let uuidCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++uuidCounter}`;

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('../src/lib/auth', () => ({ verifyFirebaseIdToken: vi.fn() }));

vi.mock('../src/lib/notify', () => ({
  notifyUser: vi.fn().mockResolvedValue(undefined),
  notifyMany: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/lib/dealerGeo', () => ({
  DEALERS_LIVE_KEY: 'dealers:live',
  findNearbyDealers: vi.fn().mockResolvedValue([]),
  upsertDealerLocation: vi.fn(),
  removeDealerLocation: vi.fn(),
  countOnlineDealers: vi.fn().mockResolvedValue(0),
}));

const mkTx = () => ({
  pickupRequest: {
    update: async ({ where, data }: any) => {
      const r = pickupDb.get(where.id);
      Object.assign(r, data, { updatedAt: new Date() });
      return r;
    },
  },
  pickupTransaction: {
    create: async ({ data }: any) => {
      const row = { id: nextId('tx'), createdAt: new Date(), paymentMethod: 'CASH', ...data };
      transactionDb.set(row.id, row);
      return row;
    },
  },
  householdProfile: {
    update: async ({ where, data }: any) => {
      const row = householdProfileDb.get(where.userId) ?? {
        userId: where.userId,
        totalPickups: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'increment' in v) {
          row[k] = (row[k] ?? 0) + (v as any).increment;
        } else {
          row[k] = v;
        }
      }
      householdProfileDb.set(where.userId, row);
      return row;
    },
  },
  dealerProfile: {
    update: async ({ where, data }: any) => {
      const row = dealerDb.get(where.userId);
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'increment' in v) {
          row[k] = (row[k] ?? 0) + (v as any).increment;
        } else {
          row[k] = v;
        }
      }
      return row;
    },
  },
});

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (fn: any) => fn(mkTx())),
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        for (const u of userDb.values()) {
          if (where.firebaseUid && u.firebaseUid === where.firebaseUid) return u;
          if (where.id && u.id === where.id) return u;
        }
        return null;
      }),
    },
    dealerProfile: {
      findUnique: vi.fn(async ({ where, include }: any) => {
        const d = dealerDb.get(where.userId);
        if (!d) return null;
        return include?.user ? { ...d, user: userDb.get(d.userId) } : d;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = dealerDb.get(where.userId);
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in v) {
            row[k] = (row[k] ?? 0) + (v as any).increment;
          } else {
            row[k] = v;
          }
        }
        return row;
      }),
    },
    householdProfile: {
      update: vi.fn(async ({ where, data }: any) => {
        const row = householdProfileDb.get(where.userId) ?? {
          userId: where.userId,
          totalPickups: 0,
          ratingSum: 0,
          ratingCount: 0,
        };
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in v) {
            row[k] = (row[k] ?? 0) + (v as any).increment;
          } else {
            row[k] = v;
          }
        }
        householdProfileDb.set(where.userId, row);
        return row;
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
      findUnique: vi.fn(async ({ where }: any) => pickupDb.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const row = pickupDb.get(where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    review: {
      create: vi.fn(async ({ data }: any) => {
        const key = `${data.pickupRequestId}:${data.reviewerId}`;
        if (reviewDb.has(key)) {
          throw new Error('Unique constraint failed on reviews.pickupRequestId,reviewerId');
        }
        const row = { id: nextId('rv'), createdAt: new Date(), ...data };
        reviewDb.set(key, row);
        return row;
      }),
    },
  },
}));

vi.mock('../src/config/redis', () => ({
  redis: {
    on: vi.fn(),
    quit: vi.fn(),
    set: vi.fn(async (key: string, value: string, _m: string, _t: number, flag?: string) => {
      if (flag === 'NX') {
        if (redisStore.has(key)) return null;
        redisStore.set(key, value);
        return 'OK';
      }
      redisStore.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => (redisStore.delete(key) ? 1 : 0)),
  },
  pingRedis: vi.fn().mockResolvedValue(true),
}));

// ─── Imports ──────────────────────────────────────────────────────────

import request from 'supertest';
import { buildApp } from '../src/app';
import { verifyFirebaseIdToken } from '../src/lib/auth';

const asMock = <T>(v: T) => v as unknown as ReturnType<typeof vi.fn>;

function seedHousehold() {
  const id = nextId('h');
  const u = {
    id,
    firebaseUid: `fb_${id}`,
    phone: `+91900${String(uuidCounter).padStart(7, '0')}`,
    role: 'HOUSEHOLD',
    name: 'Home',
    fcmToken: null,
    isBlocked: false,
  };
  userDb.set(id, u);
  householdProfileDb.set(id, {
    userId: id,
    totalPickups: 0,
    ratingSum: 0,
    ratingCount: 0,
  });
  return u;
}

function seedDealer() {
  const id = nextId('d');
  const u = {
    id,
    firebaseUid: `fb_${id}`,
    phone: `+91911${String(uuidCounter).padStart(7, '0')}`,
    role: 'DEALER',
    name: 'Dealer',
    fcmToken: null,
    isBlocked: false,
  };
  userDb.set(id, u);
  dealerDb.set(id, {
    userId: id,
    isVerified: true,
    isOnline: true,
    acceptedWasteTypes: ['iron', 'plastic'],
    vehicleType: 'CYCLE_CART',
    currentLat: 12.9716,
    currentLng: 77.5946,
    totalPickups: 0,
    ratingSum: 0,
    ratingCount: 0,
  });
  return u;
}

function login(u: { firebaseUid: string; phone: string }) {
  asMock(verifyFirebaseIdToken).mockResolvedValue({
    uid: u.firebaseUid,
    phoneNumber: u.phone,
  });
}

const bearer = 'Bearer x';
const BLR = { lat: 12.9716, lng: 77.5946 };
const validCreate = {
  wasteTypes: ['iron'],
  photoUrls: ['https://x/1.jpg'],
  pickupAddress: 'MG Road',
  pickupLat: BLR.lat,
  pickupLng: BLR.lng,
};

// ─── The full happy path ──────────────────────────────────────────────

describe('End-to-end pickup lifecycle', () => {
  beforeEach(() => {
    userDb.clear();
    householdProfileDb.clear();
    dealerDb.clear();
    pickupDb.clear();
    transactionDb.clear();
    reviewDb.clear();
    redisStore.clear();
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  it('post → accept → start → complete → both review', async () => {
    const household = seedHousehold();
    const dealer = seedDealer();
    const app = buildApp();

    // 1) Household posts pickup
    login(household);
    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreate);
    expect(created.status).toBe(201);
    const pickupId: string = created.body.pickup.id;

    // 2) Dealer accepts
    login(dealer);
    const accepted = await request(app)
      .post(`/api/v1/pickups/${pickupId}/accept`)
      .set('Authorization', bearer);
    expect(accepted.status).toBe(200);
    expect(accepted.body.pickup.status).toBe('ACCEPTED');

    // 3) Dealer starts (arrived)
    const started = await request(app)
      .post(`/api/v1/pickups/${pickupId}/start`)
      .set('Authorization', bearer);
    expect(started.status).toBe(200);
    expect(started.body.pickup.status).toBe('IN_PROGRESS');

    // 4) Dealer completes with weight + amount
    const completed = await request(app)
      .post(`/api/v1/pickups/${pickupId}/complete`)
      .set('Authorization', bearer)
      .send({
        finalWeightKg: 4.5,
        finalAmountRupees: 200,
        paymentMethod: 'CASH',
        dealerNotes: 'clean iron',
      });
    expect(completed.status).toBe(200);
    expect(completed.body.pickup.status).toBe('COMPLETED');
    expect(transactionDb.size).toBe(1);
    const tx = [...transactionDb.values()][0];
    expect(tx.finalWeightKg).toBe(4.5);
    expect(tx.finalAmountRupees).toBe(200);

    // 5) Dealer reviews household
    const dealerReview = await request(app)
      .post(`/api/v1/pickups/${pickupId}/review`)
      .set('Authorization', bearer)
      .send({ stars: 5, comment: 'polite family' });
    expect(dealerReview.status).toBe(200);

    // 6) Household reviews dealer
    login(household);
    const householdReview = await request(app)
      .post(`/api/v1/pickups/${pickupId}/review`)
      .set('Authorization', bearer)
      .send({ stars: 4, comment: 'on time' });
    expect(householdReview.status).toBe(200);

    // Counters bumped
    expect(dealerDb.get(dealer.id).totalPickups).toBe(1);
    expect(dealerDb.get(dealer.id).ratingSum).toBe(4);
    expect(dealerDb.get(dealer.id).ratingCount).toBe(1);
    expect(householdProfileDb.get(household.id).totalPickups).toBe(1);
    expect(householdProfileDb.get(household.id).ratingSum).toBe(5);
    expect(householdProfileDb.get(household.id).ratingCount).toBe(1);
  });

  it('cannot start a pickup that is not yours (dealer hasn\'t accepted it)', async () => {
    const household = seedHousehold();
    const dealer = seedDealer();
    const app = buildApp();

    login(household);
    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreate);
    const pickupId: string = created.body.pickup.id;

    login(dealer);
    // Try to start before accepting — ownership check fires first.
    const res = await request(app)
      .post(`/api/v1/pickups/${pickupId}/start`)
      .set('Authorization', bearer);
    expect(res.status).toBe(403);
  });

  it('cannot complete a pickup that is not IN_PROGRESS', async () => {
    const household = seedHousehold();
    const dealer = seedDealer();
    const app = buildApp();

    login(household);
    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreate);
    const pickupId: string = created.body.pickup.id;

    login(dealer);
    await request(app).post(`/api/v1/pickups/${pickupId}/accept`).set('Authorization', bearer);

    // Skip start, try to complete
    const res = await request(app)
      .post(`/api/v1/pickups/${pickupId}/complete`)
      .set('Authorization', bearer)
      .send({ finalWeightKg: 5, finalAmountRupees: 100 });
    expect(res.status).toBe(409);
  });

  it('rejects a review before completion', async () => {
    const household = seedHousehold();
    const dealer = seedDealer();
    const app = buildApp();

    login(household);
    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreate);
    const pickupId: string = created.body.pickup.id;

    login(dealer);
    await request(app).post(`/api/v1/pickups/${pickupId}/accept`).set('Authorization', bearer);

    // Try to review while ACCEPTED (not COMPLETED)
    const res = await request(app)
      .post(`/api/v1/pickups/${pickupId}/review`)
      .set('Authorization', bearer)
      .send({ stars: 5 });
    expect(res.status).toBe(409);
  });

  it('rejects a duplicate review from the same user on the same pickup', async () => {
    const household = seedHousehold();
    const dealer = seedDealer();
    const app = buildApp();

    login(household);
    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validCreate);
    const pickupId: string = created.body.pickup.id;

    login(dealer);
    await request(app).post(`/api/v1/pickups/${pickupId}/accept`).set('Authorization', bearer);
    await request(app).post(`/api/v1/pickups/${pickupId}/start`).set('Authorization', bearer);
    await request(app)
      .post(`/api/v1/pickups/${pickupId}/complete`)
      .set('Authorization', bearer)
      .send({ finalWeightKg: 1, finalAmountRupees: 20 });

    const first = await request(app)
      .post(`/api/v1/pickups/${pickupId}/review`)
      .set('Authorization', bearer)
      .send({ stars: 5 });
    expect(first.status).toBe(200);

    const dup = await request(app)
      .post(`/api/v1/pickups/${pickupId}/review`)
      .set('Authorization', bearer)
      .send({ stars: 4 });
    expect(dup.status).toBe(409);
  });
});
