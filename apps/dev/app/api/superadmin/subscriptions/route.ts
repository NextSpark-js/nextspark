import { NextRequest, NextResponse } from 'next/server';
import { getTypedSession } from '@nextsparkjs/core/lib/auth';
import { queryWithRLS } from '@nextsparkjs/core/lib/db';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

interface SubscriptionResult {
  id: string;
  teamId: string;
  teamName: string;
  ownerName: string;
  ownerEmail: string;
  planId: string;
  planSlug: string;
  planName: string;
  planType: string;
  status: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  billingInterval: 'monthly' | 'yearly';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  externalSubscriptionId: string | null;
  createdAt: string;
}

interface StatsResult {
  totalSubscriptions: string;
  activeSubscriptions: string;
  trialingSubscriptions: string;
  canceledSubscriptions: string;
  pastDueSubscriptions: string;
  freeSubscriptions: string;
  paidSubscriptions: string;
  monthlySubscriptions: string;
  yearlySubscriptions: string;
  totalMRR: string;
  totalARR: string;
}

interface PlanDistribution {
  planSlug: string;
  planName: string;
  count: string;
}

/**
 * GET /api/superadmin/subscriptions
 *
 * Retrieves all subscriptions with stats for superadmin overview.
 * Supports filtering by status and pagination.
 */
export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Get the current session using Better Auth
    const session = await getTypedSession(request.headers);

    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - No session found' },
        { status: 401 }
      );
    }

    // Check if user is superadmin or developer
    if (session.user.role !== 'superadmin' && session.user.role !== 'developer') {
      return NextResponse.json(
        { error: 'Forbidden - Superadmin or developer access required' },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');
    const interval = searchParams.get('interval');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      conditions.push(`s.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (plan && plan !== 'all') {
      conditions.push(`p.slug = $${paramIndex}`);
      queryParams.push(plan);
      paramIndex++;
    }

    if (interval && interval !== 'all') {
      conditions.push(`s."billingInterval" = $${paramIndex}`);
      queryParams.push(interval);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        t.name ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        p.name ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Query for stats
    const statsQuery = `
      SELECT
        COUNT(*) as "totalSubscriptions",
        COUNT(*) FILTER (WHERE s.status = 'active') as "activeSubscriptions",
        COUNT(*) FILTER (WHERE s.status = 'trialing') as "trialingSubscriptions",
        COUNT(*) FILTER (WHERE s.status = 'canceled') as "canceledSubscriptions",
        COUNT(*) FILTER (WHERE s.status = 'past_due') as "pastDueSubscriptions",
        COUNT(*) FILTER (WHERE p.type = 'free') as "freeSubscriptions",
        COUNT(*) FILTER (WHERE p.type IN ('paid', 'enterprise')) as "paidSubscriptions",
        COUNT(*) FILTER (WHERE s."billingInterval" = 'monthly') as "monthlySubscriptions",
        COUNT(*) FILTER (WHERE s."billingInterval" = 'yearly') as "yearlySubscriptions",
        COALESCE(SUM(p."priceMonthly") FILTER (
          WHERE s.status IN ('active', 'trialing')
          AND s."billingInterval" = 'monthly'
          AND p."priceMonthly" > 0
        ), 0) as "totalMRR",
        COALESCE(SUM(p."priceYearly") FILTER (
          WHERE s.status IN ('active', 'trialing')
          AND s."billingInterval" = 'yearly'
          AND p."priceYearly" > 0
        ), 0) as "totalARR"
      FROM "subscriptions" s
      LEFT JOIN "plans" p ON s."planId" = p.id
    `;

    // Query for plan distribution
    const planDistributionQuery = `
      SELECT
        p.slug as "planSlug",
        p.name as "planName",
        COUNT(*) as count
      FROM "subscriptions" s
      LEFT JOIN "plans" p ON s."planId" = p.id
      WHERE s.status IN ('active', 'trialing')
      GROUP BY p.slug, p.name
      ORDER BY count DESC
    `;

    // Query for subscriptions list
    const subscriptionsQuery = `
      SELECT
        s.id,
        s."teamId",
        t.name as "teamName",
        COALESCE(u."firstName" || ' ' || u."lastName", u.email) as "ownerName",
        u.email as "ownerEmail",
        s."planId",
        p.slug as "planSlug",
        p.name as "planName",
        p.type as "planType",
        s.status,
        p."priceMonthly",
        p."priceYearly",
        s."billingInterval",
        s."currentPeriodStart",
        s."currentPeriodEnd",
        s."trialEndsAt",
        s."canceledAt",
        s."cancelAtPeriodEnd",
        s."externalSubscriptionId",
        s."createdAt"
      FROM "subscriptions" s
      LEFT JOIN "teams" t ON s."teamId" = t.id
      LEFT JOIN "users" u ON t."ownerId" = u.id
      LEFT JOIN "plans" p ON s."planId" = p.id
      ${whereClause}
      ORDER BY s."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "subscriptions" s
      LEFT JOIN "teams" t ON s."teamId" = t.id
      LEFT JOIN "users" u ON t."ownerId" = u.id
      LEFT JOIN "plans" p ON s."planId" = p.id
      ${whereClause}
    `;

    // Execute all queries
    const [statsResult, planDistResult, subscriptionsResult, countResult] = await Promise.all([
      queryWithRLS(statsQuery, [], session.user.id) as Promise<StatsResult[]>,
      queryWithRLS(planDistributionQuery, [], session.user.id) as Promise<PlanDistribution[]>,
      queryWithRLS(subscriptionsQuery, [...queryParams, limit, offset], session.user.id) as Promise<SubscriptionResult[]>,
      queryWithRLS(countQuery, queryParams, session.user.id) as Promise<{ total: string }[]>
    ]);

    const stats = statsResult[0] || {
      totalSubscriptions: '0',
      activeSubscriptions: '0',
      trialingSubscriptions: '0',
      canceledSubscriptions: '0',
      pastDueSubscriptions: '0',
      freeSubscriptions: '0',
      paidSubscriptions: '0',
      monthlySubscriptions: '0',
      yearlySubscriptions: '0',
      totalMRR: '0',
      totalARR: '0'
    };

    const total = parseInt(countResult[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit);

    // Format subscriptions
    const subscriptions = subscriptionsResult.map(sub => ({
      id: sub.id,
      team: {
        id: sub.teamId,
        name: sub.teamName,
        owner: {
          name: sub.ownerName?.trim() || sub.ownerEmail,
          email: sub.ownerEmail
        }
      },
      plan: {
        id: sub.planId,
        slug: sub.planSlug,
        name: sub.planName,
        type: sub.planType,
        priceMonthly: sub.priceMonthly,
        priceYearly: sub.priceYearly
      },
      billingInterval: sub.billingInterval,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      canceledAt: sub.canceledAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      externalSubscriptionId: sub.externalSubscriptionId,
      createdAt: sub.createdAt
    }));

    // Prepare response
    const responseData = {
      stats: {
        total: parseInt(stats.totalSubscriptions, 10),
        active: parseInt(stats.activeSubscriptions, 10),
        trialing: parseInt(stats.trialingSubscriptions, 10),
        canceled: parseInt(stats.canceledSubscriptions, 10),
        pastDue: parseInt(stats.pastDueSubscriptions, 10),
        free: parseInt(stats.freeSubscriptions, 10),
        paid: parseInt(stats.paidSubscriptions, 10),
        monthly: parseInt(stats.monthlySubscriptions, 10),
        yearly: parseInt(stats.yearlySubscriptions, 10),
        mrr: parseInt(stats.totalMRR, 10), // In cents
        mrrFormatted: `$${(parseInt(stats.totalMRR, 10) / 100).toFixed(2)}`,
        arr: parseInt(stats.totalARR, 10), // In cents
        arrFormatted: `$${(parseInt(stats.totalARR, 10) / 100).toFixed(2)}`
      },
      planDistribution: planDistResult.map(p => ({
        slug: p.planSlug,
        name: p.planName,
        count: parseInt(p.count, 10)
      })),
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      },
      metadata: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString(),
        source: 'superadmin-api'
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching subscriptions:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve subscriptions data'
      },
      { status: 500 }
    );
  }
}, 'strict');
