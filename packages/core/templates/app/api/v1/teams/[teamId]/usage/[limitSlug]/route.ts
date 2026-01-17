/**
 * Team Usage API
 *
 * GET /api/v1/teams/[teamId]/usage/[limitSlug] - Get quota info
 * POST /api/v1/teams/[teamId]/usage/[limitSlug] - Track usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAndAuthenticateRequest, createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { SubscriptionService, UsageService, MembershipService } from '@nextsparkjs/core/lib/services'
import { trackUsageSchema } from '@nextsparkjs/core/lib/billing/schema'

interface RouteParams {
  params: Promise<{ teamId: string; limitSlug: string }>
}

export const GET = withRateLimitTier('read', async function GET(request: NextRequest, props: RouteParams) {
  // Authenticate request
  const { auth, rateLimitResponse } = await validateAndAuthenticateRequest(request)
  if (rateLimitResponse) return rateLimitResponse

  const { teamId, limitSlug } = await props.params

  try {
    // Check if user has permission to view usage using MembershipService
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

    const quota = await SubscriptionService.checkQuota(teamId, limitSlug)
    return createApiResponse(quota)
  } catch (error) {
    console.error('[Billing API] Error checking quota:', error)
    return createApiError('Failed to check quota', 500)
  }
})

export const POST = withRateLimitTier('write', async function POST(request: NextRequest, props: RouteParams) {
  // Authenticate request
  const { auth, rateLimitResponse } = await validateAndAuthenticateRequest(request)
  if (rateLimitResponse) return rateLimitResponse

  const { teamId, limitSlug } = await props.params

  try {
    // Check if user has permission to track usage using MembershipService
    const membership = await MembershipService.get(auth.userId, teamId)
    const actionResult = membership.canPerformAction('billing.manage')

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

    const body = await request.json()
    const data = trackUsageSchema.parse({
      ...body,
      limitSlug,
    })

    const result = await UsageService.track({
      ...data,
      teamId,
      userId: auth.userId,
    })

    return createApiResponse(result, { created: true }, 201)
  } catch (error: unknown) {
    console.error('[Billing API] Error tracking usage:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to track usage'
    return createApiError(errorMessage, 500)
  }
})
