import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { pingRedis } from '../../config/redis';

export const healthRouter = Router();

/**
 * Liveness + readiness probe. Returns 200 only if both Postgres and Redis
 * are reachable. Railway (and any orchestrator) uses this to decide whether
 * to route traffic to this instance.
 */
healthRouter.get('/', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    prisma
      .$queryRaw`SELECT 1`.then(() => true)
      .catch(() => false),
    pingRedis(),
  ]);

  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({
    ok,
    db: dbOk,
    redis: redisOk,
    uptime: process.uptime(),
    ts: new Date().toISOString(),
  });
});
