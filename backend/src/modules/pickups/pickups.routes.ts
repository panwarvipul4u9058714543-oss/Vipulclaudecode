import { Router } from 'express';
import { PickupStatus } from '@prisma/client';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { logger } from '../../config/logger';
import {
  cancelPickupSchema,
  createPickupSchema,
  listPickupsQuery,
} from './pickups.schemas';
import {
  cancelPickupByHousehold,
  createPickup,
  getPickupForUser,
  listMyPickups,
} from './pickups.service';
import { broadcastPickup } from './matching';
import { acceptPickup } from './accept';
import { listAvailablePickupsForDealer } from './dealerPickups.service';
import { completePickupSchema, reviewSchema } from './lifecycle.schemas';
import { completePickup, leaveReview, startPickup } from './lifecycle.service';

export const pickupsRouter = Router();
pickupsRouter.use(authMiddleware);

/**
 * POST /api/v1/pickups
 * Household creates a pickup request. In Phase 5 this will also fan out
 * notifications to nearby dealers — for now it just persists the row.
 */
pickupsRouter.post('/', requireRole('HOUSEHOLD'), async (req, res) => {
  const body = createPickupSchema.parse(req.body);
  const pickup = await createPickup(req.user!.id, body);

  // Fire the broadcast in the background — household shouldn't wait on it.
  void broadcastPickup(pickup).catch((err) =>
    logger.error({ err, pickupId: pickup.id }, 'initial broadcast failed'),
  );

  res.status(201).json({ pickup });
});

/**
 * GET /api/v1/pickups/available
 * DEALER-only. Fallback list if the dealer missed the push notification —
 * shows OPEN pickups near the dealer's current location. In practice most
 * dealers act on the push; this is the "did I miss one?" screen.
 */
pickupsRouter.get('/available', requireRole('DEALER'), async (req, res) => {
  const items = await listAvailablePickupsForDealer(req.user!.id);
  res.json({ items });
});

/**
 * POST /api/v1/pickups/:id/accept
 * DEALER-only. Race-safe accept using a Redis SET NX lock.
 */
pickupsRouter.post('/:id/accept', requireRole('DEALER'), async (req, res) => {
  const updated = await acceptPickup(req.user!.id, req.params.id);
  res.json({ pickup: updated });
});

/**
 * GET /api/v1/pickups/mine?status=OPEN&limit=20&cursor=...
 * Household lists their own pickups, most-recent first.
 */
pickupsRouter.get('/mine', requireRole('HOUSEHOLD'), async (req, res) => {
  const query = listPickupsQuery.parse(req.query);
  const result = await listMyPickups(req.user!.id, {
    status: query.status as PickupStatus | undefined,
    limit: query.limit,
    cursor: query.cursor,
  });
  res.json(result);
});

/**
 * GET /api/v1/pickups/:id
 * Full details for one pickup. Owner-guarded — households can see their own,
 * dealers can see ones they've accepted.
 */
pickupsRouter.get('/:id', async (req, res) => {
  const user = req.user!;
  if (user.role !== 'HOUSEHOLD' && user.role !== 'DEALER') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Role required' } });
    return;
  }
  const pickup = await getPickupForUser(req.params.id, user.id, user.role);
  res.json({ pickup });
});

/**
 * POST /api/v1/pickups/:id/cancel
 * Household cancels their pickup while it's still OPEN or ACCEPTED.
 */
pickupsRouter.post('/:id/cancel', requireRole('HOUSEHOLD'), async (req, res) => {
  const body = cancelPickupSchema.parse(req.body ?? {});
  const updated = await cancelPickupByHousehold(req.params.id, req.user!.id, body.reason);
  res.json({ pickup: updated });
});
