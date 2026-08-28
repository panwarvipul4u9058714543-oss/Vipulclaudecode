import { describe, expect, it, vi, beforeEach } from 'vitest';

// The health module reads prisma + redis. We stub both at module-level so this
// test runs without a live database — it's a pure route/shape test.
vi.mock('../src/config/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../src/config/redis', () => ({
  redis: { on: vi.fn(), quit: vi.fn() },
  pingRedis: vi.fn().mockResolvedValue(true),
}));

// Import after mocks so the app picks up the stubs.
import request from 'supertest';
import { buildApp } from '../src/app';
import { pingRedis } from '../src/config/redis';
import { prisma } from '../src/config/prisma';

describe('GET /healthz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pingRedis).mockResolvedValue(true);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
  });

  it('returns 200 when db and redis are healthy', async () => {
    const app = buildApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, db: true, redis: true });
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.ts).toBe('string');
  });

  it('returns 503 when redis is down', async () => {
    vi.mocked(pingRedis).mockResolvedValue(false);
    const app = buildApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ ok: false, db: true, redis: false });
  });

  it('returns 503 when db is down', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('db down'));
    const app = buildApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ ok: false, db: false, redis: true });
  });
});
