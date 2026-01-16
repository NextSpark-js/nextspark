/**
 * OAuth Callback Handler for Social Media Publishing
 *
 * GET endpoint that receives the OAuth redirect from Facebook
 * Accessible via: /api/v1/plugin/social-media-publisher/social/connect/callback
 *
 * Query params:
 * - code: Authorization code from Facebook
 * - state: CSRF protection token with clientId embedded (format: {randomState}&platform={platform}&clientId={clientId})
 * - error: (optional) Error if user denied permission
 * - error_description: (optional) Error description
 *
 * Architecture:
 * - Uses child entity API (/api/v1/clients/{clientId}/social-platforms) instead of direct DB inserts
 * - Social accounts belong to clients, not users
 * - Redirects to /clients/{clientId}/social-platforms on success/error
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

const getHandler = async (request: NextRequest) => {
  try {
    // 1. Parse state to extract clientId, platform, and mode
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state') || ''

    // State format: "{randomState}&platform={platform}&clientId={clientId}&mode={mode}"
    const stateParams = new URLSearchParams(state)
    const clientId = stateParams.get('clientId')
    const platform = stateParams.get('platform') || 'instagram_business'
    const mode = stateParams.get('mode') // 'preview' = return data without saving, undefined = save to DB (default)

    console.log('[oauth-callback] Received OAuth callback:', {
      platform,
      clientId,
      mode: mode || 'save (default)',
      hasCode: !!searchParams.get('code')
    })

    // 2. Check for OAuth errors (user denied, etc.)
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      console.error('[oauth-callback] OAuth error:', error, errorDescription)

      // Map Meta OAuth errors to user-friendly error types
      let errorType = error
      let userMessage = errorDescription || 'Authentication failed'

      if (error === 'access_denied') {
        errorType = 'user_cancelled'
        userMessage = 'You cancelled the authorization process'
      } else if (error === 'unauthorized_client') {
        errorType = 'app_not_authorized'
        userMessage = 'This app is not authorized to access your Facebook account'
      } else if (error === 'server_error' || error === 'temporarily_unavailable') {
        errorType = 'meta_server_error'
        userMessage = 'Facebook is temporarily unavailable. Please try again later'
      }

      // Return HTML page that sends error postMessage to opener window
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
              .container {
                text-align: center;
                padding: 2rem;
              }
              .error-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
              h1 {
                font-size: 1.5rem;
                margin-bottom: 0.5rem;
              }
              p {
                opacity: 0.9;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1>Authentication Failed</h1>
              <p>${userMessage.replace(/'/g, "\\'")}. This window will close automatically...</p>
            </div>
            <script>
              // Send error message to parent window
              if (window.opener) {
                window.opener.postMessage({
                  type: 'oauth-error',
                  error: '${errorType}',
                  errorDescription: '${userMessage.replace(/'/g, "\\'")}'
                }, window.location.origin);
              }

              // Close this popup after 3 seconds
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      })
    }

    // 3. Validate required parameters
    if (!clientId) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=missing_client&message=Client ID not provided in OAuth flow`,
          request.url
        )
      )
    }

    const code = searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(
        new URL(
          `/clients/${clientId}/social-platforms?error=missing_code&message=Authorization code not provided`,
          request.url
        )
      )
    }

    // 4. Authentication (user must be logged in)
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.redirect(
        new URL(
          `/auth/login?error=authentication_required&message=You must be logged in to connect accounts&redirect=/clients/${clientId}/social-platforms`,
          request.url
        )
      )
    }

    // 5. Verify user owns the client
    const clientCheckResult = await mutateWithRLS<{ id: string }>(
      `SELECT id FROM "clients" WHERE id = $1 AND "userId" = $2`,
      [clientId, authResult.user!.id],
      authResult.user!.id
    )

    if (clientCheckResult.rows.length === 0) {
      return NextResponse.redirect(
        new URL(
          `/clients/${clientId}/social-platforms?error=unauthorized&message=You do not have access to this client`,
          request.url
        )
      )
    }

    // 6. State validation (CSRF protection)
    // TODO: Implement proper state validation with session storage
    // For now, we'll log it and accept any state with a warning
    if (state) {
      console.log('[oauth-callback] Received state:', state)
      console.warn('[oauth-callback] ⚠️  State validation not yet implemented - potential CSRF vulnerability')
    }

    // 5. Exchange authorization code for access token
    const oauthConfig = getOAuthConfig()
    const tokenData = await exchangeCodeForToken(
      code,
      oauthConfig,
      platform as 'facebook_page' | 'instagram_business'
    )

    const userAccessToken = tokenData.accessToken
    let expiresIn = tokenData.expiresIn

    // 6. Get accounts based on platform
    let accountsToConnect: Array<{
      platformAccountId: string
      username: string
      accessToken: string
      permissions: string[]
      metadata: any
    }> = []

    if (platform === 'facebook_page') {
      // Get Facebook Pages
      const pages = await FacebookAPI.getUserPages(userAccessToken)

      accountsToConnect = pages.map(page => ({
        platformAccountId: page.id,
        username: page.name,
        accessToken: page.accessToken, // Use page token, not user token
        permissions: page.tasks || [],
        metadata: {
          category: page.category,
          pictureUrl: page.pictureUrl,
        },
      }))
    } else if (platform === 'instagram_business') {
      // Instagram Graph API (via Facebook Pages)
      console.log('[oauth-callback] Using Instagram Graph API (via Facebook Pages)')

      // Step 1: Get user's Facebook Pages
      console.log('[oauth-callback] Fetching Facebook Pages...')
      const pages = await FacebookAPI.getUserPages(userAccessToken)
      console.log(`[oauth-callback] Found ${pages.length} Facebook Pages`)

      // Step 2: For each Page, check if it has Instagram Business Account
      for (const page of pages) {
        console.log(`[oauth-callback] Checking Page "${page.name}" for Instagram...`)

        try {
          const igAccount = await FacebookAPI.getInstagramBusinessAccount(
            page.id,
            page.accessToken // Use Page token, not user token
          )

          if (igAccount) {
            console.log(`[oauth-callback] ✅ Found Instagram @${igAccount.username} linked to Page "${page.name}"`)

            accountsToConnect.push({
              platformAccountId: igAccount.id,
              username: igAccount.username,
              accessToken: page.accessToken, // Use Page token for Instagram Graph API calls
              permissions: [
                'instagram_basic',
                'instagram_content_publish',
                'instagram_manage_comments',
                'pages_show_list',
                'pages_read_engagement',
              ],
              metadata: {
                // Instagram Graph API data (read-only, refreshable)
                username: igAccount.username,
                name: igAccount.name,
                profilePictureUrl: igAccount.profilePictureUrl,
                followersCount: igAccount.followersCount,
                followsCount: igAccount.followsCount,
                mediaCount: igAccount.mediaCount,
                biography: igAccount.biography,
                website: igAccount.website,
                lastSyncedAt: new Date().toISOString(),

                // Facebook Page info (for reference)
                facebookPageId: page.id,
                facebookPageName: page.name,
                facebookPageCategory: page.category,

                // User-editable fields (pre-filled, modifiable in form)
                displayName: igAccount.name || igAccount.username, // Pre-fill with name or username
                description: igAccount.biography || '', // Pre-fill with bio if available
                tags: [], // Empty, user fills in form
              },
            })
          } else {
            console.log(`[oauth-callback] Page "${page.name}" has no Instagram Business Account linked`)
          }
        } catch (error) {
          console.error(`[oauth-callback] Error checking Instagram for Page "${page.name}":`, error)
          // Continue with next page instead of failing entire flow
        }
      }

      // In preview mode, having 0 Instagram accounts is OK - user can still see their Pages
      // In save mode, having 0 accounts is an error (nothing to save)
      if (accountsToConnect.length === 0 && mode !== 'preview') {
        console.warn('[oauth-callback] ⚠️  No Instagram Business Accounts found across all Facebook Pages (save mode)')

        // Return HTML that sends a specific error message to parent window
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>No Instagram Accounts Found</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%);
                  color: white;
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                  max-width: 500px;
                }
                .warning-icon {
                  font-size: 4rem;
                  margin-bottom: 1rem;
                }
                h1 {
                  font-size: 1.5rem;
                  margin-bottom: 0.5rem;
                }
                p {
                  opacity: 0.9;
                  line-height: 1.5;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="warning-icon">⚠️</div>
                <h1>No Instagram Accounts Found</h1>
                <p>Although you authorized the app, we couldn't find any Instagram Business Accounts linked to your Facebook Pages.</p>
                <p style="margin-top: 1rem; font-size: 0.9rem;">This window will close automatically...</p>
              </div>
              <script>
                // Send specific error to parent window
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'oauth-error',
                    error: 'no_instagram_accounts',
                    errorDescription: 'No Instagram Business Accounts found linked to your Facebook Pages. Please link your Instagram account to a Facebook Page first.'
                  }, window.location.origin);
                }

                // Close this popup after 3 seconds
                setTimeout(() => {
                  window.close();
                }, 3000);
              </script>
            </body>
          </html>
        `

        return new NextResponse(html, {
          headers: {
            'Content-Type': 'text/html',
          },
        })
      } else if (accountsToConnect.length === 0 && mode === 'preview') {
        console.log('[oauth-callback] No Instagram accounts found, but in preview mode - continuing with empty array')
      } else {
        console.log(`[oauth-callback] ✅ Found ${accountsToConnect.length} Instagram Business Account(s)`)
      }
    }

    // 7. Handle preview mode vs save mode
    if (mode === 'preview') {
      // PREVIEW MODE: Return data without saving to DB
      // This allows the form to pre-fill with OAuth data before user clicks Save
      console.log('[oauth-callback] Preview mode detected - returning data without saving to DB')

      const previewData = accountsToConnect.map(account => ({
        platform,
        platformAccountId: account.platformAccountId,
        username: account.username,
        accessToken: account.accessToken, // Return unencrypted token (will be encrypted on save)
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        permissions: account.permissions,
        accountMetadata: account.metadata,
      }))

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
              .container {
                text-align: center;
                padding: 2rem;
              }
              .loading-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
                animation: spin 2s linear infinite;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              h1 {
                font-size: 1.5rem;
                margin-bottom: 0.5rem;
              }
              p {
                opacity: 0.9;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="loading-icon">🔄</div>
              <h1>Loading Profile Data...</h1>
              <p>Pre-filling your ${platform} information...</p>
            </div>
            <script>
              // Send preview data to parent window
              if (window.opener) {
                window.opener.postMessage({
                  type: 'oauth-preview',
                  platform: '${platform}',
                  accounts: ${JSON.stringify(previewData)}
                }, window.location.origin);

                // Close this popup after sending data
                setTimeout(() => {
                  window.close();
                }, 1000);
              }
            </script>
          </body>
        </html>
      `

      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // SAVE MODE (default): Encrypt tokens and save accounts to child entity
    const savedCount = accountsToConnect.length

    for (const account of accountsToConnect) {
      // Encrypt access token
      const encryptedToken = await TokenEncryption.encrypt(account.accessToken)

      // Calculate expiration date
      const now = new Date()
      const expiresAt = new Date(now.getTime() + expiresIn * 1000)

      // Insert social account into clients_social_platforms table (child entity)
      const result = await mutateWithRLS<{
        id: string
        platform: string
        username: string
      }>(
        `INSERT INTO "clients_social_platforms"
          ("parentId", platform, "platformAccountId", "username", "accessToken",
           "tokenExpiresAt", permissions, "accountMetadata", "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT ("parentId", "platformAccountId")
         WHERE "platformAccountId" IS NOT NULL
         DO UPDATE SET
           "accessToken" = EXCLUDED."accessToken",
           "tokenExpiresAt" = EXCLUDED."tokenExpiresAt",
           permissions = EXCLUDED.permissions,
           "accountMetadata" = EXCLUDED."accountMetadata",
           "isActive" = EXCLUDED."isActive",
           "updatedAt" = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          clientId, // parentId (client that owns this account)
          platform,
          account.platformAccountId,
          account.username,
          `${encryptedToken.encrypted}:${encryptedToken.iv}:${encryptedToken.keyId}`,
          expiresAt.toISOString(),
          JSON.stringify(account.permissions),
          JSON.stringify(account.metadata),
          true // isActive
        ],
        authResult.user!.id
      )

      const savedAccount = result.rows[0]!
      console.log('[oauth-callback] ✅ Account saved to child entity:', {
        id: savedAccount.id,
        clientId,
        platform,
        accountName: account.username
      })

      // Create audit log entry
      await mutateWithRLS(
        `INSERT INTO "audit_logs"
          ("userId", "accountId", action, details, "ipAddress", "userAgent")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          authResult.user!.id,
          savedAccount.id,
          'account_connected',
          JSON.stringify({
            clientId,
            platform,
            accountName: account.username,
            success: true,
            connectedAt: new Date().toISOString()
          }),
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          request.headers.get('user-agent') || null
        ],
        authResult.user!.id
      )

      console.log('[oauth-callback] ✅ Audit log created for account connection')
    }

    // 8. Return HTML page that sends postMessage to opener window
    // This allows the OAuth popup to communicate back to the parent page
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
            .container {
              text-align: center;
              padding: 2rem;
            }
            .success-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              font-size: 1.5rem;
              margin-bottom: 0.5rem;
            }
            p {
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Account Connected Successfully!</h1>
            <p>Connected ${savedCount} ${platform} account(s). This window will close automatically...</p>
          </div>
          <script>
            // Send success message to parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth-success',
                platform: '${platform}',
                connectedCount: ${savedCount}
              }, window.location.origin);
            }

            // Close this popup after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error: unknown) {
    console.error('❌ OAuth callback error:', error)

    // Extract error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    // Return HTML page that sends error postMessage to opener window
    // This is critical - if we redirect, the popup redirects and never communicates with parent
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
            .container {
              text-align: center;
              padding: 2rem;
            }
            .error-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              font-size: 1.5rem;
              margin-bottom: 0.5rem;
            }
            p {
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Connection Failed</h1>
            <p>${errorMessage.replace(/'/g, "\\'")}. This window will close automatically...</p>
          </div>
          <script>
            // Send error message to parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth-error',
                error: 'callback_exception',
                errorDescription: '${errorMessage.replace(/'/g, "\\'")}'
              }, window.location.origin);
            }

            // Close this popup after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  }
}

export const GET = withRateLimitTier(getHandler, 'read')
