import { PickupStatus, type UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { redis } from '../../config/redis';
import { errors } from '../../lib/errors';
import { removeDealerLocation } from '../../lib/dealerGeo';
import { DEALERS_LIVE_KEY } from '../../lib/dealerGeo';

export async function listUsers(opts: {
  role?: UserRole;
  blocked?: boolean;
  limit: number;
  cursor?: string;
}) {
  const rows = await prisma.user.findMany({
    where: {
      ...(opts.role ? { role: opts.role } : {}),
      ...(opts.blocked !== undefined ? { isBlocked: opts.blocked } : {}),
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
 * Block or unblock a user. A blocked user cannot pass auth middleware.
 * If we block an online dealer, also kick them out of the Redis GEO index.
 */
export async function setBlocked(userId: string, blocked: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound('User');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: blocked },
  });

  if (blocked && user.role === 'DEALER') {
    await prisma.dealerProfile.update({
      where: { userId },
      data: { isOnline: false },
    }).catch(() => undefined);
    await removeDealerLocation(userId);
  }

  return updated;
}

/**
 * Toggle a dealer's KYC-verified state. Unverified dealers cannot go online
 * or accept pickups.
 */
export async function setDealerVerified(dealerUserId: string, verified: boolean) {
  const dealer = await prisma.dealerProfile.findUnique({ where: { userId: dealerUserId } });
  if (!dealer) throw errors.notFound('Dealer profile');

  const updated = await prisma.dealerProfile.update({
    where: { userId: dealerUserId },
    data: {
      isVerified: verified,
      // Force offline on un-verify so no in-flight requests go to them.
      ...(verified ? {} : { isOnline: false }),
    },
  });

  if (!verified) {
    await removeDealerLocation(dealerUserId);
  }

  return updated;
}

export async function listAllPickups(opts: {
  status?: PickupStatus;
  limit: number;
  cursor?: string;
}) {
  const rows = await prisma.pickupRequest.findMany({
    where: opts.status ? { status: opts.status } : {},
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
 * Daily aggregate counts + revenue. Kept simple — one grouped query per
 * metric, executed in parallel.
 */
export async function analytics() {
  const [
    totalUsers,
    totalHouseholds,
    totalDealers,
    verifiedDealers,
    onlineDealersFromRedis,
    pickupsByStatus,
    txAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'HOUSEHOLD' } }),
    prisma.user.count({ where: { role: 'DEALER' } }),
    prisma.dealerProfile.count({ where: { isVerified: true } }),
    redis.zcard(DEALERS_LIVE_KEY).catch(() => 0),
    prisma.pickupRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.pickupTransaction.aggregate({
      _sum: { finalAmountRupees: true, finalWeightKg: true },
      _count: { _all: true },
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      households: totalHouseholds,
      dealers: totalDealers,
      verifiedDealers,
      onlineDealers: onlineDealersFromRedis,
    },
    pickups: Object.fromEntries(pickupsByStatus.map((r) => [r.status, r._count._all])),
    revenue: {
      totalPickupsCompleted: txAgg._count._all,
      totalKg: txAgg._sum.finalWeightKg ?? 0,
      totalRupees: txAgg._sum.finalAmountRupees ?? 0,
    },
  };
}
