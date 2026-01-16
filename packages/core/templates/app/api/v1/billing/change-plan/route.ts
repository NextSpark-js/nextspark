/**
 * Change Plan Endpoint
 *
 * Allows users to upgrade or downgrade their subscription plan.
 * Handles proration via Stripe automatically.
 *
 * P1-3: Plan Change con Proration
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

const changePlanSchema = z.object({
  planSlug: z.string().min(1, 'Plan slug is required'),
  billingInterval: z.enum(['monthly', 'yearly']).default('monthly'),
})

/**
 * POST /api/v1/billing/change-plan
 * Change the team's subscription plan (upgrade or downgrade)
 *
 * Body:
 * - planSlug: string - Target plan slug
 * - billingInterval: 'monthly' | 'yearly' (default: monthly)
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Dual authentication
  const authResult = await authenticateRequest(request)

  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // 2. Get team context
  const teamId = request.headers.get('x-team-id') || authResult.user.defaultTeamId

  if (!teamId) {
    return NextResponse.json(
      {
        success: false,
        error: 'No team context available. Please provide x-team-id header.',
      },
      { status: 400 }
    )
  }

  // 3. Permission check using MembershipService
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('billing.change-plan')

  if (!actionResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: actionResult.message,
        reason: actionResult.reason,
        meta: actionResult.meta,
      },
      { status: 403 }
    )
  }

  // 4. Parse and validate request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = changePlanSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { planSlug, billingInterval } = parseResult.data

  // 5. Execute plan change
  const result = await SubscriptionService.changePlan(teamId, planSlug, billingInterval)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    data: {
      subscription: result.subscription,
      warnings: result.downgradeWarnings,
    },
  })
}, 'strict');
