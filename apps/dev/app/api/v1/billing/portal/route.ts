/**
 * Stripe Customer Portal Endpoint
 *
 * Creates a Stripe Customer Portal session for self-service billing management.
 * Users can update payment methods, view invoices, and cancel subscriptions.
 *
 * P6: Customer Portal
 */

import { NextRequest } from 'next/server'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createPortalSession } from '@nextsparkjs/core/lib/billing/gateways/stripe'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'

export async function POST(request: NextRequest) {
  // 1. Dual authentication
  const authResult = await authenticateRequest(request)

  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // 2. Get team context
  const teamId =
    request.headers.get('x-team-id') ||
    authResult.user.defaultTeamId

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
  const actionResult = membership.canPerformAction('billing.portal')

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

  // 4. Get subscription with Stripe customer ID
  try {
    const subscription = await SubscriptionService.getActive(teamId)

    if (!subscription?.externalCustomerId) {
      return Response.json(
        {
          success: false,
          error: 'No billing account found. Please upgrade to a paid plan first.'
        },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
    const returnUrl = `${appUrl}/dashboard/settings/billing`

    const session = await createPortalSession({
      customerId: subscription.externalCustomerId,
      returnUrl
    })

    return Response.json({
      success: true,
      data: { url: session.url }
    })
  } catch (error) {
    console.error('[portal] Error creating portal session:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create portal session'
      },
      { status: 500 }
    )
  }
}
