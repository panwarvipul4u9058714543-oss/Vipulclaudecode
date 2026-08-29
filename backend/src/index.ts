import { createServer } from 'node:http';
import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { initFirebase } from './config/firebase';
import { initCloudinary } from './config/cloudinary';
import { initSocket } from './realtime/socket';
import { startExpiryWorker, stopExpiryWorker } from './modules/pickups/expiryWorker';

async function main() {
  initFirebase();
  initCloudinary();
  const app = buildApp();
  const server = createServer(app);
  initSocket(server);
  startExpiryWorker();

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stopExpiryWorker();
    server.close();
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal boot error', err);
  process.exit(1);
});
