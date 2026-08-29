import crypto from 'node:crypto';
import type { User, VehicleType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { errors } from '../../lib/errors';

/**
 * Set the user's role for the first (and only) time and initialize the
 * matching profile row. Idempotent for the same role; rejects role changes.
 */
export async function selectRole(user: User, role: 'HOUSEHOLD' | 'DEALER', name: string) {
  if (user.role && user.role !== role) {
    throw errors.conflict(`Role already set to ${user.role} and cannot be changed`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { role, name },
    });

    if (role === 'HOUSEHOLD') {
      await tx.householdProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    } else {
      await tx.dealerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, acceptedWasteTypes: [] },
      });
    }

    return updated;
  });
}

/**
 * Save household-specific profile fields. Idempotent — a repeat call updates.
 */
export async function completeHouseholdProfile(
  userId: string,
  input: { defaultAddress: string; defaultLat: number; defaultLng: number },
) {
  return prisma.householdProfile.update({
    where: { userId },
    data: input,
  });
}

/**
 * Save dealer-specific profile fields. The raw Aadhaar number is one-way
 * hashed for lookup + audit; the raw value never lands on disk.
 */
export async function completeDealerProfile(
  userId: string,
  input: {
    aadhaarNumber: string;
    vehicleType: VehicleType;
    acceptedWasteTypes: string[];
  },
) {
  const aadhaarNumberHash = crypto
    .createHash('sha256')
    .update(input.aadhaarNumber)
    .digest('hex');

  return prisma.dealerProfile.update({
    where: { userId },
    data: {
      aadhaarNumberHash,
      vehicleType: input.vehicleType,
      acceptedWasteTypes: input.acceptedWasteTypes,
    },
  });
}

export async function updateFcmToken(userId: string, fcmToken: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { fcmToken },
  });
}

export async function patchMe(
  userId: string,
  input: { name?: string; profilePhoto?: string },
) {
  return prisma.user.update({
    where: { id: userId },
    data: input,
  });
}

export async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { household: true, dealer: true },
  });
}
