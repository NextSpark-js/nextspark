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

import { NextRequest } from 'next/server'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { z } from 'zod'

const checkActionSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  teamId: z.string().uuid().optional()
})

export async function POST(request: NextRequest) {
  // 1. Dual authentication (API Key OR Session)
  const authResult = await authenticateRequest(request)

  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // 2. Parse and validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parseResult = checkActionSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json(
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
    return Response.json(
      {
        success: false,
        error: 'No team context available. Please provide teamId in body or x-team-id header.'
      },
      { status: 400 }
    )
  }

  // 4. Check action permission using MembershipService
  // Note: MembershipService.get() does NOT throw for non-members
  // It returns TeamMembership with role: null
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const result = membership.canPerformAction(action)

  return Response.json({
    success: true,
    data: result
  })
}
