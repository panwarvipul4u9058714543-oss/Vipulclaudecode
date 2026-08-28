import 'express-async-errors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';

/**
 * Builds the Express app. Split from index.ts so tests can import the app
 * without spinning up a real HTTP listener.
 */
export function buildApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' } }));

  app.use('/healthz', healthRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'waste-management-backend', version: '0.1.0' });
  });

  // API v1
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
