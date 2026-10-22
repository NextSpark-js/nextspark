/**
 * Change Plan Endpoint
 *
 * Allows users to upgrade or downgrade their subscription plan.
 * Handles proration via the payment provider automatically.
 *
 * P1-3: Plan Change con Proration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import * as z from 'zod'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { billingDisabledResponse } from '@nextsparkjs/core/lib/billing/disabled-response'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'

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
  // 1. Dual authentication; the API-key scope is declared at the entry
  // point, which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'billing:write' })

  if (!authResult.success || !authResult.user) {
    return createAuthFailureResponse(authResult)
  }

  // No payment gateway configured (provider: 'none'): a clear 501, not a 500
  const billingDisabled = billingDisabledResponse()
  if (billingDisabled) return billingDisabled

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

  const parseResult = changePlanSchema.safeParse(body)
  if (!parseResult.success) {
    return createApiError('Invalid request body', 400, parseResult.error.issues, 'VALIDATION_ERROR')
  }

  const { planSlug, billingInterval } = parseResult.data

  // 5. Execute plan change
  const result = await SubscriptionService.changePlan(teamId, planSlug, billingInterval, authResult.user.id)

  if (!result.success) {
    return createApiError(result.error ?? 'Request refused', 400, undefined, 'VALIDATION_ERROR')
  }

  return NextResponse.json({
    success: true,
    data: {
      subscription: result.subscription,
      warnings: result.downgradeWarnings,
    },
  })
}, 'strict');

export const OPTIONS = corsPreflight
