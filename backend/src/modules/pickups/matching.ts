import type { PickupRequest } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { findNearbyDealers } from '../../lib/dealerGeo';
import { notifyMany } from '../../lib/notify';

/**
 * Match a fresh pickup to nearby dealers and notify them.
 *
 * Steps:
 *  1. Redis GEOSEARCH — nearby ONLINE dealer IDs within `radiusKm`.
 *  2. Postgres filter — verified, not blocked, waste types overlap.
 *  3. Fan-out FCM push + Socket.IO to every candidate.
 *
 * Returns the number of candidates that were actually notified. A caller
 * can use this to decide whether to re-broadcast at a wider radius.
 */
export async function broadcastPickup(
  pickup: PickupRequest,
  radiusKm = env.MATCH_INITIAL_RADIUS_KM,
): Promise<number> {
  const nearby = await findNearbyDealers(
    pickup.pickupLng,
    pickup.pickupLat,
    radiusKm,
    50,
  );
  if (nearby.length === 0) {
    logger.info({ pickupId: pickup.id, radiusKm }, 'no dealers in radius');
    return 0;
  }

  const dealerIds = nearby.map((d) => d.dealerId);
  const dealers = await prisma.dealerProfile.findMany({
    where: {
      userId: { in: dealerIds },
      isVerified: true,
      isOnline: true,
    },
    include: {
      user: { select: { id: true, fcmToken: true, isBlocked: true } },
    },
  });

  const distanceById = new Map(nearby.map((n) => [n.dealerId, n.distanceKm]));

  const candidates = dealers.filter((d) => {
    if (d.user.isBlocked) return false;
    const overlaps = d.acceptedWasteTypes.some((t) => pickup.wasteTypes.includes(t));
    return overlaps || d.acceptedWasteTypes.length === 0; // empty = accepts all
  });

  if (candidates.length === 0) {
    logger.info({ pickupId: pickup.id, radiusKm }, 'no matching dealers after filter');
    return 0;
  }

  const preview = pickup.photoUrls[0] ?? '';
  await notifyMany(
    candidates.map((d) => ({
      userId: d.user.id,
      fcmToken: d.user.fcmToken,
      socketEvent: 'pickup:new-request',
      notification: {
        title: 'New pickup nearby',
        body: `${pickup.wasteTypes.join(', ')} — ${(distanceById.get(d.user.id) ?? 0).toFixed(
          1,
        )} km away`,
      },
      data: {
        pickupId: pickup.id,
        wasteTypes: pickup.wasteTypes.join(','),
        pickupAddress: pickup.pickupAddress,
        pickupLat: String(pickup.pickupLat),
        pickupLng: String(pickup.pickupLng),
        distanceKm: String(distanceById.get(d.user.id) ?? ''),
        photoUrl: preview,
      },
    })),
  );

  logger.info(
    { pickupId: pickup.id, radiusKm, notified: candidates.length },
    'pickup broadcast',
  );
  return candidates.length;
}
