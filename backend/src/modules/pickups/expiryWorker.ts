import { PickupStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { broadcastPickup } from './matching';

/**
 * Background worker that:
 *   1. Expires OPEN pickups past their expiresAt.
 *   2. Re-broadcasts OPEN pickups that no dealer accepted within
 *      MATCH_EXPAND_AFTER_SECONDS, at a bigger radius (capped at
 *      MATCH_MAX_RADIUS_KM).
 *
 * Kept intentionally simple — a `setInterval` in-process. On Railway we run
 * a single process for now, so no coordination needed. When we scale to
 * multiple instances the worker moves to BullMQ (Redis-backed job queue) so
 * only one worker fires per tick.
 */

let handle: NodeJS.Timeout | null = null;
const TICK_MS = 15_000;

export function startExpiryWorker(): void {
  if (handle) return;
  handle = setInterval(() => {
    void tick().catch((err) => logger.error({ err }, 'expiry worker tick failed'));
  }, TICK_MS);
  logger.info({ tickMs: TICK_MS }, 'expiry worker started');
}

export function stopExpiryWorker(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
}

// Exposed for tests.
export async function tick(now: Date = new Date()): Promise<void> {
  // 1. Expire timed-out OPEN pickups
  await prisma.pickupRequest.updateMany({
    where: {
      status: PickupStatus.OPEN,
      expiresAt: { lte: now },
    },
    data: { status: PickupStatus.EXPIRED },
  });

  // 2. Re-broadcast pickups that are still OPEN and older than the expand threshold
  const staleThreshold = new Date(now.getTime() - env.MATCH_EXPAND_AFTER_SECONDS * 1_000);
  const stale = await prisma.pickupRequest.findMany({
    where: {
      status: PickupStatus.OPEN,
      createdAt: { lte: staleThreshold },
      expiresAt: { gt: now },
    },
    take: 50,
  });

  for (const pickup of stale) {
    // Widen radius progressively: initial + 2km per elapsed expand-window,
    // capped at MATCH_MAX_RADIUS_KM.
    const ageSec = (now.getTime() - pickup.createdAt.getTime()) / 1_000;
    const windows = Math.floor(ageSec / env.MATCH_EXPAND_AFTER_SECONDS);
    const radiusKm = Math.min(
      env.MATCH_INITIAL_RADIUS_KM + windows * 2,
      env.MATCH_MAX_RADIUS_KM,
    );
    await broadcastPickup(pickup, radiusKm);
  }
}
