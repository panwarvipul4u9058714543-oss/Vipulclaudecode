import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { errors } from '../../lib/errors';
import { publicUser } from '../auth/auth.routes';
import {
  dealerProfileSchema,
  fcmTokenSchema,
  householdProfileSchema,
  patchMeSchema,
  selectRoleSchema,
} from './users.schemas';
import {
  completeDealerProfile,
  completeHouseholdProfile,
  getMe,
  patchMe,
  selectRole,
  updateFcmToken,
} from './users.service';

export const usersRouter = Router();

// All /users routes require a valid Firebase token AND an existing user row.
usersRouter.use(authMiddleware);

/**
 * POST /api/v1/users/select-role
 * First-launch role pick. Sets role, saves name, initializes the matching
 * profile row. Rejects an attempt to change roles after the fact.
 */
usersRouter.post('/select-role', async (req, res) => {
  const body = selectRoleSchema.parse(req.body);
  const updated = await selectRole(req.user!, body.role, body.name);
  res.json({ user: publicUser(updated) });
});

/**
 * POST /api/v1/users/complete-profile
 * Role-specific profile fields. Dispatches by role — HOUSEHOLD gets an
 * address+lat/lng, DEALER gets Aadhaar+vehicle+waste types.
 */
usersRouter.post('/complete-profile', async (req, res) => {
  const user = req.user!;
  if (!user.role) throw errors.badRequest('Select a role first via /users/select-role');

  if (user.role === 'HOUSEHOLD') {
    const body = householdProfileSchema.parse(req.body);
    const profile = await completeHouseholdProfile(user.id, body);
    res.json({ profile });
    return;
  }

  if (user.role === 'DEALER') {
    const body = dealerProfileSchema.parse(req.body);
    const profile = await completeDealerProfile(user.id, body);
    res.json({
      profile: {
        ...profile,
        aadhaarNumberHash: undefined, // never expose over the wire
      },
    });
    return;
  }

  throw errors.forbidden('Admins cannot complete a household/dealer profile');
});

/**
 * POST /api/v1/users/fcm-token
 * Called by the app on every launch (and on token refresh) so we can push to
 * this device. If the same token is already stored we skip the write.
 */
usersRouter.post('/fcm-token', async (req, res) => {
  const body = fcmTokenSchema.parse(req.body);
  await updateFcmToken(req.user!.id, body.fcmToken);
  res.json({ ok: true });
});

/**
 * PATCH /api/v1/users/me
 * Update name and/or profile photo URL (photo must already be uploaded to
 * Cloudinary; the client sends only the URL).
 */
usersRouter.patch('/me', async (req, res) => {
  const body = patchMeSchema.parse(req.body);
  const updated = await patchMe(req.user!.id, body);
  res.json({ user: publicUser(updated) });
});

/**
 * GET /api/v1/users/me
 * Full profile including role-specific side. Called on app start after
 * /auth/verify to hydrate the app's user state.
 */
usersRouter.get('/me', async (req, res) => {
  const me = await getMe(req.user!.id);
  if (!me) throw errors.notFound('User');
  res.json({
    user: publicUser(me),
    household: me.household,
    dealer: me.dealer
      ? { ...me.dealer, aadhaarNumberHash: undefined }
      : null,
  });
});
