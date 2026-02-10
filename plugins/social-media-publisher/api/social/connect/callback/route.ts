/**
 * OAuth Callback Handler for Social Media Publishing
 *
 * GET endpoint that receives the OAuth redirect from Facebook
 * Accessible via: /api/v1/plugin/social-media-publisher/social/connect/callback
 *
 * Query params:
 * - code: Authorization code from Facebook
 * - state: CSRF protection token with entityId embedded (format: {randomState}&platform={platform}&entityId={entityId})
 * - error: (optional) Error if user denied permission
 * - error_description: (optional) Error description
 *
 * Architecture (User-Level Tokens):
 * 1. OAuth tokens are stored in `social_accounts` table (USER level - plugin-owned)
 * 2. Entity assignments handled via adapter (ENTITY level - theme-owned)
 * 3. This allows token reuse across multiple entities without re-authentication
 *
 * Flow:
 * - User authenticates with Meta → Token saved to social_accounts (upsert by platformAccountId)
 * - User assigns accounts to entities → Adapter handles assignment
 * - Token refresh benefits all linked entities automatically
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { TokenEncryption } from '@nextsparkjs/core/lib/oauth/encryption'
import { FacebookAPI } from '../../../../lib/providers/facebook'
import {
  exchangeCodeForToken,
  getOAuthConfig
} from '../../../../lib/oauth-helper'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'
import { getAdapter, ensureAdapter } from '../../../../lib/adapter'

// Type for social account data
interface SocialAccountData {
  platform: string
  platformAccountId: string
  username: string
  accessToken: string
  permissions: string[]
  metadata: Record<string, unknown>
}

const getHandler = async (request: NextRequest) => {
  try {
    // 1. Parse state to extract entityId, platform, and mode
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state') || ''

    // State format: "{randomState}&platform={platform}&entityId={entityId}&mode={mode}"
    // Also supports legacy "clientId" for backward compatibility
    const stateParams = new URLSearchParams(state)
    const entityId = stateParams.get('entityId') || stateParams.get('clientId')
    const platform = stateParams.get('platform') || 'instagram_business'
    const mode = stateParams.get('mode') // 'preview' = return data without saving

    console.log('[oauth-callback] Received OAuth callback:', {
      platform,
      entityId,
      mode: mode || 'save (default)',
      hasCode: !!searchParams.get('code')
    })

    // 2. Check for OAuth errors (user denied, etc.)
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      console.error('[oauth-callback] OAuth error:', error, errorDescription)
      return renderOAuthError(error, errorDescription)
    }

    // 3. Validate required parameters
    if (!entityId) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=missing_entity&message=Entity ID not provided in OAuth flow`,
          request.url
        )
      )
    }

    const code = searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=missing_code&message=Authorization code not provided`,
          request.url
        )
      )
    }

    // 4. Authentication (user must be logged in)
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.redirect(
        new URL(
          `/auth/login?error=authentication_required&redirect=/dashboard`,
          request.url
        )
      )
    }

    const userId = authResult.user!.id

    // 5. Verify user has access to the entity via adapter
    const hasAdapterReady = await ensureAdapter()
    if (!hasAdapterReady) {
      return renderOAuthError(
        'no_adapter',
        'Social media publisher plugin not configured. Theme must register an adapter.'
      )
    }

    const adapter = await getAdapter()
    const accessResult = await adapter.checkEntityAccess(userId, entityId)

    if (!accessResult.hasAccess) {
      return renderOAuthError('unauthorized', accessResult.reason || 'You do not have access to this entity')
    }

    console.log('[oauth-callback] Entity access verified:', {
      entityId,
      entitySlug: adapter.getEntitySlug(),
      teamId: accessResult.teamId
    })

    // 6. Exchange authorization code for access token
    const oauthConfig = getOAuthConfig()
    const tokenData = await exchangeCodeForToken(
      code,
      oauthConfig,
      platform as 'facebook_page' | 'instagram_business'
    )

    const userAccessToken = tokenData.accessToken
    const expiresIn = tokenData.expiresIn

    // 7. Get accounts based on platform
    const accountsToConnect: SocialAccountData[] = []

    if (platform === 'facebook_page') {
      const pages = await FacebookAPI.getUserPages(userAccessToken)

      for (const page of pages) {
        accountsToConnect.push({
          platform: 'facebook_page',
          platformAccountId: page.id,
          username: page.name,
          accessToken: page.accessToken,
          permissions: page.tasks || [],
          metadata: {
            category: page.category,
            pictureUrl: page.pictureUrl,
          },
        })
      }
    } else if (platform === 'instagram_business') {
      const pages = await FacebookAPI.getUserPages(userAccessToken)

      for (const page of pages) {
        try {
          const igAccount = await FacebookAPI.getInstagramBusinessAccount(
            page.id,
            page.accessToken
          )

          if (igAccount) {
            accountsToConnect.push({
              platform: 'instagram_business',
              platformAccountId: igAccount.id,
              username: igAccount.username,
              accessToken: page.accessToken,
              permissions: [
                'instagram_basic',
                'instagram_content_publish',
                'instagram_manage_comments',
                'pages_show_list',
                'pages_manage_posts',
                'pages_read_engagement',
              ],
              metadata: {
                username: igAccount.username,
                name: igAccount.name,
                profilePictureUrl: igAccount.profilePictureUrl,
                followersCount: igAccount.followersCount,
                followsCount: igAccount.followsCount,
                mediaCount: igAccount.mediaCount,
                biography: igAccount.biography,
                website: igAccount.website,
                lastSyncedAt: new Date().toISOString(),
                facebookPageId: page.id,
                facebookPageName: page.name,
              },
            })
            console.log(`[oauth-callback] Found Instagram @${igAccount.username}`)
          }
        } catch {
          console.log(`[oauth-callback] No Instagram for Page "${page.name}"`)
        }
      }

      if (accountsToConnect.length === 0 && mode !== 'preview') {
        return renderOAuthError(
          'no_instagram_accounts',
          'No Instagram Business Accounts found linked to your Facebook Pages'
        )
      }
    }

    // 8. ALWAYS save tokens to social_accounts (user level)
    // This implements "Connect Once, Link Anywhere" - tokens are ALWAYS preserved
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)
    const savedAccounts: Array<{ id: string; platform: string; username: string; socialAccountId?: string }> = []

    for (const account of accountsToConnect) {
      // Encrypt access token
      const encryptedToken = await TokenEncryption.encrypt(account.accessToken)
      const tokenString = `${encryptedToken.encrypted}:${encryptedToken.iv}:${encryptedToken.keyId}`

      // STEP 1: Upsert to social_accounts (USER level - plugin-owned table)
      const socialAccountResult = await mutateWithRLS<{ id: string }>(
        `INSERT INTO "social_accounts"
          ("userId", platform, "platformAccountId", "username", "accessToken",
           "tokenExpiresAt", permissions, "accountMetadata", "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT ("platformAccountId")
         DO UPDATE SET
           "accessToken" = EXCLUDED."accessToken",
           "tokenExpiresAt" = EXCLUDED."tokenExpiresAt",
           permissions = EXCLUDED.permissions,
           "accountMetadata" = EXCLUDED."accountMetadata",
           "isActive" = true,
           "updatedAt" = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          userId,
          account.platform,
          account.platformAccountId,
          account.username,
          tokenString,
          tokenExpiresAt.toISOString(),
          JSON.stringify(account.permissions),
          JSON.stringify(account.metadata),
        ],
        userId
      )

      const socialAccountId = socialAccountResult.rows[0]?.id
      if (!socialAccountId) {
        console.error('[oauth-callback] Failed to save social_account for', account.username)
        continue
      }

      console.log(`[oauth-callback] ✅ Saved to social_accounts: ${account.username} (${socialAccountId})`)

      // STEP 2: Link via adapter (ENTITY level - theme-owned)
      // Only link immediately if NOT in preview mode
      if (mode !== 'preview') {
        try {
          const assignmentResult = await adapter.saveAssignment({
            entityId,
            platform: account.platform,
            platformAccountId: account.platformAccountId,
            username: account.username,
            accessToken: account.accessToken,
            tokenExpiresAt,
            permissions: account.permissions,
            accountMetadata: account.metadata,
            socialAccountId
          }, userId)

          savedAccounts.push({
            id: assignmentResult.id,
            platform: account.platform,
            username: account.username,
            socialAccountId
          })
          console.log(`[oauth-callback] ✅ Linked to entity: ${account.username} (${assignmentResult.isNew ? 'new' : 'updated'})`)
        } catch (err) {
          console.error(`[oauth-callback] Failed to link ${account.username} to entity:`, err)
        }
      } else {
        // Preview mode: just track the saved account (not linked yet)
        savedAccounts.push({
          id: socialAccountId,
          platform: account.platform,
          username: account.username,
          socialAccountId
        })
      }

      // Create audit log (plugin-owned)
      await mutateWithRLS(
        `INSERT INTO "audit_logs"
          ("userId", "accountId", action, details, "ipAddress", "userAgent")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          socialAccountId,
          'account_connected',
          JSON.stringify({
            entityId,
            entitySlug: adapter.getEntitySlug(),
            platform: account.platform,
            accountName: account.username,
            success: true,
            connectedAt: new Date().toISOString()
          }),
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          request.headers.get('user-agent') || null
        ],
        userId
      )
    }

    // 10. Return appropriate response based on mode
    if (mode === 'preview') {
      // Preview mode: tokens saved, return accounts for frontend selection
      // Frontend will use /social/assign to link selected accounts to entity
      const previewData = accountsToConnect.map((account, index) => ({
        platform: account.platform,
        platformAccountId: account.platformAccountId,
        username: account.username,
        accessToken: account.accessToken, // Needed for frontend to pass to assign API
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        permissions: account.permissions,
        accountMetadata: account.metadata,
        socialAccountId: savedAccounts[index]?.socialAccountId, // Include the saved ID
      }))

      console.log(`[oauth-callback] Preview mode: ${previewData.length} accounts saved, returning for selection`)
      return renderOAuthPreviewWithSavedAccounts(platform, previewData)
    }

    // Save mode: tokens saved AND linked to entity
    return renderOAuthSuccess(platform, savedAccounts.length)

  } catch (error: unknown) {
    console.error('❌ OAuth callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return renderOAuthError('callback_exception', errorMessage)
  }
}

// Helper: Render OAuth error page
function renderOAuthError(errorType: string, userMessage: string | null): NextResponse {
  const message = userMessage || 'Authentication failed'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
          }
          .container { text-align: center; padding: 2rem; max-width: 500px; }
          .error-icon { font-size: 4rem; margin-bottom: 1rem; }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { opacity: 0.9; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Connection Failed</h1>
          <p>${message.replace(/'/g, "\\'")}. This window will close automatically...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-error',
              error: '${errorType}',
              errorDescription: '${message.replace(/'/g, "\\'")}'
            }, window.location.origin);
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
    </html>
  `

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

// Helper: Render OAuth preview page (DEPRECATED - use renderOAuthPreviewWithSavedAccounts)
function renderOAuthPreview(platform: string, accounts: unknown[]): NextResponse {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Preview</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container { text-align: center; padding: 2rem; }
          .loading-icon { font-size: 4rem; margin-bottom: 1rem; animation: spin 2s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="loading-icon">🔄</div>
          <h1>Loading Accounts...</h1>
          <p>Found ${accounts.length} ${platform} account(s)</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-preview',
              platform: '${platform}',
              accounts: ${JSON.stringify(accounts)}
            }, window.location.origin);
            setTimeout(() => window.close(), 1000);
          }
        </script>
      </body>
    </html>
  `

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

// Helper: Render OAuth preview with SAVED accounts (tokens already persisted)
function renderOAuthPreviewWithSavedAccounts(platform: string, accounts: unknown[]): NextResponse {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Accounts Synced</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
          }
          .container { text-align: center; padding: 2rem; max-width: 400px; }
          .success-icon { font-size: 4rem; margin-bottom: 1rem; }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { opacity: 0.9; font-size: 0.95rem; line-height: 1.5; }
          .badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.85rem;
            margin-top: 0.5rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>${(accounts as Array<{username?: string}>).length === 1 ? '1 cuenta sincronizada' : `${(accounts as Array<{username?: string}>).length} cuentas sincronizadas`}</h1>
          <p>Guardadas en tu perfil. Ahora selecciona cuál vincular a tu cliente.</p>
          <div class="badge">Cerrando automáticamente...</div>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-preview',
              platform: '${platform}',
              accounts: ${JSON.stringify(accounts)},
              tokensSaved: true
            }, window.location.origin);
            setTimeout(() => window.close(), 1500);
          }
        </script>
      </body>
    </html>
  `

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

// Helper: Render OAuth success page
function renderOAuthSuccess(platform: string, count: number): NextResponse {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container { text-align: center; padding: 2rem; }
          .success-icon { font-size: 4rem; margin-bottom: 1rem; }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Account Connected!</h1>
          <p>Connected ${count} ${platform} account(s). This window will close automatically...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-success',
              platform: '${platform}',
              connectedCount: ${count}
            }, window.location.origin);
          }
          setTimeout(() => window.close(), 2000);
        </script>
      </body>
    </html>
  `

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

export const GET = withRateLimitTier(getHandler, 'read')
