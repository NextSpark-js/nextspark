/**
 * Cancel Subscription Endpoint
 *
 * Allows users to cancel their subscription directly without using Stripe Portal.
 * Supports both soft cancel (at period end) and hard cancel (immediate).
 *
 * P1-4: Cancel subscription directo
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'
import {
  cancelSubscriptionAtPeriodEnd,
  cancelSubscriptionImmediately,
  reactivateSubscription
} from '@nextsparkjs/core/lib/billing/gateways/stripe'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'

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
export async function POST(request: NextRequest) {
  // 1. Dual authentication
  const authResult = await authenticateRequest(request)

  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // 2. Get team context
  const teamId = request.headers.get('x-team-id') || authResult.user.defaultTeamId

  if (!teamId) {
    return Response.json(
      {
        success: false,
        error: 'No team context available. Please provide x-team-id header.'
      },
      { status: 400 }
    )
  }

  // 3. Permission check using MembershipService
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('billing.cancel')

  if (!actionResult.allowed) {
    return Response.json(
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
    return Response.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Check if this is a reactivation request
  if (body.action === 'reactivate') {
    return handleReactivation(teamId)
  }

  // Otherwise, it's a cancel request
  const parseResult = cancelSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json(
      { success: false, error: 'Invalid request body', details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { immediate, reason } = parseResult.data

  // 5. Get active subscription
  const subscription = await SubscriptionService.getActive(teamId)

  if (!subscription || !subscription.externalSubscriptionId) {
    return Response.json(
      { success: false, error: 'No active subscription found' },
      { status: 404 }
    )
  }

  // 6. Cancel via Stripe
  try {
    if (immediate) {
      await cancelSubscriptionImmediately(subscription.externalSubscriptionId)
    } else {
      await cancelSubscriptionAtPeriodEnd(subscription.externalSubscriptionId)
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

    return Response.json({
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
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription'
      },
      { status: 500 }
    )
  }
}

/**
 * Handle reactivation of a subscription that was scheduled to cancel
 */
async function handleReactivation(teamId: string) {
  const subscription = await SubscriptionService.getActive(teamId)

  if (!subscription || !subscription.externalSubscriptionId) {
    return Response.json(
      { success: false, error: 'No active subscription found' },
      { status: 404 }
    )
  }

  if (!subscription.cancelAtPeriodEnd) {
    return Response.json(
      { success: false, error: 'Subscription is not scheduled for cancellation' },
      { status: 400 }
    )
  }

  try {
    await reactivateSubscription(subscription.externalSubscriptionId)

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

    return Response.json({
      success: true,
      data: {
        reactivated: true,
        message: 'Subscription reactivated successfully'
      }
    })
  } catch (error) {
    console.error('[cancel] Error reactivating subscription:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
      },
      { status: 500 }
    )
  }
}
