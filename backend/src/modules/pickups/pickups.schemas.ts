import { z } from 'zod';

const WASTE_TYPES = [
  'iron',
  'other-metal',
  'plastic',
  'paper',
  'cardboard',
  'glass',
  'e-waste',
  'appliances',
  'clothes',
  'mixed',
] as const;

export const createPickupSchema = z.object({
  wasteTypes: z.array(z.enum(WASTE_TYPES)).min(1).max(WASTE_TYPES.length),
  photoUrls: z
    .array(z.string().url().max(1024))
    .min(1, 'At least one photo required')
    .max(5, 'At most 5 photos'),
  estimatedWeightKg: z.number().positive().max(5000).optional(),
  description: z.string().trim().max(500).optional(),
  pickupAddress: z.string().trim().min(3).max(500),
  pickupLat: z.number().gte(-90).lte(90),
  pickupLng: z.number().gte(-180).lte(180),
});

export const cancelPickupSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const listPickupsQuery = z.object({
  status: z
    .enum(['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
});

export const ACCEPTED_WASTE_TYPES = WASTE_TYPES;
