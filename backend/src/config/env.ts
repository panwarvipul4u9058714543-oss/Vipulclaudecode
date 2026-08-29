import { z } from 'zod';

/**
 * Every environment variable the app uses is declared and validated here.
 * If something is missing or malformed, the process exits at startup —
 * we never want to discover a bad config three requests deep in production.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('waste-app'),

  MATCH_INITIAL_RADIUS_KM: z.coerce.number().positive().default(3),
  MATCH_MAX_RADIUS_KM: z.coerce.number().positive().default(8),
  MATCH_EXPAND_AFTER_SECONDS: z.coerce.number().int().positive().default(120),
  PICKUP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),
  DEALER_LOCATION_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  CORS_ORIGINS: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
