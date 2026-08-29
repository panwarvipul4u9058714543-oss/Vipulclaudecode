import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { errors } from '../lib/errors';

/**
 * Gate a route by required role(s). Must be mounted AFTER authMiddleware so
 * req.user is populated.
 *
 * Usage:
 *   router.post('/pickups', authMiddleware, requireRole('HOUSEHOLD'), handler)
 */
export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) throw errors.unauthorized();
    if (!user.role) throw errors.forbidden('Role not selected — call /users/select-role first');
    if (!allowed.includes(user.role)) {
      throw errors.forbidden(`Requires role: ${allowed.join(' or ')}`);
    }
    next();
  };
}
