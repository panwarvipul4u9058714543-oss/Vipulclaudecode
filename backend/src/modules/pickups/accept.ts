import { PickupStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { redis } from '../../config/redis';
import { errors } from '../../lib/errors';
import { emitToUser } from '../../realtime/socket';
import { notifyUser } from '../../lib/notify';

/**
 * Race-safe "dealer accepts pickup".
 *
 * Two dealers can hit Accept in the same millisecond. We use a Redis
 * `SET NX` lock as the tiebreaker: whichever request completes the SET
 * first owns the pickup; the loser gets 409.
 *
 * The lock has a 30-second TTL so a crashed acceptor cannot permanently
 * strand the pickup — after the TTL the row is still ACCEPTED in Postgres,
 * but if we ever needed to reassign (dealer no-show) an admin path could
 * flip the row back to OPEN and the lock would already be gone.
 */
export async function acceptPickup(dealerUserId: string, pickupId: string) {
  const lockKey = `pickup:${pickupId}:lock`;
  const lockOk = await redis.set(lockKey, dealerUserId, 'EX', 30, 'NX');
  if (lockOk !== 'OK') {
    throw errors.conflict('Pickup already accepted by another dealer');
  }

  try {
    const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId } });
    if (!pickup) throw errors.notFound('Pickup');
    if (pickup.status !== PickupStatus.OPEN) {
      throw errors.conflict(`Pickup is in ${pickup.status} state`);
    }

    const dealer = await prisma.dealerProfile.findUnique({
      where: { userId: dealerUserId },
      include: { user: true },
    });
    if (!dealer) throw errors.notFound('Dealer profile');
    if (!dealer.isVerified) throw errors.forbidden('Dealer not verified');
    if (!dealer.isOnline) throw errors.conflict('Dealer is offline');

    const updated = await prisma.pickupRequest.update({
      where: { id: pickupId },
      data: {
        status: PickupStatus.ACCEPTED,
        acceptedDealerId: dealerUserId,
        acceptedAt: new Date(),
      },
    });

    // Notify the household that a dealer is coming.
    const household = await prisma.user.findUnique({
      where: { id: pickup.householdId },
      select: { id: true, fcmToken: true },
    });
    if (household) {
      await notifyUser({
        userId: household.id,
        fcmToken: household.fcmToken,
        socketEvent: 'pickup:accepted',
        notification: {
          title: 'Dealer accepted your pickup',
          body: `${dealer.user.name ?? 'A dealer'} is on the way`,
        },
        data: {
          pickupId,
          dealerId: dealerUserId,
          dealerName: dealer.user.name ?? '',
          dealerPhone: dealer.user.phone,
        },
      });
    }

    // Tell other dealers that the pickup is off the board.
    emitToUser(dealerUserId, 'pickup:accepted-by-you', { pickupId });
    // Broadcast to a general "pickup taken" channel so other dealer apps can
    // remove it from their available list.
    emitToUser(`pickup:${pickupId}`, 'pickup:taken', { pickupId });

    return updated;
  } catch (err) {
    // If anything after the lock fails, release it so a retry is possible.
    await redis.del(lockKey);
    throw err;
  }
}
