import { z } from 'zod';

// ─── Role selection ───────────────────────────────────────────────────

export const selectRoleSchema = z.object({
  role: z.enum(['HOUSEHOLD', 'DEALER']),
  name: z.string().trim().min(2).max(80),
});

// ─── Complete profile ─────────────────────────────────────────────────
// One-of by role. We accept either payload and dispatch on it.

export const householdProfileSchema = z.object({
  defaultAddress: z.string().trim().min(3).max(500),
  defaultLat: z.number().gte(-90).lte(90),
  defaultLng: z.number().gte(-180).lte(180),
});

export const dealerProfileSchema = z.object({
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  vehicleType: z.enum(['CYCLE_CART', 'AUTO', 'MINI_TRUCK', 'OTHER']),
  acceptedWasteTypes: z
    .array(z.string().trim().min(1).max(40))
    .min(1, 'Pick at least one waste type')
    .max(20),
});

// ─── FCM token update ─────────────────────────────────────────────────

export const fcmTokenSchema = z.object({
  fcmToken: z.string().trim().min(10).max(4096),
});

// ─── Patch me ─────────────────────────────────────────────────────────

export const patchMeSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    profilePhoto: z.string().url().max(1024).optional(),
  })
  .refine((v) => v.name !== undefined || v.profilePhoto !== undefined, {
    message: 'At least one field required',
  });
