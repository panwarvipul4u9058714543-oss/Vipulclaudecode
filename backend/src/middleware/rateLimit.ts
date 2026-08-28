import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

/**
 * Global default rate limit for the public API. Uses Redis so limits are
 * shared across every instance behind a load balancer.
 *
 * Tighter limits belong on hot endpoints — /auth/verify and /dealer/location
 * — configured next to those routes.
 */
export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120, // 120 req/min per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    // ioredis's `call` signature matches what rate-limit-redis expects.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: ((...args: string[]) => (redis as any).call(...args)) as any,
    prefix: 'rl:global:',
  }),
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

/**
 * Stricter limit for auth verification — protects against OTP-flood + brute
 * force. 10 per minute per IP is plenty for a real user.
 */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: ((...args: string[]) => (redis as any).call(...args)) as any,
    prefix: 'rl:auth:',
  }),
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth requests' } },
});

/**
 * The dealer heartbeat is called every ~10 seconds — 30/min headroom for
 * app reconnect bursts.
 */
export const dealerLocationRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: ((...args: string[]) => (redis as any).call(...args)) as any,
    prefix: 'rl:loc:',
  }),
});
