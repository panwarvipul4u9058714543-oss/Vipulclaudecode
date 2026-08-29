-- Run once after `prisma migrate deploy` (or via `psql < postgis-index.sql`).
-- Adds a generated `pickup_location` geography column and a GIST spatial
-- index for fast radius queries against pickup_requests.
--
-- Prisma doesn't yet model generated geography columns natively — this file
-- is the one PostGIS-specific piece we own by hand.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE pickup_requests
  ADD COLUMN IF NOT EXISTS pickup_location geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint("pickupLng", "pickupLat"), 4326)::geography
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_pickup_requests_location
  ON pickup_requests USING GIST (pickup_location);
