import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { dealerLocationSchema, goOnlineSchema } from './dealer.schemas';
import { goOffline, goOnline, updateLocation } from './dealer.service';

export const dealerRouter = Router();
dealerRouter.use(authMiddleware, requireRole('DEALER'));

/**
 * POST /api/v1/dealer/online
 * Dealer taps "Start collecting" in the app. Body sends the current location
 * so the server can register them at a real position (not a stale one from
 * hours ago).
 */
dealerRouter.post('/online', async (req, res) => {
  const body = goOnlineSchema.parse(req.body);
  const dealer = await goOnline(req.user!.id, body.lat, body.lng);
  res.json({ dealer });
});

/**
 * POST /api/v1/dealer/offline
 * Dealer stops receiving requests. Removes them from the Redis live index.
 */
dealerRouter.post('/offline', async (req, res) => {
  const dealer = await goOffline(req.user!.id);
  res.json({ dealer });
});

/**
 * POST /api/v1/dealer/location
 * Heartbeat — called every ~10 seconds while online to keep the map fresh
 * and to give households a live view of the incoming dealer.
 */
dealerRouter.post('/location', async (req, res) => {
  const body = dealerLocationSchema.parse(req.body);
  const dealer = await updateLocation(req.user!.id, body.lat, body.lng);
  res.json({
    lat: dealer.currentLat,
    lng: dealer.currentLng,
    updatedAt: dealer.lastLocationUpdate,
  });
});
