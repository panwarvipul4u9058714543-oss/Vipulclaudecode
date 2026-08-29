import admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

/**
 * Initializes the Firebase Admin SDK once. If FIREBASE_SERVICE_ACCOUNT_JSON is
 * not set (local dev or CI), initialization is skipped — call sites that need
 * verification will throw a clear error via `getFirebaseAuth`.
 */
let initialized = false;

export function initFirebase(): void {
  if (initialized) return;
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — Firebase Auth disabled');
    return;
  }
  try {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    logger.info('firebase admin initialized');
  } catch (err) {
    logger.error({ err }, 'failed to initialize firebase admin');
    throw err;
  }
}

export function isFirebaseReady(): boolean {
  return initialized;
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!initialized) {
    throw new Error(
      'Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_JSON and call initFirebase() at boot.',
    );
  }
  return admin.auth();
}

export function getFirebaseMessaging(): admin.messaging.Messaging {
  if (!initialized) {
    throw new Error(
      'Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_JSON and call initFirebase() at boot.',
    );
  }
  return admin.messaging();
}
