/**
 * MercadoPago OAuth Callback
 *
 * Handles the OAuth callback from MercadoPago when a seller authorizes the platform.
 * Exchanges the authorization code for access/refresh tokens and saves the connected account.
 *
 * GET /api/v1/marketplace/oauth/callback?code=xxx&state=<oauthStateToken>
 *
 * Security: The `state` parameter is a cryptographic token (UUID) that was generated
 * by the /connect endpoint and stored in the connectedAccounts metadata. This prevents
 * OAuth CSRF attacks where an attacker could link their MP account to a victim's team.
 *
 * This is only used for MercadoPago. Stripe Connect uses Account Links (no OAuth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { exchangeMPAuthorizationCode } from '@nextsparkjs/core/lib/marketplace'
import { encryptTokens } from '@nextsparkjs/core/lib/marketplace/token-encryption'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { query, queryOne } from '@nextsparkjs/core/lib/db'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') // Cryptographic state token (NOT teamId)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'

  if (!code) {
    console.error('[marketplace/oauth] No authorization code received')
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=no_code`)
  }

  if (!state) {
    console.error('[marketplace/oauth] No state parameter received')
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=no_state`)
  }

  // 1. Authentication check - user must be logged in
  const authResult = await authenticateRequest(request)
  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized - OAuth callback requires authentication', 401)
  }

  // 2. Look up the connected account by oauthState token (cryptographic lookup, not teamId)
  const account = await queryOne<{ id: string; teamId: string }>(
    `SELECT id, "teamId" FROM "connectedAccounts"
     WHERE metadata->>'oauthState' = $1
     LIMIT 1`,
    [state]
  )

  if (!account) {
    console.error('[marketplace/oauth] Invalid or expired state token')
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=invalid_state`)
  }

  // 3. Verify the authenticated user is a member of the team that owns this account
  try {
    const membership = await MembershipService.get(authResult.user.id, account.teamId)
    const actionResult = membership.canPerformAction('billing.checkout')
    if (!actionResult.allowed) {
      console.error(`[marketplace/oauth] User ${authResult.user.id} is not authorized for team ${account.teamId}`)
      return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=unauthorized`)
    }
  } catch {
    console.error(`[marketplace/oauth] User ${authResult.user.id} is not a member of team ${account.teamId}`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=unauthorized`)
  }

  try {
    // 4. Exchange code for tokens
    const redirectUri = `${appUrl}/api/v1/marketplace/oauth/callback`
    const tokens = await exchangeMPAuthorizationCode(code, redirectUri)

    // 5. Encrypt tokens before storing
    const encryptedMPTokens = encryptTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      publicKey: tokens.publicKey,
    })

    // 6. Update the account with MP data and clear the oauthState (one-time use / replay protection)
    await query(
      `UPDATE "connectedAccounts"
       SET "externalAccountId" = $1,
           "onboardingStatus" = 'active',
           "chargesEnabled" = true,
           "payoutsEnabled" = true,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb) - 'oauthState',
             '{mpTokens}',
             $2::jsonb
           ),
           "updatedAt" = NOW()
       WHERE id = $3`,
      [
        String(tokens.userId),
        JSON.stringify(encryptedMPTokens),
        account.id,
      ]
    )

    console.log(`[marketplace/oauth] Successfully connected MP user ${tokens.userId} for team ${account.teamId}`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?onboarding=complete`)
  } catch (error) {
    console.error('[marketplace/oauth] Error exchanging code:', error)
    return NextResponse.redirect(`${appUrl}/dashboard/settings/marketplace?error=oauth_failed`)
  }
}
