import { getFirebaseMessaging, isFirebaseReady } from '../config/firebase';
import { logger } from '../config/logger';
import { emitToUser } from '../realtime/socket';

/**
 * Notify a user through BOTH channels:
 *   - Push (FCM) — reaches them even if the app is closed.
 *   - Socket.IO — instant in-app popup if the app is open in the foreground.
 *
 * Both paths are best-effort: a delivery failure is logged, not thrown, so
 * one broken device token doesn't break a fan-out to 30 dealers.
 */
export interface NotifyParams {
  userId: string;
  fcmToken?: string | null;
  socketEvent: string; // e.g. "pickup:new-request"
  data: Record<string, string>; // FCM data payload — everything must be strings
  notification?: { title: string; body: string };
}

export async function notifyUser(params: NotifyParams): Promise<void> {
  emitToUser(params.userId, params.socketEvent, params.data);

  if (params.fcmToken && isFirebaseReady()) {
    try {
      await getFirebaseMessaging().send({
        token: params.fcmToken,
        data: params.data,
        notification: params.notification,
        android: { priority: 'high' },
      });
    } catch (err) {
      logger.warn({ err, userId: params.userId }, 'FCM push failed');
    }
  }
}

/**
 * Fire N notifications in parallel; returns after all resolve/reject.
 */
export async function notifyMany(params: NotifyParams[]): Promise<void> {
  await Promise.allSettled(params.map(notifyUser));
}
