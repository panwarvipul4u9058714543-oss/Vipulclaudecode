// Vitest global setup — sets env vars needed for env.ts to parse cleanly
// without a real .env file. Keeps tests hermetic.
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = 'postgresql://waste:waste@localhost:5432/waste_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.LOG_LEVEL = 'fatal';
process.env.CORS_ORIGINS = '*';
