/**
 * MercadoPago OAuth Callback
 *
 * Handles the OAuth callback from MercadoPago when a seller authorizes the platform.
 * Exchanges the authorization code for access/refresh tokens and saves the connected account.
 *
 * GET /api/v1/marketplace/oauth/callback?code=xxx&state=teamId
 *
 * This is only used for MercadoPago. Stripe Connect uses Account Links (no OAuth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { exchangeMPAuthorizationCode } from '@nextsparkjs/core/lib/marketplace'
import { query, queryOne } from '@nextsparkjs/core/lib/db'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') // Contains teamId or account reference

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'

  if (!code) {
    console.error('[marketplace/oauth] No authorization code received')
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=no_code`)
  }

  if (!state) {
    console.error('[marketplace/oauth] No state parameter received')
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=no_state`)
  }

  try {
    // 1. Exchange code for tokens
    const redirectUri = `${appUrl}/api/v1/marketplace/oauth/callback`
    const tokens = await exchangeMPAuthorizationCode(code, redirectUri)

    // 2. Check if this MP user is already connected
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM "connectedAccounts" WHERE "externalAccountId" = $1`,
      [String(tokens.userId)]
    )

    if (existing) {
      // Update existing account with new tokens
      await query(
        `UPDATE "connectedAccounts"
         SET "onboardingStatus" = 'active',
             "chargesEnabled" = true,
             "payoutsEnabled" = true,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{mpTokens}',
               $1::jsonb
             ),
             "updatedAt" = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
            publicKey: tokens.publicKey,
          }),
          existing.id,
        ]
      )

      return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?onboarding=complete&reconnected=true`)
    }

    // 3. Check if we have a pending account for this state (teamId)
    const pendingAccount = await queryOne<{ id: string; teamId: string }>(
      `SELECT id, "teamId" FROM "connectedAccounts"
       WHERE "teamId" = $1 AND "onboardingStatus" = 'pending'
       LIMIT 1`,
      [state]
    )

    if (pendingAccount) {
      // Update pending account with MP data
      await query(
        `UPDATE "connectedAccounts"
         SET "externalAccountId" = $1,
             "onboardingStatus" = 'active',
             "chargesEnabled" = true,
             "payoutsEnabled" = true,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{mpTokens}',
               $2::jsonb
             ),
             "updatedAt" = NOW()
         WHERE id = $3`,
        [
          String(tokens.userId),
          JSON.stringify({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
            publicKey: tokens.publicKey,
          }),
          pendingAccount.id,
        ]
      )
    } else {
      // Create new connected account (OAuth-first flow)
      await query(
        `INSERT INTO "connectedAccounts" (
          "teamId", provider, "externalAccountId", email,
          country, currency, "onboardingStatus", "chargesEnabled", "payoutsEnabled",
          "commissionRate", metadata
        ) VALUES ($1, 'mercadopago_split', $2, '', 'AR', 'ars', 'active', true, true, 0.15, $3)`,
        [
          state,
          String(tokens.userId),
          JSON.stringify({
            mpTokens: {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
              publicKey: tokens.publicKey,
            },
          }),
        ]
      )
    }

    console.log(`[marketplace/oauth] Successfully connected MP user ${tokens.userId} for team ${state}`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?onboarding=complete`)
  } catch (error) {
    console.error('[marketplace/oauth] Error exchanging code:', error)
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=oauth_failed`)
  }
}
