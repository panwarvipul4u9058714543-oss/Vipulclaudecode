import { prisma } from '../../config/prisma';
import { errors } from '../../lib/errors';
import { isPlausibleIndiaCoord } from '../../lib/geo';
import {
  removeDealerLocation,
  upsertDealerLocation,
} from '../../lib/dealerGeo';

/**
 * Flip a dealer to online. Requires that the dealer is verified (admin has
 * approved their Aadhaar); otherwise they cannot receive requests.
 * Writes to both Postgres (source of truth) and Redis GEO (fast lookup).
 */
export async function goOnline(userId: string, lat: number, lng: number) {
  if (!isPlausibleIndiaCoord(lat, lng)) {
    throw errors.badRequest('Location is outside supported region');
  }

  const dealer = await prisma.dealerProfile.findUnique({ where: { userId } });
  if (!dealer) throw errors.notFound('Dealer profile');
  if (!dealer.isVerified) {
    throw errors.forbidden('Dealer is not verified yet — admin must approve first');
  }

  const updated = await prisma.dealerProfile.update({
    where: { userId },
    data: {
      isOnline: true,
      currentLat: lat,
      currentLng: lng,
      lastLocationUpdate: new Date(),
    },
  });

  await upsertDealerLocation(userId, lng, lat);
  return updated;
}

/**
 * Flip a dealer to offline. Idempotent — a dealer already offline gets a
 * no-op. Removes them from the Redis live index so no new requests are
 * routed to them.
 */
export async function goOffline(userId: string) {
  const dealer = await prisma.dealerProfile.findUnique({ where: { userId } });
  if (!dealer) throw errors.notFound('Dealer profile');

  const updated = await prisma.dealerProfile.update({
    where: { userId },
    data: { isOnline: false },
  });

  await removeDealerLocation(userId);
  return updated;
}

/**
 * Heartbeat: dealer's app calls this every ~10 seconds while online to keep
 * their position current. Rejects updates from a dealer who is not marked
 * online (so a phone with a stale token can't spoof presence).
 */
export async function updateLocation(userId: string, lat: number, lng: number) {
  if (!isPlausibleIndiaCoord(lat, lng)) {
    throw errors.badRequest('Location is outside supported region');
  }

  const dealer = await prisma.dealerProfile.findUnique({ where: { userId } });
  if (!dealer) throw errors.notFound('Dealer profile');
  if (!dealer.isOnline) {
    throw errors.conflict('Dealer is offline — call /dealer/online first');
  }

  const updated = await prisma.dealerProfile.update({
    where: { userId },
    data: {
      currentLat: lat,
      currentLng: lng,
      lastLocationUpdate: new Date(),
    },
  });

  await upsertDealerLocation(userId, lng, lat);
  return updated;
}
