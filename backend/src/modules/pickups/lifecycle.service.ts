import { PaymentMethod, PickupStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { errors } from '../../lib/errors';
import { notifyUser } from '../../lib/notify';

/**
 * Dealer marks a pickup IN_PROGRESS on arrival at the household.
 */
export async function startPickup(dealerUserId: string, pickupId: string) {
  const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId } });
  if (!pickup) throw errors.notFound('Pickup');
  if (pickup.acceptedDealerId !== dealerUserId) throw errors.forbidden('Not your pickup');
  if (pickup.status !== PickupStatus.ACCEPTED) {
    throw errors.conflict(`Cannot start a pickup in ${pickup.status} state`);
  }

  const updated = await prisma.pickupRequest.update({
    where: { id: pickupId },
    data: { status: PickupStatus.IN_PROGRESS, startedAt: new Date() },
  });

  const household = await prisma.user.findUnique({
    where: { id: pickup.householdId },
    select: { id: true, fcmToken: true },
  });
  if (household) {
    await notifyUser({
      userId: household.id,
      fcmToken: household.fcmToken,
      socketEvent: 'pickup:in-progress',
      notification: { title: 'Dealer has arrived', body: 'They are collecting your items now' },
      data: { pickupId },
    });
  }
  return updated;
}

/**
 * Dealer completes the pickup with the actual weight + amount. Creates the
 * PickupTransaction and marks the pickup COMPLETED. Bumps counters on both
 * profiles.
 */
export async function completePickup(
  dealerUserId: string,
  pickupId: string,
  input: {
    finalWeightKg: number;
    finalAmountRupees: number;
    paymentMethod: PaymentMethod;
    dealerNotes?: string;
  },
) {
  const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId } });
  if (!pickup) throw errors.notFound('Pickup');
  if (pickup.acceptedDealerId !== dealerUserId) throw errors.forbidden('Not your pickup');
  if (pickup.status !== PickupStatus.IN_PROGRESS) {
    throw errors.conflict(`Cannot complete a pickup in ${pickup.status} state`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.pickupRequest.update({
      where: { id: pickupId },
      data: { status: PickupStatus.COMPLETED, completedAt: new Date() },
    });

    await tx.pickupTransaction.create({
      data: {
        pickupRequestId: pickupId,
        finalWeightKg: input.finalWeightKg,
        finalAmountRupees: input.finalAmountRupees,
        paymentMethod: input.paymentMethod,
        dealerNotes: input.dealerNotes,
      },
    });

    await tx.householdProfile.update({
      where: { userId: pickup.householdId },
      data: { totalPickups: { increment: 1 } },
    });
    await tx.dealerProfile.update({
      where: { userId: dealerUserId },
      data: { totalPickups: { increment: 1 } },
    });

    // Notify household (fire-and-forget outside the tx would be cleaner, but
    // for MVP we do it after commit below).
    return updated;
  }).then(async (updated) => {
    const household = await prisma.user.findUnique({
      where: { id: pickup.householdId },
      select: { id: true, fcmToken: true },
    });
    if (household) {
      await notifyUser({
        userId: household.id,
        fcmToken: household.fcmToken,
        socketEvent: 'pickup:completed',
        notification: {
          title: 'Pickup completed',
          body: `₹${input.finalAmountRupees.toFixed(0)} for ${input.finalWeightKg.toFixed(1)} kg`,
        },
        data: {
          pickupId,
          amount: String(input.finalAmountRupees),
          weightKg: String(input.finalWeightKg),
        },
      });
    }
    return updated;
  });
}

/**
 * Either party leaves a review after completion. One review per (pickup,
 * reviewer) is enforced by the unique index.
 */
export async function leaveReview(
  reviewerId: string,
  pickupId: string,
  stars: number,
  comment: string | undefined,
) {
  const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId } });
  if (!pickup) throw errors.notFound('Pickup');
  if (pickup.status !== PickupStatus.COMPLETED) {
    throw errors.conflict('Reviews are allowed only after completion');
  }

  const isHousehold = pickup.householdId === reviewerId;
  const isDealer = pickup.acceptedDealerId === reviewerId;
  if (!isHousehold && !isDealer) throw errors.forbidden('Not a participant of this pickup');

  const revieweeId = isHousehold ? pickup.acceptedDealerId! : pickup.householdId;

  try {
    const review = await prisma.review.create({
      data: { pickupRequestId: pickupId, reviewerId, revieweeId, stars, comment },
    });

    if (isHousehold) {
      await prisma.dealerProfile.update({
        where: { userId: revieweeId },
        data: {
          ratingSum: { increment: stars },
          ratingCount: { increment: 1 },
        },
      });
    } else {
      await prisma.householdProfile.update({
        where: { userId: revieweeId },
        data: {
          ratingSum: { increment: stars },
          ratingCount: { increment: 1 },
        },
      });
    }
    return review;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique')) {
      throw errors.conflict('You have already reviewed this pickup');
    }
    throw err;
  }
}
