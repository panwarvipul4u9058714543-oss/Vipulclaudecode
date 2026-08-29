/**
 * Great-circle distance (Haversine formula) in kilometres between two
 * lat/lng points. Cheap; used for small in-memory sorts and for the
 * "distance" field returned to the app. For radius filtering across the
 * whole dealer pool we use Redis GEOSEARCH, not this.
 */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Rough sanity check that a lat/lng pair is inside India's bounding box.
 * Used to reject nonsense coordinates from a spoofed client. Kept loose so
 * we don't reject legitimate border areas.
 */
export function isPlausibleIndiaCoord(lat: number, lng: number): boolean {
  return lat >= 6.5 && lat <= 37.5 && lng >= 68 && lng <= 97.5;
}
