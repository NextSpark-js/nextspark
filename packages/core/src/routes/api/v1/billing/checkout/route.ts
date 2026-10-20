/**
 * Payment Checkout Endpoint
 *
 * Creates a checkout session for subscription upgrade.
 * Redirects user to the payment provider's hosted checkout page.
 *
 * Security: Requires team owner/admin permission (team.billing.manage)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'
import * as z from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { resolveAppUrl } from '@nextsparkjs/core/lib/utils/base-url'

const checkoutSchema = z.object({
  planSlug: z.string().min(1, 'Plan slug is required'),
  billingPeriod: z.enum(['monthly', 'yearly']).default('monthly')
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Dual authentication; the API-key scope is declared at the entry
  // point, which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'billing:write' })

  if (!authResult.success || !authResult.user) {
    return createAuthFailureResponse(authResult)
  }

  // 2. Parse and validate request body
  const parsedBody = await readJsonObject(request)
  if (parsedBody.error) return parsedBody.error
  const body = parsedBody.data

  const parseResult = checkoutSchema.safeParse(body)
  if (!parseResult.success) {
    return createApiError('Validation failed', 400, parseResult.error.issues, 'VALIDATION_ERROR')
  }

  const { planSlug, billingPeriod } = parseResult.data

  // 3. Get team context
  const teamId =
    request.headers.get('x-team-id') ||
    authResult.user.defaultTeamId

  if (!teamId) {
    return createApiError('No team context available. Please provide x-team-id header.', 400, undefined, 'VALIDATION_ERROR')
  }

  // 4. Permission check using MembershipService
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('team.billing.manage')

  if (!actionResult.allowed) {
    return createApiError(actionResult.message, 403, undefined, 'ACTION_NOT_ALLOWED', { reason: actionResult.reason, meta: actionResult.meta })
  }

  // 5. Check existing subscription
  try {
    const subscription = await SubscriptionService.getActive(teamId, authResult.user.id)

    // If already subscribed with an active provider subscription,
    // use changePlan (immediate proration) instead of creating a new checkout.
    // This prevents double-billing by updating the existing subscription in Stripe.
    if (subscription?.externalSubscriptionId) {
      const result = await SubscriptionService.changePlan(
        teamId,
        planSlug,
        billingPeriod,
        authResult.user.id
      )

      if (!result.success) {
        return createApiError(result.error ?? 'Request refused', 400, undefined, 'VALIDATION_ERROR')
      }

      // No redirect needed — plan changed immediately via API
      return NextResponse.json({
        success: true,
        data: {
          changed: true,
          subscription: result.subscription,
          warnings: result.downgradeWarnings,
        }
      })
    }

    // No existing provider subscription — create a new checkout session
    const appUrl = resolveAppUrl()
    const successUrl = `${appUrl}/dashboard/settings/billing?success=true`
    const cancelUrl = `${appUrl}/dashboard/settings/billing?canceled=true`

    const gateway = await getBillingGateway()
    const session = await gateway.createCheckoutSession({
      teamId,
      planSlug,
      billingPeriod,
      successUrl,
      cancelUrl,
      customerEmail: authResult.user.email,
      customerId: subscription?.externalCustomerId || undefined
    })

    return NextResponse.json({
      success: true,
      data: {
        url: session.url,
        sessionId: session.id
      }
    })
  } catch (error) {
    console.error('[checkout] Error:', error)
    return createApiError('Failed to process checkout', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

export const OPTIONS = corsPreflight
