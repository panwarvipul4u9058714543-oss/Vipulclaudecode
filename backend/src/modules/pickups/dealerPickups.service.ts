import { PickupStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { errors } from '../../lib/errors';
import { haversineKm } from '../../lib/geo';

/**
 * OPEN pickups near the dealer's current location whose waste types overlap
 * with what the dealer accepts. Used by the dealer's "Available" screen —
 * a fallback in case the push notification was missed.
 */
export async function listAvailablePickupsForDealer(dealerUserId: string) {
  const dealer = await prisma.dealerProfile.findUnique({ where: { userId: dealerUserId } });
  if (!dealer) throw errors.notFound('Dealer profile');
  if (dealer.currentLat === null || dealer.currentLng === null) {
    throw errors.badRequest('No dealer location yet — call /dealer/online first');
  }

  const dealerLat = dealer.currentLat;
  const dealerLng = dealer.currentLng;
  const acceptsAll = dealer.acceptedWasteTypes.length === 0;

  // Bounding-box prefilter in SQL: 1 degree ~ 111 km, so radius/111 gives a
  // rough lat/lng window. Then we filter precisely with haversine in JS.
  const degWindow = env.MATCH_MAX_RADIUS_KM / 111;

  const openNearby = await prisma.pickupRequest.findMany({
    where: {
      status: PickupStatus.OPEN,
      pickupLat: { gte: dealerLat - degWindow, lte: dealerLat + degWindow },
      pickupLng: { gte: dealerLng - degWindow, lte: dealerLng + degWindow },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return openNearby
    .map((p) => ({
      ...p,
      distanceKm: haversineKm(dealerLat, dealerLng, p.pickupLat, p.pickupLng),
    }))
    .filter((p) => p.distanceKm <= env.MATCH_MAX_RADIUS_KM)
    .filter((p) => acceptsAll || p.wasteTypes.some((t) => dealer.acceptedWasteTypes.includes(t)))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
