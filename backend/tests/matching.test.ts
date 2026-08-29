import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── State ────────────────────────────────────────────────────────────

const userDb = new Map<string, any>();
const dealerDb = new Map<string, any>();
const pickupDb = new Map<string, any>();

const notifyMock = vi.fn();

let uuidCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++uuidCounter}`;

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('../src/lib/auth', () => ({ verifyFirebaseIdToken: vi.fn() }));

vi.mock('../src/lib/notify', () => ({
  notifyUser: vi.fn(),
  notifyMany: (arr: unknown[]) => notifyMock(arr),
}));

vi.mock('../src/lib/dealerGeo', () => ({
  DEALERS_LIVE_KEY: 'dealers:live',
  findNearbyDealers: vi.fn(),
  upsertDealerLocation: vi.fn(),
  removeDealerLocation: vi.fn(),
  countOnlineDealers: vi.fn().mockResolvedValue(0),
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
    dealerProfile: {
      findUnique: vi.fn(async ({ where, include }: any) => {
        const d = dealerDb.get(where.userId);
        if (!d) return null;
        if (include?.user) {
          return { ...d, user: userDb.get(d.userId) };
        }
        return d;
      }),
      findMany: vi.fn(async ({ where, include }: any) => {
        const ids = where.userId?.in ?? [];
        return ids
          .map((id: string) => dealerDb.get(id))
          .filter(Boolean)
          .filter((d: any) => {
            if (where.isVerified !== undefined && d.isVerified !== where.isVerified) return false;
            if (where.isOnline !== undefined && d.isOnline !== where.isOnline) return false;
            return true;
          })
          .map((d: any) => (include?.user ? { ...d, user: userDb.get(d.userId) } : d));
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
        if (!row) throw new Error('pickup not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
  },
}));

// A minimal Redis stub with a SET NX simulator for the race test.
const redisStore = new Map<string, string>();
vi.mock('../src/config/redis', () => ({
  redis: {
    on: vi.fn(),
    quit: vi.fn(),
    set: vi.fn(async (key: string, value: string, _mode: string, _ttl: number, flag?: string) => {
      if (flag === 'NX') {
        if (redisStore.has(key)) return null;
        redisStore.set(key, value);
        return 'OK';
      }
      redisStore.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      const had = redisStore.delete(key);
      return had ? 1 : 0;
    }),
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  },
  pingRedis: vi.fn().mockResolvedValue(true),
}));

// ─── Imports ──────────────────────────────────────────────────────────

import request from 'supertest';
import { buildApp } from '../src/app';
import { verifyFirebaseIdToken } from '../src/lib/auth';
import { findNearbyDealers } from '../src/lib/dealerGeo';
import { broadcastPickup } from '../src/modules/pickups/matching';

const asMock = <T>(v: T) => v as unknown as ReturnType<typeof vi.fn>;

function seedHousehold(overrides: Partial<any> = {}) {
  const id = overrides.id ?? nextId('h');
  const u = {
    id,
    firebaseUid: `fb_${id}`,
    phone: overrides.phone ?? `+919000${String(uuidCounter).padStart(6, '0')}`,
    role: 'HOUSEHOLD',
    name: 'Household',
    fcmToken: 'fake-fcm-h',
    isBlocked: false,
  };
  userDb.set(id, u);
  return u;
}

function seedDealer(opts: {
  verified?: boolean;
  online?: boolean;
  wasteTypes?: string[];
} = {}) {
  const id = nextId('d');
  const u = {
    id,
    firebaseUid: `fb_${id}`,
    phone: `+919111${String(uuidCounter).padStart(6, '0')}`,
    role: 'DEALER',
    name: `Dealer ${id}`,
    fcmToken: `fcm-${id}`,
    isBlocked: false,
  };
  userDb.set(id, u);
  dealerDb.set(id, {
    userId: id,
    isVerified: opts.verified ?? true,
    isOnline: opts.online ?? true,
    acceptedWasteTypes: opts.wasteTypes ?? ['iron', 'plastic'],
    vehicleType: 'CYCLE_CART',
    currentLat: 12.9716,
    currentLng: 77.5946,
  });
  return u;
}

function login(user: { firebaseUid: string; phone: string }) {
  asMock(verifyFirebaseIdToken).mockResolvedValue({
    uid: user.firebaseUid,
    phoneNumber: user.phone,
  });
}

const bearer = 'Bearer fake';
const BLR = { lat: 12.9716, lng: 77.5946 };
const validBody = {
  wasteTypes: ['iron', 'plastic'],
  photoUrls: ['https://res.cloudinary.com/demo/a.jpg'],
  pickupAddress: 'MG Road, Bengaluru',
  pickupLat: BLR.lat,
  pickupLng: BLR.lng,
};

// ─── Matching algorithm tests ─────────────────────────────────────────

describe('broadcastPickup', () => {
  beforeEach(() => {
    userDb.clear();
    dealerDb.clear();
    pickupDb.clear();
    redisStore.clear();
    uuidCounter = 0;
    notifyMock.mockClear();
    vi.clearAllMocks();
  });

  it('notifies only verified + online dealers whose waste types overlap', async () => {
    seedDealer({ verified: true, online: true, wasteTypes: ['iron'] }); // match
    seedDealer({ verified: true, online: true, wasteTypes: ['glass'] }); // no overlap
    seedDealer({ verified: false, online: true, wasteTypes: ['iron'] }); // not verified
    seedDealer({ verified: true, online: false, wasteTypes: ['iron'] }); // not online (won't be in GEO)

    // Redis GEO would return only the online dealers; simulate that.
    const onlineIds = [...dealerDb.entries()]
      .filter(([, d]) => d.isOnline)
      .map(([id]) => id);
    asMock(findNearbyDealers).mockResolvedValue(
      onlineIds.map((id, i) => ({ dealerId: id, distanceKm: 0.5 + i * 0.1, lng: 0, lat: 0 })),
    );

    const pickup = {
      id: 'pk_test',
      wasteTypes: ['iron', 'plastic'],
      pickupLat: BLR.lat,
      pickupLng: BLR.lng,
      pickupAddress: 'X',
      photoUrls: ['https://x/y.jpg'],
    } as any;

    const notified = await broadcastPickup(pickup, 3);

    expect(notified).toBe(1); // only the verified+online iron dealer
    expect(notifyMock).toHaveBeenCalledTimes(1);
    const payload = notifyMock.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0].socketEvent).toBe('pickup:new-request');
    expect(payload[0].data.pickupId).toBe('pk_test');
  });

  it('returns 0 and notifies no one when radius has no dealers', async () => {
    asMock(findNearbyDealers).mockResolvedValue([]);
    const pickup = { id: 'pk_x', wasteTypes: ['iron'], pickupLat: BLR.lat, pickupLng: BLR.lng, pickupAddress: 'x', photoUrls: [] } as any;
    const n = await broadcastPickup(pickup, 3);
    expect(n).toBe(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('treats empty acceptedWasteTypes as "accepts all"', async () => {
    seedDealer({ wasteTypes: [] });
    const ids = [...dealerDb.keys()];
    asMock(findNearbyDealers).mockResolvedValue(
      ids.map((id) => ({ dealerId: id, distanceKm: 0.5, lng: 0, lat: 0 })),
    );
    const pickup = { id: 'pk_all', wasteTypes: ['glass'], pickupLat: BLR.lat, pickupLng: BLR.lng, pickupAddress: 'x', photoUrls: [] } as any;
    expect(await broadcastPickup(pickup, 3)).toBe(1);
  });
});

// ─── Accept + race condition ──────────────────────────────────────────

describe('POST /api/v1/pickups/:id/accept — race safety', () => {
  beforeEach(() => {
    userDb.clear();
    dealerDb.clear();
    pickupDb.clear();
    redisStore.clear();
    uuidCounter = 0;
    notifyMock.mockClear();
    vi.clearAllMocks();
  });

  it('exactly one of ten parallel accepts wins; the other nine get 409', async () => {
    const household = seedHousehold();
    login(household);
    const app = buildApp();

    // Prevent broadcast side-effect from causing failures
    asMock(findNearbyDealers).mockResolvedValue([]);

    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validBody);
    expect(created.status).toBe(201);
    const pickupId: string = created.body.pickup.id;

    // Now try 10 dealers accepting in parallel.
    const dealers = Array.from({ length: 10 }, () => seedDealer({ verified: true, online: true }));

    const responses = await Promise.all(
      dealers.map((d) => {
        return new Promise<{ status: number; body: any }>((resolve) => {
          // Each request needs its own auth mock resolution. We mockImplementation
          // to pick the right dealer based on some request-scoped signal.
          // Simplest: pre-set the auth mock for THIS iteration and race quickly.
          asMock(verifyFirebaseIdToken).mockResolvedValueOnce({
            uid: d.firebaseUid,
            phoneNumber: d.phone,
          });
          request(app)
            .post(`/api/v1/pickups/${pickupId}/accept`)
            .set('Authorization', bearer)
            .then((res) => resolve({ status: res.status, body: res.body }));
        });
      }),
    );

    const successes = responses.filter((r) => r.status === 200);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(successes.length + conflicts.length).toBe(10);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(9);

    // The DB should reflect the winner.
    const finalRow = pickupDb.get(pickupId);
    expect(finalRow.status).toBe('ACCEPTED');
    expect(finalRow.acceptedDealerId).toBe(successes[0].body.pickup.acceptedDealerId);
  });

  it('accept fails if pickup is already CANCELLED', async () => {
    const household = seedHousehold();
    login(household);
    const app = buildApp();
    asMock(findNearbyDealers).mockResolvedValue([]);

    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validBody);
    const pickupId: string = created.body.pickup.id;

    // Household cancels
    await request(app).post(`/api/v1/pickups/${pickupId}/cancel`).set('Authorization', bearer);

    // Dealer tries to accept
    const dealer = seedDealer({ verified: true, online: true });
    login(dealer);
    const res = await request(app)
      .post(`/api/v1/pickups/${pickupId}/accept`)
      .set('Authorization', bearer);
    expect(res.status).toBe(409);
    // Redis lock should have been released so nothing is left stuck.
    expect(redisStore.has(`pickup:${pickupId}:lock`)).toBe(false);
  });

  it('unverified dealer cannot accept', async () => {
    const household = seedHousehold();
    login(household);
    const app = buildApp();
    asMock(findNearbyDealers).mockResolvedValue([]);

    const created = await request(app)
      .post('/api/v1/pickups')
      .set('Authorization', bearer)
      .send(validBody);
    const pickupId: string = created.body.pickup.id;

    const dealer = seedDealer({ verified: false, online: true });
    login(dealer);
    const res = await request(app)
      .post(`/api/v1/pickups/${pickupId}/accept`)
      .set('Authorization', bearer);
    expect(res.status).toBe(403);
    expect(redisStore.has(`pickup:${pickupId}:lock`)).toBe(false);
  });
});
