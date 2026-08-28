import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Single shared Prisma client for the whole process. In dev, tsx watch reloads
 * would otherwise create a new client on every save and exhaust connections.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
