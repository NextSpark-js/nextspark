/**
 * Payment Checkout Endpoint
 *
 * Creates a checkout session for subscription upgrade.
 * Redirects user to the payment provider's hosted checkout page.
 *
 * Security: Requires team owner/admin permission (team.billing.manage)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
import { SubscriptionService, MembershipService } from '@nextsparkjs/core/lib/services'
import { z } from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

const checkoutSchema = z.object({
  planSlug: z.string().min(1, 'Plan slug is required'),
  billingPeriod: z.enum(['monthly', 'yearly']).default('monthly')
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Dual authentication
  const authResult = await authenticateRequest(request)

  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
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

  const parseResult = checkoutSchema.safeParse(body)
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

  const { planSlug, billingPeriod } = parseResult.data

  // 3. Get team context
  const teamId =
    request.headers.get('x-team-id') ||
    authResult.user.defaultTeamId

  if (!teamId) {
    return NextResponse.json(
      {
        success: false,
        error: 'No team context available. Please provide x-team-id header.'
      },
      { status: 400 }
    )
  }

  // 4. Permission check using MembershipService
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('team.billing.manage')

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
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process checkout'
      },
      { status: 500 }
    )
  }
}, 'write');
