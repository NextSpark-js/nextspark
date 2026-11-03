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
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { SubscriptionService } from '@nextsparkjs/core/lib/services'
import * as z from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'

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
  const parsedBody = await readJsonObject(request)
  if (parsedBody.error) return parsedBody.error
  const body = parsedBody.data

  const parseResult = checkActionSchema.safeParse(body)
  if (!parseResult.success) {
    return createApiError('Validation failed', 400, parseResult.error.issues, 'VALIDATION_ERROR')
  }

  const { action, teamId: bodyTeamId } = parseResult.data

  // An action that no mapping names has nothing to check: answering allowed would let a typo in the action (or a
  // mapping that was never written) pass as a permission. It is refused, and the reason says why (#367).
  const { permissions, features, limits } = BILLING_REGISTRY.actionMappings
  // Own keys only: `constructor` or `toString` are not mapped actions
  const mapped = [permissions, features, limits].some(map => Object.hasOwn(map ?? {}, action))
  if (!mapped) {
    return NextResponse.json({
      success: true,
      data: {
        allowed: false,
        reason: 'unknown_action',
        message: `Action "${action}" is not listed in actionMappings (permissions, features or limits)`
      }
    })
  }

  // 3. Get team context (from body, header, or user's default)
  const teamId =
    bodyTeamId ||
    request.headers.get('x-team-id') ||
    authResult.user.defaultTeamId

  if (!teamId) {
    return createApiError('No team context available. Please provide teamId in body or x-team-id header.', 400, undefined, 'VALIDATION_ERROR')
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

export const OPTIONS = corsPreflight
