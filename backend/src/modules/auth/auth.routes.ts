import { Router } from 'express';
import { authMiddlewareLoose } from '../../middleware/auth';
import { upsertUserFromFirebase } from './auth.service';

export const authRouter = Router();

/**
 * POST /api/v1/auth/verify
 * Called by the app immediately after Firebase phone-OTP succeeds.
 * Body: none. Headers: Authorization: Bearer <firebase-id-token>.
 * Response: the User row (existing or newly created).
 *
 * A brand-new user gets a row with role=null. The app should then prompt them
 * to pick HOUSEHOLD or DEALER and call /users/select-role.
 */
authRouter.post('/verify', authMiddlewareLoose, async (req, res) => {
  const verified = (req as unknown as { _verified: { uid: string; phoneNumber: string } })
    ._verified;

  const user = await upsertUserFromFirebase({
    firebaseUid: verified.uid,
    phone: verified.phoneNumber,
  });

  res.json({
    user: publicUser(user),
    needsRole: user.role === null,
  });
});

export function publicUser(user: {
  id: string;
  phone: string;
  role: string | null;
  name: string | null;
  profilePhoto: string | null;
  isBlocked: boolean;
}) {
  return {
    id: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name,
    profilePhoto: user.profilePhoto,
    isBlocked: user.isBlocked,
  };
}
