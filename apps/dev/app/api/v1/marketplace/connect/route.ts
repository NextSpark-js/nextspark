/**
 * Marketplace Connect Endpoint
 *
 * Creates a connected account and returns an onboarding link.
 * The business owner is redirected to Stripe (Account Links) or MercadoPago (OAuth)
 * to complete their onboarding.
 *
 * POST /api/v1/marketplace/connect
 * Body: { country, businessName?, businessType? }
 * Returns: { onboardingUrl, accountId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { getMarketplaceGateway } from '@nextsparkjs/core/lib/marketplace'
import { query, queryOne } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

const connectSchema = z.object({
  country: z.string().length(2, 'Country must be ISO 3166-1 alpha-2 (e.g., US, AR, BR)'),
  businessName: z.string().min(1).max(200).optional(),
  businessType: z.enum(['individual', 'company']).default('individual'),
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Authentication
  const authResult = await authenticateRequest(request)
  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // 2. Team context
  const teamId = request.headers.get('x-team-id') || authResult.user.defaultTeamId
  if (!teamId) {
    return NextResponse.json(
      { success: false, error: 'No team context. Provide x-team-id header.' },
      { status: 400 }
    )
  }

  // 3. Permission check (team owner/admin)
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('billing.checkout')
  if (!actionResult.allowed) {
    return NextResponse.json(
      { success: false, error: actionResult.message, reason: actionResult.reason },
      { status: 403 }
    )
  }

  // 4. Validate body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = connectSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { country, businessName, businessType } = parseResult.data

  // 5. Check if team already has a connected account
  const existing = await queryOne<{ id: string; onboardingStatus: string; externalAccountId: string }>(
    `SELECT id, "onboardingStatus", "externalAccountId" FROM "connectedAccounts" WHERE "teamId" = $1 LIMIT 1`,
    [teamId]
  )

  const gateway = getMarketplaceGateway()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'

  // If account exists but onboarding is incomplete, generate a new link
  if (existing && existing.onboardingStatus !== 'active') {
    try {
      const link = await gateway.createOnboardingLink({
        externalAccountId: existing.externalAccountId,
        refreshUrl: `${appUrl}/dashboard/settings/marketplace?refresh=true`,
        returnUrl: `${appUrl}/dashboard/settings/marketplace?onboarding=complete`,
      })

      return NextResponse.json({
        success: true,
        data: {
          onboardingUrl: link.url,
          accountId: existing.id,
          status: existing.onboardingStatus,
          isResuming: true,
        },
      })
    } catch (error) {
      console.error('[marketplace/connect] Error creating onboarding link:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create onboarding link' },
        { status: 500 }
      )
    }
  }

  if (existing && existing.onboardingStatus === 'active') {
    return NextResponse.json(
      { success: false, error: 'Team already has an active connected account' },
      { status: 409 }
    )
  }

  // 6. Create connected account
  try {
    const account = await gateway.createConnectedAccount({
      teamId,
      email: authResult.user.email || '',
      businessName,
      country,
      businessType,
    })

    // Determine currency from country
    const currencyMap: Record<string, string> = {
      US: 'usd', GB: 'gbp', AR: 'ars', BR: 'brl', MX: 'mxn', CO: 'cop',
    }
    const currency = currencyMap[country.toUpperCase()] || 'usd'

    // 7. Save to database
    const result = await queryOne<{ id: string }>(
      `INSERT INTO "connectedAccounts" (
        "teamId", provider, "externalAccountId", email, "businessName",
        country, currency, "onboardingStatus", "chargesEnabled", "payoutsEnabled",
        "commissionRate"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        teamId,
        gateway.provider,
        account.id,
        account.email,
        businessName || null,
        country,
        currency,
        account.onboardingStatus,
        account.chargesEnabled,
        account.payoutsEnabled,
        0.15, // Default 15% commission
      ]
    )

    // 8. Generate onboarding link
    const link = await gateway.createOnboardingLink({
      externalAccountId: account.id,
      refreshUrl: `${appUrl}/dashboard/settings/marketplace?refresh=true`,
      returnUrl: `${appUrl}/dashboard/settings/marketplace?onboarding=complete`,
    })

    return NextResponse.json({
      success: true,
      data: {
        onboardingUrl: link.url,
        accountId: result?.id,
        externalAccountId: account.id,
        status: account.onboardingStatus,
      },
    })
  } catch (error) {
    console.error('[marketplace/connect] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create connected account' },
      { status: 500 }
    )
  }
}, 'write')
