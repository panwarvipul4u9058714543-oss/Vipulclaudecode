import { PickupStatus, type PickupRequest } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { errors } from '../../lib/errors';
import { isPlausibleIndiaCoord } from '../../lib/geo';

export interface CreatePickupInput {
  wasteTypes: string[];
  photoUrls: string[];
  estimatedWeightKg?: number;
  description?: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
}

export async function createPickup(
  householdUserId: string,
  input: CreatePickupInput,
): Promise<PickupRequest> {
  if (!isPlausibleIndiaCoord(input.pickupLat, input.pickupLng)) {
    throw errors.badRequest('Pickup location is outside supported region');
  }

  const expiresAt = new Date(Date.now() + env.PICKUP_EXPIRY_MINUTES * 60_000);

  return prisma.pickupRequest.create({
    data: {
      householdId: householdUserId,
      wasteTypes: input.wasteTypes,
      photoUrls: input.photoUrls,
      estimatedWeightKg: input.estimatedWeightKg,
      description: input.description,
      pickupAddress: input.pickupAddress,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      expiresAt,
    },
  });
}

export async function listMyPickups(
  householdUserId: string,
  opts: { status?: PickupStatus; limit: number; cursor?: string },
) {
  const rows = await prisma.pickupRequest.findMany({
    where: {
      householdId: householdUserId,
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  return {
    items: rows.slice(0, opts.limit),
    nextCursor: hasMore ? rows[opts.limit - 1].id : null,
  };
}

/**
 * Fetch one pickup + guard that the caller owns it. Dealers can only see
 * pickups they've accepted; households can only see their own.
 */
export async function getPickupForUser(
  pickupId: string,
  userId: string,
  role: 'HOUSEHOLD' | 'DEALER',
) {
  const pickup = await prisma.pickupRequest.findUnique({
    where: { id: pickupId },
    include: {
      household: { select: { id: true, name: true, phone: true, profilePhoto: true } },
      dealer: {
        select: {
          id: true,
          name: true,
          phone: true,
          profilePhoto: true,
          dealer: {
            select: {
              vehicleType: true,
              currentLat: true,
              currentLng: true,
              lastLocationUpdate: true,
              ratingSum: true,
              ratingCount: true,
            },
          },
        },
      },
    },
  });

  if (!pickup) throw errors.notFound('Pickup');

  if (role === 'HOUSEHOLD' && pickup.householdId !== userId) {
    throw errors.forbidden('Not your pickup');
  }
  if (role === 'DEALER' && pickup.acceptedDealerId !== userId) {
    throw errors.forbidden('Not your pickup');
  }

  return pickup;
}

/**
 * Household cancels their own pickup. Allowed while OPEN or ACCEPTED.
 * Once IN_PROGRESS a dealer is on-site — cancelling is a dispute, not a
 * self-serve action.
 */
export async function cancelPickupByHousehold(
  pickupId: string,
  householdUserId: string,
  reason?: string,
): Promise<PickupRequest> {
  const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId } });
  if (!pickup) throw errors.notFound('Pickup');
  if (pickup.householdId !== householdUserId) throw errors.forbidden('Not your pickup');
  if (pickup.status !== PickupStatus.OPEN && pickup.status !== PickupStatus.ACCEPTED) {
    throw errors.conflict(`Cannot cancel a pickup in ${pickup.status} state`);
  }

  return prisma.pickupRequest.update({
    where: { id: pickupId },
    data: {
      status: PickupStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledReason: reason,
    },
  });
}
