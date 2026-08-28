import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import { verifyFirebaseIdToken } from '../lib/auth';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

/**
 * Socket.IO server. Every authenticated user joins a private room named
 * `user:<userId>`; the app can then emit to that room to reach exactly one
 * user across all their connected devices.
 *
 * Handshake auth: client passes { token: '<firebase-id-token>' } in the
 * connection auth payload. We verify it, look up the User, and reject the
 * connection if either step fails.
 */
let io: IOServer | null = null;

export function initSocket(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    cors: { origin: '*', credentials: true },
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth?.token ?? socket.handshake.query?.token) as
        | string
        | undefined;
      if (!token) return next(new Error('Missing auth token'));

      const verified = await verifyFirebaseIdToken(token);
      const user = await prisma.user.findUnique({ where: { firebaseUid: verified.uid } });
      if (!user) return next(new Error('User not registered'));
      if (user.isBlocked) return next(new Error('User blocked'));

      (socket.data as { userId: string; role: string | null }).userId = user.id;
      (socket.data as { userId: string; role: string | null }).role = user.role;
      next();
    } catch (err) {
      logger.warn({ err }, 'socket auth failed');
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;
    socket.join(`user:${userId}`);
    logger.debug({ userId, sid: socket.id }, 'socket connected');

    socket.on('disconnect', (reason) => {
      logger.debug({ userId, sid: socket.id, reason }, 'socket disconnected');
    });
  });

  return io;
}

/**
 * Emit an event into one user's room. Safe to call even if socket.io isn't
 * up (test env, warm-up): it just no-ops.
 */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function getIO(): IOServer | null {
  return io;
}
