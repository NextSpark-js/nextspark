/**
 * Check Action Endpoint
 *
 * Verifies if a user can perform a specific action by checking:
 * 1. RBAC permissions (role-based access control)
 * 2. Plan features (subscription-based access)
 * 3. Quota limits (usage-based access)
 *
 * FIX1: This endpoint was missing, causing useMembership.canDo() to fail
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { SubscriptionService } from '@nextsparkjs/core/lib/services'
import { z } from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

const checkActionSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  teamId: z.string().uuid().optional()
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Dual authentication (API Key OR Session); the API-key scope is
  // declared at the entry point, which fails closed for keys that lack it
  // (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'billing:read' })

  if (!authResult.success || !authResult.user) {
    return createAuthFailureResponse(authResult)
  }

  // 2. Parse and validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parseResult = checkActionSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: parseResult.error.issues
      },
      { status: 400 }
    )
  }

  const { action, teamId: bodyTeamId } = parseResult.data

  // 3. Get team context (from body, header, or user's default)
  const teamId =
    bodyTeamId ||
    request.headers.get('x-team-id') ||
    authResult.user.defaultTeamId

  if (!teamId) {
    return NextResponse.json(
      {
        success: false,
        error: 'No team context available. Please provide teamId in body or x-team-id header.'
      },
      { status: 400 }
    )
  }

  // 4. Check action using SubscriptionService (RBAC + features + quotas)
  const result = await SubscriptionService.canPerformAction(
    authResult.user.id,
    teamId,
    action
  )

  return NextResponse.json({
    success: true,
    data: result
  })
}, 'read');
