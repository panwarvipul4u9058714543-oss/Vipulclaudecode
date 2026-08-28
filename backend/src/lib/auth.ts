import { getFirebaseAuth } from '../config/firebase';
import { errors } from './errors';

/**
 * What we need out of a verified Firebase token. Kept minimal so tests can
 * fake it and so we're insulated from Firebase-specific fields.
 */
export interface VerifiedToken {
  uid: string;
  phoneNumber: string;
}

/**
 * Verify a Firebase ID token from the Authorization header. Wraps
 * firebase-admin so the rest of the app doesn't import it directly and
 * so tests can override this module.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedToken> {
  if (!idToken || typeof idToken !== 'string') {
    throw errors.unauthorized('Missing or invalid id token');
  }
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
    if (!decoded.phone_number) {
      throw errors.unauthorized('Firebase token missing phone_number claim');
    }
    return { uid: decoded.uid, phoneNumber: decoded.phone_number };
  } catch (err) {
    if (err instanceof Error && err.name === 'AppError') throw err;
    throw errors.unauthorized('Invalid or expired id token');
  }
}
