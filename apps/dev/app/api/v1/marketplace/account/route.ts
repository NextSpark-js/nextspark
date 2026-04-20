/**
 * Marketplace Account Endpoint
 *
 * GET - Retrieve the connected account status for the current team
 * Returns onboarding status, charges/payouts enabled, commission rate, and dashboard link.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { getMarketplaceGateway } from '@nextsparkjs/core/lib/marketplace'
import { queryOne } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request: NextRequest) => {
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

  // 3. Permission check
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('billing.checkout')
  if (!actionResult.allowed) {
    return NextResponse.json(
      { success: false, error: actionResult.message },
      { status: 403 }
    )
  }

  // 4. Get connected account from DB
  const account = await queryOne<{
    id: string
    provider: string
    externalAccountId: string
    email: string
    businessName: string | null
    country: string
    currency: string
    onboardingStatus: string
    chargesEnabled: boolean
    payoutsEnabled: boolean
    commissionRate: number
    fixedFee: number
    payoutSchedule: string
    createdAt: string
  }>(
    `SELECT id, provider, "externalAccountId", email, "businessName",
            country, currency, "onboardingStatus", "chargesEnabled", "payoutsEnabled",
            "commissionRate", "fixedFee", "payoutSchedule", "createdAt"
     FROM "connectedAccounts"
     WHERE "teamId" = $1
     LIMIT 1`,
    [teamId]
  )

  if (!account) {
    return NextResponse.json({
      success: true,
      data: {
        connected: false,
        account: null,
      },
    })
  }

  // 5. Get fresh status from provider (if account is not fully active)
  let dashboardUrl: string | null = null
  let balance: { available: number; pending: number } | null = null

  const gateway = getMarketplaceGateway()

  try {
    if (account.chargesEnabled) {
      // Get dashboard link
      const dashboardLink = await gateway.createDashboardLink(account.externalAccountId)
      dashboardUrl = dashboardLink.url

      // Get balance
      const balanceResult = await gateway.getAccountBalance(account.externalAccountId)
      balance = { available: balanceResult.available, pending: balanceResult.pending }
    }
  } catch (error) {
    console.warn('[marketplace/account] Error fetching provider data:', error)
  }

  return NextResponse.json({
    success: true,
    data: {
      connected: true,
      account: {
        id: account.id,
        provider: account.provider,
        email: account.email,
        businessName: account.businessName,
        country: account.country,
        currency: account.currency,
        onboardingStatus: account.onboardingStatus,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        commissionRate: account.commissionRate,
        fixedFee: account.fixedFee,
        payoutSchedule: account.payoutSchedule,
        createdAt: account.createdAt,
        dashboardUrl,
        balance,
      },
    },
  })
}, 'read')
