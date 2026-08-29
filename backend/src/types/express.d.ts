import type { User } from '@prisma/client';

/**
 * Extend Express's Request so `req.user` is a typed User row set by the auth
 * middleware. Available on any route mounted behind `authMiddleware`.
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
