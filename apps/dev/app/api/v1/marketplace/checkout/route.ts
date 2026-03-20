/**
 * Marketplace Checkout Endpoint
 *
 * Creates a checkout session for a marketplace payment (e.g., booking a service).
 * The payment is split between the platform (commission) and the business.
 *
 * POST /api/v1/marketplace/checkout
 * Body: { connectedAccountId, amount, currency, referenceId, referenceType, description, customerEmail? }
 * Returns: { url, paymentId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { getMarketplaceGateway, calculateFee } from '@nextsparkjs/core/lib/marketplace'
import { query, queryOne } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import type { CommissionConfig } from '@nextsparkjs/core/lib/marketplace'

const checkoutSchema = z.object({
  connectedAccountId: z.string().min(1, 'Connected account ID is required'),
  amount: z.number().int().positive('Amount must be positive'),
  currency: z.string().length(3).default('usd'),
  referenceId: z.string().min(1, 'Reference ID is required (e.g., booking ID)'),
  referenceType: z.string().min(1).default('booking'),
  description: z.string().min(1, 'Description is required'),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // 1. Authentication (customer or API key)
  const authResult = await authenticateRequest(request)
  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // 2. Validate body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = checkoutSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { connectedAccountId, amount, currency, referenceId, referenceType, description, customerEmail, metadata } = parseResult.data

  // 3. Get connected account
  const account = await queryOne<{
    id: string
    teamId: string
    externalAccountId: string
    commissionRate: number
    fixedFee: number
    chargesEnabled: boolean
    onboardingStatus: string
    provider: string
  }>(
    `SELECT id, "teamId", "externalAccountId", "commissionRate", "fixedFee",
            "chargesEnabled", "onboardingStatus", provider
     FROM "connectedAccounts"
     WHERE id = $1`,
    [connectedAccountId]
  )

  if (!account) {
    return NextResponse.json(
      { success: false, error: 'Connected account not found' },
      { status: 404 }
    )
  }

  if (!account.chargesEnabled) {
    return NextResponse.json(
      { success: false, error: 'Connected account cannot accept payments yet. Complete onboarding first.' },
      { status: 400 }
    )
  }

  // 4. Calculate commission
  const commissionConfig: CommissionConfig = {
    model: account.fixedFee > 0 ? 'hybrid' : 'percentage',
    rate: account.commissionRate,
    fixedFee: account.fixedFee || undefined,
  }
  const applicationFee = calculateFee(amount, commissionConfig)
  const businessAmount = amount - applicationFee

  // 5. Create checkout session
  const gateway = getMarketplaceGateway()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'

  try {
    const result = await gateway.createMarketplaceCheckout({
      connectedAccountId: account.id,
      externalAccountId: account.externalAccountId,
      amount,
      currency,
      applicationFee,
      referenceId,
      description,
      customerEmail: customerEmail || authResult.user.email || undefined,
      successUrl: `${appUrl}/booking/${referenceId}/success`,
      cancelUrl: `${appUrl}/booking/${referenceId}/cancel`,
      metadata,
    })

    // 6. Record the payment intent in our DB
    await query(
      `INSERT INTO "marketplacePayments" (
        "connectedAccountId", "teamId", "referenceId", "referenceType",
        "externalPaymentId", "totalAmount", "applicationFee", "businessAmount",
        currency, "commissionRate", status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        account.id,
        account.teamId,
        referenceId,
        referenceType,
        result.id,
        amount,
        applicationFee,
        businessAmount,
        currency,
        account.commissionRate,
        'pending',
        JSON.stringify(metadata || {}),
      ]
    )

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        paymentId: result.id,
        amount,
        applicationFee,
        businessAmount,
        currency,
      },
    })
  } catch (error) {
    console.error('[marketplace/checkout] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create checkout' },
      { status: 500 }
    )
  }
}, 'write')
