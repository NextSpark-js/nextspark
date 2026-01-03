/**
 * Team Subscription API
 *
 * GET /api/v1/teams/[teamId]/subscription - Get team's active subscription
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAndAuthenticateRequest, createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'

interface RouteParams {
  params: Promise<{ teamId: string }>
}

export async function GET(request: NextRequest, props: RouteParams) {
  // Authenticate request
  const { auth, rateLimitResponse } = await validateAndAuthenticateRequest(request)
  if (rateLimitResponse) return rateLimitResponse

  const { teamId } = await props.params

  try {
    // Check if user has permission to view subscription using MembershipService
    const membership = await MembershipService.get(auth.userId, teamId)
    const actionResult = membership.canPerformAction('billing.view')

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

    const subscription = await SubscriptionService.getActive(teamId)

    if (!subscription) {
      return createApiError('No active subscription found for this team', 404)
    }

    return createApiResponse({ subscription })
  } catch (error) {
    console.error('[Billing API] Error fetching subscription:', error)
    return createApiError('Failed to fetch subscription', 500)
  }
}
