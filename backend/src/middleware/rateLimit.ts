import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';
import { env } from '../config/env';

/**
 * Build a Redis-backed rate limiter. Lazy so the store isn't touched during
 * module import (which would blow up in test where redis is mocked without
 * a `.call` method). In NODE_ENV=test we return a pass-through middleware.
 */
function makeLimiter(opts: {
  prefix: string;
  windowMs: number;
  limit: number;
  message: string;
}): RequestHandler {
  if (env.NODE_ENV === 'test') {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new RedisStore({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: ((...args: string[]) => (redis as any).call(...args)) as any,
      prefix: opts.prefix,
    }),
    message: { error: { code: 'RATE_LIMITED', message: opts.message } },
  });
}

/**
 * Global default rate limit for the public API. Shared across every
 * instance behind a load balancer via Redis.
 */
export const globalRateLimit: RequestHandler = (req, res, next) =>
  (globalRateLimit.__inner ??= makeLimiter({
    prefix: 'rl:global:',
    windowMs: 60_000,
    limit: 120,
    message: 'Too many requests',
  }))(req, res, next);
(globalRateLimit as unknown as { __inner?: RequestHandler }).__inner = undefined;

/**
 * Stricter limit for auth verification — protects against OTP-flood.
 */
export const authRateLimit: RequestHandler = (req, res, next) =>
  (authRateLimit.__inner ??= makeLimiter({
    prefix: 'rl:auth:',
    windowMs: 60_000,
    limit: 10,
    message: 'Too many auth requests',
  }))(req, res, next);
(authRateLimit as unknown as { __inner?: RequestHandler }).__inner = undefined;

/**
 * Heartbeat is called every ~10s while online — 30/min headroom.
 */
export const dealerLocationRateLimit: RequestHandler = (req, res, next) =>
  (dealerLocationRateLimit.__inner ??= makeLimiter({
    prefix: 'rl:loc:',
    windowMs: 60_000,
    limit: 30,
    message: 'Too many location updates',
  }))(req, res, next);
(dealerLocationRateLimit as unknown as { __inner?: RequestHandler }).__inner = undefined;

// TypeScript augmentation for the lazy cache attached to each middleware.
declare module 'express' {
  interface RequestHandler {
    __inner?: RequestHandler;
  }
}
