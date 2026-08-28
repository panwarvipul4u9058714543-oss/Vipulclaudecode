import { redis } from '../config/redis';

/**
 * All online dealers live in a single Redis GEO set. This is the "who's live
 * right now" index that lets the matching algorithm answer "give me every
 * verified dealer within X km of this pickup" in ~1 ms, no matter how many
 * dealers are online.
 *
 * Postgres remains the source of truth (rating, accepted waste types,
 * isVerified). Redis just accelerates the radius lookup.
 */
export const DEALERS_LIVE_KEY = 'dealers:live';

export interface NearbyDealer {
  dealerId: string;
  distanceKm: number;
  lng: number;
  lat: number;
}

/**
 * Register or update a dealer's position in the live index.
 * `dealerId` is the User.id (uuid) of the DEALER-role user.
 */
export async function upsertDealerLocation(
  dealerId: string,
  lng: number,
  lat: number,
): Promise<void> {
  // ioredis GEOADD signature: GEOADD key longitude latitude member ...
  await redis.geoadd(DEALERS_LIVE_KEY, lng, lat, dealerId);
}

/**
 * Remove a dealer from the live index. Called when a dealer flips offline
 * or when their location TTL expires (see refreshDealerHeartbeat below).
 */
export async function removeDealerLocation(dealerId: string): Promise<void> {
  await redis.zrem(DEALERS_LIVE_KEY, dealerId);
}

/**
 * Return dealers within `radiusKm` of the pickup point, sorted by distance,
 * closest first. Capped at `limit` results.
 */
export async function findNearbyDealers(
  pickupLng: number,
  pickupLat: number,
  radiusKm: number,
  limit = 50,
): Promise<NearbyDealer[]> {
  // GEOSEARCH is the modern replacement for GEORADIUS. ioredis's typings for
  // it are loose, so we call it via `sendCommand` for full argument control
  // and parse the raw response ourselves.
  const raw = (await redis.call(
    'GEOSEARCH',
    DEALERS_LIVE_KEY,
    'FROMLONLAT',
    String(pickupLng),
    String(pickupLat),
    'BYRADIUS',
    String(radiusKm),
    'km',
    'ASC',
    'COUNT',
    String(limit),
    'WITHCOORD',
    'WITHDIST',
  )) as Array<[string, string, [string, string]]>;

  if (!Array.isArray(raw)) return [];

  return raw.map((entry) => {
    const [dealerId, distStr, [lngStr, latStr]] = entry;
    return {
      dealerId,
      distanceKm: parseFloat(distStr),
      lng: parseFloat(lngStr),
      lat: parseFloat(latStr),
    };
  });
}

/**
 * Number of currently online dealers. Useful for admin dashboards.
 */
export async function countOnlineDealers(): Promise<number> {
  return redis.zcard(DEALERS_LIVE_KEY);
}
