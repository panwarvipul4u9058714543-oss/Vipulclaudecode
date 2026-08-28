import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake Redis client that captures the last command sent.
const fakeRedis = {
  geoadd: vi.fn(),
  zrem: vi.fn(),
  zcard: vi.fn(),
  call: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
};

vi.mock('../src/config/redis', () => ({
  redis: fakeRedis,
  pingRedis: vi.fn().mockResolvedValue(true),
}));

import {
  upsertDealerLocation,
  removeDealerLocation,
  findNearbyDealers,
  countOnlineDealers,
  DEALERS_LIVE_KEY,
} from '../src/lib/dealerGeo';

describe('dealerGeo helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upsertDealerLocation calls GEOADD with lng, lat, dealerId (in that order)', async () => {
    await upsertDealerLocation('d_1', 77.5946, 12.9716);
    expect(fakeRedis.geoadd).toHaveBeenCalledWith(
      DEALERS_LIVE_KEY,
      77.5946,
      12.9716,
      'd_1',
    );
  });

  it('removeDealerLocation calls ZREM', async () => {
    await removeDealerLocation('d_2');
    expect(fakeRedis.zrem).toHaveBeenCalledWith(DEALERS_LIVE_KEY, 'd_2');
  });

  it('countOnlineDealers returns the ZCARD result', async () => {
    fakeRedis.zcard.mockResolvedValue(42);
    const n = await countOnlineDealers();
    expect(n).toBe(42);
    expect(fakeRedis.zcard).toHaveBeenCalledWith(DEALERS_LIVE_KEY);
  });

  it('findNearbyDealers issues GEOSEARCH with the right arguments', async () => {
    fakeRedis.call.mockResolvedValue([]);
    await findNearbyDealers(77.5946, 12.9716, 3, 25);
    expect(fakeRedis.call).toHaveBeenCalledWith(
      'GEOSEARCH',
      DEALERS_LIVE_KEY,
      'FROMLONLAT',
      '77.5946',
      '12.9716',
      'BYRADIUS',
      '3',
      'km',
      'ASC',
      'COUNT',
      '25',
      'WITHCOORD',
      'WITHDIST',
    );
  });

  it('findNearbyDealers parses the raw GEOSEARCH tuple into typed objects', async () => {
    fakeRedis.call.mockResolvedValue([
      ['dealer-1', '0.4321', ['77.6000', '12.9800']],
      ['dealer-2', '1.8765', ['77.5800', '12.9600']],
    ]);
    const rows = await findNearbyDealers(77.5946, 12.9716, 3);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      dealerId: 'dealer-1',
      distanceKm: 0.4321,
      lng: 77.6,
      lat: 12.98,
    });
    expect(rows[1].dealerId).toBe('dealer-2');
    expect(rows[1].distanceKm).toBeCloseTo(1.8765, 3);
  });

  it('findNearbyDealers returns [] when GEOSEARCH returns non-array', async () => {
    fakeRedis.call.mockResolvedValue(null);
    const rows = await findNearbyDealers(77, 12, 3);
    expect(rows).toEqual([]);
  });
});
