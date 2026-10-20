/**
 * Billing Management Portal Endpoint
 *
 * Creates a billing portal session for self-service billing management.
 * Users can update payment methods, view invoices, and cancel subscriptions.
 *
 * P6: Customer Portal
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError } from '@nextsparkjs/core/lib/api/error-response'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { resolveAppUrl } from '@nextsparkjs/core/lib/utils/base-url'

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Dual authentication; the API-key scope is declared at the entry
  // point, which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'billing:write' })

  if (!authResult.success || !authResult.user) {
    return createAuthFailureResponse(authResult)
  }

  // 2. Get team context
  const teamId =
    request.headers.get('x-team-id') ||
    authResult.user.defaultTeamId

  if (!teamId) {
    return createApiError('No team context available. Please provide x-team-id header.', 400, undefined, 'VALIDATION_ERROR')
  }

  // 3. Permission check using MembershipService
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('team.billing.manage')

  if (!actionResult.allowed) {
    return createApiError(actionResult.message, 403, undefined, 'ACTION_NOT_ALLOWED', { reason: actionResult.reason, meta: actionResult.meta })
  }

  // 4. Get subscription with payment provider customer ID
  try {
    const subscription = await SubscriptionService.getActive(teamId)

    if (!subscription?.externalCustomerId) {
      return createApiError('No billing account found. Please upgrade to a paid plan first.', 400, undefined, 'VALIDATION_ERROR')
    }

    const appUrl = resolveAppUrl()
    const returnUrl = `${appUrl}/dashboard/settings/billing`

    const gateway = await getBillingGateway()
    const session = await gateway.createPortalSession({
      customerId: subscription.externalCustomerId,
      returnUrl
    })

    return NextResponse.json({
      success: true,
      data: { url: session.url }
    })
  } catch (error) {
    console.error('[portal] Error creating portal session:', error)
    return createApiError('Failed to create portal session', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

export const OPTIONS = corsPreflight
