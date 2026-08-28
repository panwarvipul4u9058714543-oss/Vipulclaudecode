import { z } from 'zod';

export const completePickupSchema = z.object({
  finalWeightKg: z.number().positive().max(5000),
  finalAmountRupees: z.number().nonnegative().max(1_000_000),
  paymentMethod: z.enum(['CASH', 'UPI']).default('CASH'),
  dealerNotes: z.string().trim().max(500).optional(),
});

export const reviewSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
