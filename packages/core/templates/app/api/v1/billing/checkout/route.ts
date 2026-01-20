/**
 * Stripe Checkout Endpoint
 *
 * Creates a Stripe Checkout session for subscription upgrade.
 * Redirects user to Stripe-hosted checkout page.
 *
 * Security: Requires team owner/admin permission (team.billing.manage)
 *
 * P2: Stripe Integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createCheckoutSession } from '@nextsparkjs/core/lib/billing/gateways/stripe'
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
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
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
  const actionResult = membership.canPerformAction('billing.checkout')

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

  // 5. Check existing subscription for customer ID
  try {
    const subscription = await SubscriptionService.getActive(teamId)

    // Build URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
    const successUrl = `${appUrl}/dashboard/settings/billing?success=true`
    const cancelUrl = `${appUrl}/dashboard/settings/billing?canceled=true`

    // Create Stripe Checkout session
    const session = await createCheckoutSession({
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
    console.error('[checkout] Error creating checkout session:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      },
      { status: 500 }
    )
  }
}, 'write');
