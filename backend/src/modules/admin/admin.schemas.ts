import { z } from 'zod';

export const listUsersQuery = z.object({
  role: z.enum(['HOUSEHOLD', 'DEALER', 'ADMIN']).optional(),
  blocked: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().uuid().optional(),
});

export const listPickupsQuery = z.object({
  status: z
    .enum(['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().uuid().optional(),
});

export const blockBody = z.object({ blocked: z.boolean() });
export const verifyBody = z.object({ verified: z.boolean() });
