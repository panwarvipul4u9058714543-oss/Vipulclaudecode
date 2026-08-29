import type { User } from '@prisma/client';
import { prisma } from '../../config/prisma';

/**
 * Find or create the User row for a verified Firebase identity.
 * This is the single entry point called by `/auth/verify` right after the
 * client authenticates against Firebase phone OTP.
 */
export async function upsertUserFromFirebase(params: {
  firebaseUid: string;
  phone: string;
}): Promise<User> {
  return prisma.user.upsert({
    where: { firebaseUid: params.firebaseUid },
    update: {}, // no-op; a re-login should not overwrite profile fields
    create: {
      firebaseUid: params.firebaseUid,
      phone: params.phone,
    },
  });
}
