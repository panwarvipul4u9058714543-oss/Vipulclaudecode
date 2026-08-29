import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── In-memory state ──────────────────────────────────────────────────

const userDb = new Map<string, any>();
const dealerDb = new Map<string, any>();

// Spy handles for the Redis GEO helpers.
const geoCalls = {
  upsert: vi.fn(),
  remove: vi.fn(),
};

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('../src/lib/auth', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

vi.mock('../src/lib/dealerGeo', () => ({
  DEALERS_LIVE_KEY: 'dealers:live',
  upsertDealerLocation: (...args: unknown[]) => geoCalls.upsert(...args),
  removeDealerLocation: (...args: unknown[]) => geoCalls.remove(...args),
  findNearbyDealers: vi.fn().mockResolvedValue([]),
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
      findUnique: vi.fn(async ({ where }: any) => dealerDb.get(where.userId) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const row = dealerDb.get(where.userId);
        if (!row) throw new Error('dealer profile not found');
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

let idCounter = 0;
function seedDealer(overrides: { verified?: boolean; online?: boolean } = {}) {
  const id = `d_${++idCounter}`;
  const user = {
    id,
    firebaseUid: `fb_${id}`,
    phone: `+919${String(idCounter).padStart(9, '0')}`,
    role: 'DEALER',
    name: `Dealer ${idCounter}`,
    isBlocked: false,
  };
  userDb.set(id, user);
  dealerDb.set(id, {
    userId: id,
    vehicleType: 'CYCLE_CART',
    acceptedWasteTypes: ['iron', 'plastic'],
    isVerified: overrides.verified ?? true,
    isOnline: overrides.online ?? false,
    currentLat: null,
    currentLng: null,
  });
  return user;
}

function login(user: { firebaseUid: string; phone: string }) {
  asMock(verifyFirebaseIdToken).mockResolvedValue({
    uid: user.firebaseUid,
    phoneNumber: user.phone,
  });
}

const bearer = 'Bearer fake-token';
const BLR = { lat: 12.9716, lng: 77.5946 };

// ─── Tests ────────────────────────────────────────────────────────────

describe('POST /api/v1/dealer/online', () => {
  beforeEach(() => {
    userDb.clear();
    dealerDb.clear();
    idCounter = 0;
    geoCalls.upsert.mockClear();
    geoCalls.remove.mockClear();
    vi.clearAllMocks();
  });

  it('flips online and registers in Redis GEO', async () => {
    const d = seedDealer({ verified: true });
    login(d);

    const res = await request(buildApp())
      .post('/api/v1/dealer/online')
      .set('Authorization', bearer)
      .send({ lat: BLR.lat, lng: BLR.lng });

    expect(res.status).toBe(200);
    expect(res.body.dealer.isOnline).toBe(true);
    expect(geoCalls.upsert).toHaveBeenCalledWith(d.id, BLR.lng, BLR.lat);
  });

  it('rejects unverified dealers', async () => {
    const d = seedDealer({ verified: false });
    login(d);

    const res = await request(buildApp())
      .post('/api/v1/dealer/online')
      .set('Authorization', bearer)
      .send({ lat: BLR.lat, lng: BLR.lng });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/verified/i);
    expect(geoCalls.upsert).not.toHaveBeenCalled();
  });

  it('rejects when caller is a HOUSEHOLD', async () => {
    userDb.set('h1', {
      id: 'h1',
      firebaseUid: 'fb-h1',
      phone: '+919000000010',
      role: 'HOUSEHOLD',
      isBlocked: false,
    });
    login(userDb.get('h1'));

    const res = await request(buildApp())
      .post('/api/v1/dealer/online')
      .set('Authorization', bearer)
      .send({ lat: BLR.lat, lng: BLR.lng });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/dealer/offline', () => {
  beforeEach(() => {
    userDb.clear();
    dealerDb.clear();
    idCounter = 0;
    geoCalls.upsert.mockClear();
    geoCalls.remove.mockClear();
    vi.clearAllMocks();
  });

  it('flips offline and removes from Redis GEO', async () => {
    const d = seedDealer({ verified: true, online: true });
    login(d);

    const res = await request(buildApp())
      .post('/api/v1/dealer/offline')
      .set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.dealer.isOnline).toBe(false);
    expect(geoCalls.remove).toHaveBeenCalledWith(d.id);
  });
});

describe('POST /api/v1/dealer/location', () => {
  beforeEach(() => {
    userDb.clear();
    dealerDb.clear();
    idCounter = 0;
    geoCalls.upsert.mockClear();
    geoCalls.remove.mockClear();
    vi.clearAllMocks();
  });

  it('updates location while online', async () => {
    const d = seedDealer({ verified: true, online: true });
    login(d);

    const res = await request(buildApp())
      .post('/api/v1/dealer/location')
      .set('Authorization', bearer)
      .send({ lat: BLR.lat + 0.01, lng: BLR.lng + 0.01 });

    expect(res.status).toBe(200);
    expect(res.body.lat).toBeCloseTo(BLR.lat + 0.01, 4);
    expect(geoCalls.upsert).toHaveBeenCalled();
  });

  it('rejects location update if dealer is offline', async () => {
    const d = seedDealer({ verified: true, online: false });
    login(d);

    const res = await request(buildApp())
      .post('/api/v1/dealer/location')
      .set('Authorization', bearer)
      .send({ lat: BLR.lat, lng: BLR.lng });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/offline/i);
  });

  it('rejects malformed lat/lng', async () => {
    const d = seedDealer({ verified: true, online: true });
    login(d);

    const res = await request(buildApp())
      .post('/api/v1/dealer/location')
      .set('Authorization', bearer)
      .send({ lat: 200, lng: 200 });

    expect(res.status).toBe(400);
  });
});
