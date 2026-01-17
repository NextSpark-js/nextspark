import { NextRequest, NextResponse } from 'next/server';
import { getTypedSession } from '@nextsparkjs/core/lib/auth';
import { queryWithRLS } from '@nextsparkjs/core/lib/db';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

interface TeamResult {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamMemberResult {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  userId: string;
}

interface SubscriptionResult {
  id: string;
  planId: string;
  planSlug: string;
  planName: string;
  planType: string;
  priceMonthly: number | null;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  externalSubscriptionId: string | null;
  externalCustomerId: string | null;
  createdAt: string;
}

interface BillingEventResult {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

interface UsageResult {
  limitSlug: string;
  currentValue: number;
  periodKey: string;
}

/**
 * GET /api/superadmin/teams/[teamId]
 *
 * Retrieves a single team with owner info and members.
 * Only accessible by superadmin or developer users.
 */
export const GET = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) => {
  try {
    const { teamId } = await params;

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

    // Query for team details
    const teamQuery = `
      SELECT
        t.id,
        t.name,
        t."ownerId",
        COALESCE(u."firstName" || ' ' || u."lastName", u.email) as "ownerName",
        u.email as "ownerEmail",
        t."createdAt",
        t."updatedAt"
      FROM "teams" t
      LEFT JOIN "users" u ON t."ownerId" = u.id
      WHERE t.id = $1
    `;

    // Query for team members
    const membersQuery = `
      SELECT
        tm.id,
        tm.role,
        tm."joinedAt",
        COALESCE(u."firstName" || ' ' || u."lastName", u.email) as name,
        u.email,
        u.id as "userId"
      FROM "team_members" tm
      LEFT JOIN "users" u ON tm."userId" = u.id
      WHERE tm."teamId" = $1
      ORDER BY
        CASE tm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
          WHEN 'viewer' THEN 4
          ELSE 5
        END,
        tm."joinedAt" ASC
    `;

    // Query for subscription
    const subscriptionQuery = `
      SELECT
        s.id,
        s."planId",
        p.slug as "planSlug",
        p.name as "planName",
        p.type as "planType",
        p."priceMonthly",
        s.status,
        s."currentPeriodStart",
        s."currentPeriodEnd",
        s."trialEndsAt",
        s."canceledAt",
        s."cancelAtPeriodEnd",
        s."externalSubscriptionId",
        s."externalCustomerId",
        s."createdAt"
      FROM "subscriptions" s
      LEFT JOIN "plans" p ON s."planId" = p.id
      WHERE s."teamId" = $1
      ORDER BY s."createdAt" DESC
      LIMIT 1
    `;

    // Query for billing events
    const billingEventsQuery = `
      SELECT
        be.id,
        be.type,
        be.status,
        be.amount,
        be.currency,
        be."invoiceUrl",
        be."receiptUrl",
        be."createdAt"
      FROM "billing_events" be
      JOIN "subscriptions" s ON be."subscriptionId" = s.id
      WHERE s."teamId" = $1
      ORDER BY be."createdAt" DESC
      LIMIT 10
    `;

    // Query for usage
    const usageQuery = `
      SELECT
        u."limitSlug",
        u."currentValue",
        u."periodKey"
      FROM "usage" u
      JOIN "subscriptions" s ON u."subscriptionId" = s.id
      WHERE s."teamId" = $1
    `;

    // Execute queries
    const [teamResult, membersResult, subscriptionResult, billingEventsResult, usageResult] = await Promise.all([
      queryWithRLS(teamQuery, [teamId], session.user.id) as Promise<TeamResult[]>,
      queryWithRLS(membersQuery, [teamId], session.user.id) as Promise<TeamMemberResult[]>,
      queryWithRLS(subscriptionQuery, [teamId], session.user.id) as Promise<SubscriptionResult[]>,
      queryWithRLS(billingEventsQuery, [teamId], session.user.id) as Promise<BillingEventResult[]>,
      queryWithRLS(usageQuery, [teamId], session.user.id) as Promise<UsageResult[]>
    ]);

    if (!teamResult || teamResult.length === 0) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const team = teamResult[0];
    const subscription = subscriptionResult[0] || null;

    // Prepare response data
    const responseData = {
      team: {
        id: team.id,
        name: team.name,
        owner: {
          id: team.ownerId,
          name: team.ownerName?.trim() || team.ownerEmail,
          email: team.ownerEmail
        },
        memberCount: membersResult.length,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      },
      members: membersResult.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.name?.trim() || member.email,
        email: member.email,
        role: member.role,
        joinedAt: member.joinedAt
      })),
      subscription: subscription ? {
        id: subscription.id,
        plan: {
          id: subscription.planId,
          slug: subscription.planSlug,
          name: subscription.planName,
          type: subscription.planType,
          priceMonthly: subscription.priceMonthly,
          priceFormatted: subscription.priceMonthly
            ? `$${(subscription.priceMonthly / 100).toFixed(2)}/mo`
            : 'Free'
        },
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
        canceledAt: subscription.canceledAt,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        externalSubscriptionId: subscription.externalSubscriptionId,
        externalCustomerId: subscription.externalCustomerId,
        createdAt: subscription.createdAt
      } : null,
      billingHistory: billingEventsResult.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        amount: event.amount,
        amountFormatted: `$${(event.amount / 100).toFixed(2)}`,
        currency: event.currency,
        invoiceUrl: event.invoiceUrl,
        receiptUrl: event.receiptUrl,
        createdAt: event.createdAt
      })),
      usage: usageResult.reduce((acc, u) => {
        acc[u.limitSlug] = {
          current: u.currentValue,
          periodKey: u.periodKey
        };
        return acc;
      }, {} as Record<string, { current: number; periodKey: string }>),
      metadata: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString(),
        source: 'superadmin-api'
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching team data:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve team data'
      },
      { status: 500 }
    );
  }
}, 'strict');
