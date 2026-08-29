import type { RequestHandler } from 'express';
import { verifyFirebaseIdToken } from '../lib/auth';
import { prisma } from '../config/prisma';
import { errors } from '../lib/errors';

/**
 * Verifies the `Authorization: Bearer <firebase-id-token>` header, then loads
 * the matching User row and attaches it to req.user. Rejects blocked users.
 * Routes that need only a verified phone (like /auth/verify at first sign-up)
 * should use `authMiddlewareLoose` instead — it doesn't require an existing
 * user row.
 */
export const authMiddleware: RequestHandler = async (req, _res, next) => {
  const token = extractBearer(req.header('authorization'));
  const verified = await verifyFirebaseIdToken(token);

  const user = await prisma.user.findUnique({ where: { firebaseUid: verified.uid } });
  if (!user) throw errors.unauthorized('User not registered');
  if (user.isBlocked) throw errors.forbidden('Account is blocked');

  req.user = user;
  next();
};

/**
 * Verifies the token but does not require an existing DB user. Used only by
 * /auth/verify which creates the user row on first call.
 */
export const authMiddlewareLoose: RequestHandler = async (req, _res, next) => {
  const token = extractBearer(req.header('authorization'));
  const verified = await verifyFirebaseIdToken(token);
  // Stash verified claims on the request for the handler to consume.
  (req as unknown as { _verified: typeof verified })._verified = verified;
  next();
};

function extractBearer(header: string | undefined): string {
  if (!header) throw errors.unauthorized('Missing Authorization header');
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) throw errors.unauthorized('Authorization header must be "Bearer <token>"');
  return match[1];
}
