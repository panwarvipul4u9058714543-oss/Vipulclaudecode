import { Router } from 'express';
import type { PickupStatus, UserRole } from '@prisma/client';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  blockBody,
  listPickupsQuery,
  listUsersQuery,
  verifyBody,
} from './admin.schemas';
import {
  analytics,
  listAllPickups,
  listUsers,
  setBlocked,
  setDealerVerified,
} from './admin.service';

export const adminRouter = Router();
adminRouter.use(authMiddleware, requireRole('ADMIN'));

adminRouter.get('/users', async (req, res) => {
  const q = listUsersQuery.parse(req.query);
  const result = await listUsers({
    role: q.role as UserRole | undefined,
    blocked: q.blocked,
    limit: q.limit,
    cursor: q.cursor,
  });
  res.json(result);
});

adminRouter.patch('/users/:id/block', async (req, res) => {
  const body = blockBody.parse(req.body);
  const updated = await setBlocked(req.params.id, body.blocked);
  res.json({ user: updated });
});

adminRouter.patch('/dealers/:id/verify', async (req, res) => {
  const body = verifyBody.parse(req.body);
  const updated = await setDealerVerified(req.params.id, body.verified);
  res.json({ dealer: updated });
});

adminRouter.get('/pickups', async (req, res) => {
  const q = listPickupsQuery.parse(req.query);
  const result = await listAllPickups({
    status: q.status as PickupStatus | undefined,
    limit: q.limit,
    cursor: q.cursor,
  });
  res.json(result);
});

adminRouter.get('/analytics', async (_req, res) => {
  const data = await analytics();
  res.json(data);
});
