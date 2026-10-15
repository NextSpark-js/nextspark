/**
 * Cancel Subscription Endpoint
 *
 * Allows users to cancel their subscription directly without going through the billing portal.
 * Supports both soft cancel (at period end) and hard cancel (immediate).
 *
 * P1-4: Cancel subscription directo
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import * as z from 'zod'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'

const cancelSchema = z.object({
  immediate: z.boolean().optional().default(false),
  reason: z.string().optional()
})

/**
 * POST /api/v1/billing/cancel
 * Cancel the team's active subscription
 *
 * Body:
 * - immediate: boolean (default: false) - If true, cancels immediately. If false, cancels at period end.
 * - reason: string (optional) - Reason for cancellation (stored in metadata)
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Dual authentication; the API-key scope is declared at the entry
  // point, which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'billing:write' })

  if (!authResult.success || !authResult.user) {
    return createAuthFailureResponse(authResult)
  }

  // 2. Get team context
  const teamId = request.headers.get('x-team-id') || authResult.user.defaultTeamId

  if (!teamId) {
    return createApiError('No team context available. Please provide x-team-id header.', 400, undefined, 'VALIDATION_ERROR')
  }

  // 3. Permission check using MembershipService
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('team.billing.manage')

  if (!actionResult.allowed) {
    return createApiError(actionResult.message, 403, undefined, 'ACTION_NOT_ALLOWED', { reason: actionResult.reason, meta: actionResult.meta })
  }

  // 4. Parse and validate request body
  const parsedBody = await readJsonObject(request)
  if (parsedBody.error) return parsedBody.error
  const body = parsedBody.data

  // Check if this is a reactivation request
  if (body.action === 'reactivate') {
    return handleReactivation(teamId)
  }

  // Otherwise, it's a cancel request
  const parseResult = cancelSchema.safeParse(body)
  if (!parseResult.success) {
    return createApiError('Invalid request body', 400, parseResult.error.issues, 'VALIDATION_ERROR')
  }

  const { immediate, reason } = parseResult.data

  // 5. Get active subscription
  const subscription = await SubscriptionService.getActive(teamId)

  if (!subscription || !subscription.externalSubscriptionId) {
    return createApiError('No active subscription found', 404, undefined, 'NOT_FOUND')
  }

  // 6. Cancel via billing gateway
  try {
    const gateway = await getBillingGateway()
    if (immediate) {
      await gateway.cancelSubscriptionImmediately(subscription.externalSubscriptionId)
    } else {
      await gateway.cancelSubscriptionAtPeriodEnd(subscription.externalSubscriptionId)
    }

    // 7. Update local DB
    await queryWithRLS(
      `UPDATE subscriptions
       SET "cancelAtPeriodEnd" = $1,
           "canceledAt" = $2,
           metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cancelReason}', $3::jsonb),
           "updatedAt" = now()
       WHERE id = $4`,
      [
        !immediate, // cancelAtPeriodEnd is true for soft cancel
        immediate ? new Date() : null,
        JSON.stringify(reason || 'User requested'),
        subscription.id
      ]
    )

    return NextResponse.json({
      success: true,
      data: {
        canceledAt: immediate ? new Date().toISOString() : null,
        cancelAtPeriodEnd: !immediate,
        periodEnd: subscription.currentPeriodEnd?.toISOString() || null,
        message: immediate
          ? 'Subscription canceled immediately'
          : 'Subscription will cancel at the end of the current billing period'
      }
    })
  } catch (error) {
    console.error('[cancel] Error canceling subscription:', error)
    return createApiError('Failed to cancel subscription', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'strict');

/**
 * Handle reactivation of a subscription that was scheduled to cancel
 */
async function handleReactivation(teamId: string) {
  const subscription = await SubscriptionService.getActive(teamId)

  if (!subscription || !subscription.externalSubscriptionId) {
    return createApiError('No active subscription found', 404, undefined, 'NOT_FOUND')
  }

  if (!subscription.cancelAtPeriodEnd) {
    return createApiError('Subscription is not scheduled for cancellation', 400, undefined, 'VALIDATION_ERROR')
  }

  try {
    const gateway = await getBillingGateway()
    await gateway.reactivateSubscription(subscription.externalSubscriptionId)

    // Update local DB
    await queryWithRLS(
      `UPDATE subscriptions
       SET "cancelAtPeriodEnd" = false,
           "canceledAt" = NULL,
           metadata = metadata - 'cancelReason',
           "updatedAt" = now()
       WHERE id = $1`,
      [subscription.id]
    )

    return NextResponse.json({
      success: true,
      data: {
        reactivated: true,
        message: 'Subscription reactivated successfully'
      }
    })
  } catch (error) {
    console.error('[cancel] Error reactivating subscription:', error)
    return createApiError('Failed to reactivate subscription', 500, undefined, 'INTERNAL_ERROR')
  }
}

export const OPTIONS = corsPreflight
