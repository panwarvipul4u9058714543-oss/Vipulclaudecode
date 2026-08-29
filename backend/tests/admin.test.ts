import { describe, it, expect, vi, beforeEach } from 'vitest';

const userDb = new Map<string, any>();
const dealerDb = new Map<string, any>();
const pickupDb = new Map<string, any>();
const txDb = new Map<string, any>();

let uuidCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++uuidCounter}`;

vi.mock('../src/lib/auth', () => ({ verifyFirebaseIdToken: vi.fn() }));

vi.mock('../src/lib/dealerGeo', () => ({
  DEALERS_LIVE_KEY: 'dealers:live',
  findNearbyDealers: vi.fn().mockResolvedValue([]),
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
      findMany: vi.fn(async ({ where, take, orderBy, cursor, skip }: any) => {
        let rows = [...userDb.values()].filter((u) => {
          if (where.role && u.role !== where.role) return false;
          if (where.isBlocked !== undefined && u.isBlocked !== where.isBlocked) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
        }
        if (cursor) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          rows = idx >= 0 ? rows.slice(idx + (skip ?? 0)) : [];
        }
        return rows.slice(0, take);
      }),
      count: vi.fn(async ({ where }: any = {}) => {
        return [...userDb.values()].filter((u) => (where?.role ? u.role === where.role : true))
          .length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = userDb.get(where.id);
        Object.assign(u, data);
        return u;
      }),
    },
    dealerProfile: {
      findUnique: vi.fn(async ({ where }: any) => dealerDb.get(where.userId) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const row = dealerDb.get(where.userId);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
      count: vi.fn(async ({ where }: any = {}) => {
        return [...dealerDb.values()].filter((d) =>
          where?.isVerified !== undefined ? d.isVerified === where.isVerified : true,
        ).length;
      }),
    },
    pickupRequest: {
      findMany: vi.fn(async ({ where, take, orderBy, cursor, skip }: any) => {
        let rows = [...pickupDb.values()].filter((p) => {
          if (where?.status && p.status !== where.status) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
        }
        if (cursor) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          rows = idx >= 0 ? rows.slice(idx + (skip ?? 0)) : [];
        }
        return rows.slice(0, take);
      }),
      groupBy: vi.fn(async () => {
        const counts = new Map<string, number>();
        for (const p of pickupDb.values()) {
          counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
        }
        return [...counts.entries()].map(([status, n]) => ({
          status,
          _count: { _all: n },
        }));
      }),
    },
    pickupTransaction: {
      aggregate: vi.fn(async () => {
        let sumRs = 0;
        let sumKg = 0;
        for (const t of txDb.values()) {
          sumRs += t.finalAmountRupees;
          sumKg += t.finalWeightKg;
        }
        return {
          _sum: { finalAmountRupees: sumRs, finalWeightKg: sumKg },
          _count: { _all: txDb.size },
        };
      }),
    },
  },
}));

vi.mock('../src/config/redis', () => ({
  redis: {
    on: vi.fn(),
    quit: vi.fn(),
    zcard: vi.fn().mockResolvedValue(3),
  },
  pingRedis: vi.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import { buildApp } from '../src/app';
import { verifyFirebaseIdToken } from '../src/lib/auth';

const asMock = <T>(v: T) => v as unknown as ReturnType<typeof vi.fn>;

function seedUser(overrides: Partial<any> = {}) {
  const id = overrides.id ?? nextId('u');
  const u = {
    id,
    firebaseUid: `fb_${id}`,
    phone: overrides.phone ?? `+919000${String(uuidCounter).padStart(6, '0')}`,
    role: overrides.role ?? 'HOUSEHOLD',
    name: overrides.name ?? 'x',
    isBlocked: overrides.isBlocked ?? false,
    createdAt: new Date(),
  };
  userDb.set(id, u);
  return u;
}

function seedDealer(overrides: { verified?: boolean; online?: boolean } = {}) {
  const u = seedUser({ role: 'DEALER' });
  dealerDb.set(u.id, {
    userId: u.id,
    isVerified: overrides.verified ?? true,
    isOnline: overrides.online ?? false,
    acceptedWasteTypes: [],
    vehicleType: 'CYCLE_CART',
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

describe('admin API', () => {
  beforeEach(() => {
    userDb.clear();
    dealerDb.clear();
    pickupDb.clear();
    txDb.clear();
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  it('rejects non-ADMIN users', async () => {
    const h = seedUser({ role: 'HOUSEHOLD' });
    login(h);
    const res = await request(buildApp()).get('/api/v1/admin/users').set('Authorization', bearer);
    expect(res.status).toBe(403);
  });

  it('ADMIN can list users with role filter', async () => {
    const admin = seedUser({ role: 'ADMIN' });
    seedUser({ role: 'HOUSEHOLD' });
    seedUser({ role: 'HOUSEHOLD' });
    seedUser({ role: 'DEALER' });
    login(admin);

    const res = await request(buildApp())
      .get('/api/v1/admin/users?role=HOUSEHOLD')
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    for (const u of res.body.items) expect(u.role).toBe('HOUSEHOLD');
  });

  it('ADMIN can block a user', async () => {
    const admin = seedUser({ role: 'ADMIN' });
    const target = seedUser({ role: 'HOUSEHOLD' });
    login(admin);

    const res = await request(buildApp())
      .patch(`/api/v1/admin/users/${target.id}/block`)
      .set('Authorization', bearer)
      .send({ blocked: true });
    expect(res.status).toBe(200);
    expect(res.body.user.isBlocked).toBe(true);
    expect(userDb.get(target.id).isBlocked).toBe(true);
  });

  it('ADMIN can verify a dealer', async () => {
    const admin = seedUser({ role: 'ADMIN' });
    const dealer = seedDealer({ verified: false });
    login(admin);

    const res = await request(buildApp())
      .patch(`/api/v1/admin/dealers/${dealer.id}/verify`)
      .set('Authorization', bearer)
      .send({ verified: true });
    expect(res.status).toBe(200);
    expect(res.body.dealer.isVerified).toBe(true);
    expect(dealerDb.get(dealer.id).isVerified).toBe(true);
  });

  it('un-verifying a dealer also forces them offline', async () => {
    const admin = seedUser({ role: 'ADMIN' });
    const dealer = seedDealer({ verified: true, online: true });
    login(admin);

    const res = await request(buildApp())
      .patch(`/api/v1/admin/dealers/${dealer.id}/verify`)
      .set('Authorization', bearer)
      .send({ verified: false });
    expect(res.status).toBe(200);
    expect(res.body.dealer.isVerified).toBe(false);
    expect(res.body.dealer.isOnline).toBe(false);
  });

  it('analytics returns aggregate counts', async () => {
    const admin = seedUser({ role: 'ADMIN' });
    seedUser({ role: 'HOUSEHOLD' });
    seedUser({ role: 'HOUSEHOLD' });
    seedDealer({ verified: true });
    seedDealer({ verified: false });
    pickupDb.set('p1', { id: 'p1', status: 'COMPLETED', createdAt: new Date() });
    pickupDb.set('p2', { id: 'p2', status: 'OPEN', createdAt: new Date() });
    txDb.set('t1', { finalAmountRupees: 100, finalWeightKg: 3 });
    txDb.set('t2', { finalAmountRupees: 250, finalWeightKg: 5.5 });
    login(admin);

    const res = await request(buildApp())
      .get('/api/v1/admin/analytics')
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.users.households).toBe(2);
    expect(res.body.users.dealers).toBe(2);
    expect(res.body.users.verifiedDealers).toBe(1);
    expect(res.body.users.onlineDealers).toBe(3); // from redis mock
    expect(res.body.pickups.OPEN).toBe(1);
    expect(res.body.pickups.COMPLETED).toBe(1);
    expect(res.body.revenue.totalRupees).toBe(350);
    expect(res.body.revenue.totalKg).toBe(8.5);
    expect(res.body.revenue.totalPickupsCompleted).toBe(2);
  });
});
