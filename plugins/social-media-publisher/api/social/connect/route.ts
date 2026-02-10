/**
 * Social Media Connect Endpoint
 *
 * OAuth initiator and callback handler for connecting Facebook Pages and Instagram Business Accounts
 * Accessible via: /api/v1/plugin/social-media-publisher/social/connect
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { TokenEncryption } from '@nextsparkjs/core/lib/oauth/encryption'
import { FacebookAPI } from '../../../lib/providers/facebook'
import { ConnectAccountSchema } from '../../../lib/validation'
import { exchangeCodeForToken, getOAuthConfig, generateAuthorizationUrl } from '../../../lib/oauth-helper'
import type { SocialPlatform } from '../../../types/social.types'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'

/**
 * GET - Initiate OAuth flow
 * Redirects user to Facebook OAuth authorization page
 */
const getHandler = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'instagram_business'
    const clientId = searchParams.get('clientId')
    const randomState = searchParams.get('state') || ''
    const mode = searchParams.get('mode') // 'preview' or undefined (save mode)

    // Validate required parameters
    if (!clientId) {
      return NextResponse.json(
        {
          error: 'Missing clientId',
          details: 'clientId parameter is required to associate social accounts with the correct client',
        },
        { status: 400 }
      )
    }

    // Validate platform
    if (platform !== 'facebook_page' && platform !== 'instagram_business') {
      return NextResponse.json(
        {
          error: 'Invalid platform',
          details: 'Platform must be "facebook_page" or "instagram_business"',
        },
        { status: 400 }
      )
    }

    // Build state with clientId, platform, and mode embedded
    // Format: "{randomState}&platform={platform}&clientId={clientId}&mode={mode}"
    let state = `${randomState}&platform=${platform}&clientId=${clientId}`
    if (mode) {
      state += `&mode=${mode}`
    }

    // Get OAuth configuration
    const oauthConfig = getOAuthConfig()

    console.log('[social-connect] OAuth Config:', {
      facebookClientId: oauthConfig.facebookClientId,
      redirectUri: oauthConfig.redirectUri,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      platform
    })

    // Generate authorization URL with proper scopes for platform
    const authorizationUrl = generateAuthorizationUrl(
      platform as 'facebook_page' | 'instagram_business',
      oauthConfig,
      state
    )

    console.log('[social-connect] Generated Authorization URL:', authorizationUrl)
    console.log('[social-connect] Redirecting to Instagram OAuth:', {
      platform,
      clientId,
      mode,
      state,
      redirectUri: oauthConfig.redirectUri,
      authUrl: authorizationUrl
    })

    // Redirect to Facebook OAuth
    return NextResponse.redirect(authorizationUrl)
  } catch (error) {
    console.error('❌ OAuth initiation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const GET = withRateLimitTier(getHandler, 'read')

/**
 * POST - Handle OAuth callback (deprecated - use /callback endpoint instead)
 * This endpoint receives the authorization code and exchanges it for access token
 */
const postHandler = async (request: NextRequest) => {
  try {
    // 1. Authentication
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const validation = ConnectAccountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { code, state, platform } = validation.data

    // 3. Verify state to prevent CSRF
    // TODO: Implement state validation with session storage
    // For now, we'll just log it
    console.log('[social-connect] OAuth state:', state)

    // 4. Exchange authorization code for access token
    const oauthConfig = getOAuthConfig()
    const tokenData = await exchangeCodeForToken(
      code,
      oauthConfig,
      platform as 'facebook_page' | 'instagram_business'
    )

    const userAccessToken = tokenData.accessToken
    const expiresIn = tokenData.expiresIn

    // 5. Get accounts based on platform
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

      // For each page, get detailed stats
      for (const page of pages) {
        try {
          const pageInfo = await FacebookAPI.getPageInfo(page.id, page.accessToken)

          accountsToConnect.push({
            platformAccountId: page.id,
            username: page.name,
            accessToken: page.accessToken, // Use page token, not user token
            permissions: page.tasks || [],
            metadata: {
              profilePictureUrl: pageInfo.profilePictureUrl,
              fanCount: pageInfo.fanCount,
              about: pageInfo.about,
              category: pageInfo.category || page.category,
              link: pageInfo.link,
            },
          })
        } catch (error) {
          console.error(`[social-connect] Failed to get stats for page ${page.id}:`, error)
          // Fallback: add page without detailed stats
          accountsToConnect.push({
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
      }
    } else if (platform === 'instagram_business') {
      // Get Facebook Pages first (Instagram Business Accounts are linked to Pages)
      const pages = await FacebookAPI.getUserPages(userAccessToken)

      // For each page, check if it has an Instagram Business Account
      for (const page of pages) {
        const igAccount = await FacebookAPI.getInstagramBusinessAccount(
          page.id,
          page.accessToken
        )

        if (igAccount) {
          accountsToConnect.push({
            platformAccountId: igAccount.id,
            username: igAccount.username,
            accessToken: page.accessToken, // Use page token (has IG permissions)
            permissions: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'pages_show_list', 'pages_read_engagement'],
            metadata: {
              profilePictureUrl: igAccount.profilePictureUrl,
              followersCount: igAccount.followersCount,
              followsCount: igAccount.followsCount,
              mediaCount: igAccount.mediaCount,
              linkedPageId: page.id,
              linkedPageName: page.name,
            },
          })
        }
      }

      if (accountsToConnect.length === 0) {
        return NextResponse.json(
          {
            error: 'No Instagram Business Accounts found',
            message:
              'No Instagram Business Accounts are linked to your Facebook Pages. ' +
              'Please connect an Instagram Business Account to one of your Facebook Pages first.',
          },
          { status: 404 }
        )
      }
    }

    // 6. Encrypt tokens and save accounts
    const savedAccounts = []

    for (const account of accountsToConnect) {
      // Encrypt access token
      const encryptedToken = await TokenEncryption.encrypt(account.accessToken)

      // Calculate expiration date
      const now = new Date()
      const expiresAt = new Date(now.getTime() + expiresIn * 1000)

      // Insert social account into database
      const result = await mutateWithRLS<{ id: string; platform: string; username: string; createdAt: string; permissions: string; accountMetadata: string }>(
        `INSERT INTO "social_accounts"
          ("userId", platform, "platformAccountId", "username", "accessToken", "tokenExpiresAt", permissions, "accountMetadata", "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT ("platformAccountId")
         DO UPDATE SET
           "accessToken" = EXCLUDED."accessToken",
           "tokenExpiresAt" = EXCLUDED."tokenExpiresAt",
           permissions = EXCLUDED.permissions,
           "accountMetadata" = EXCLUDED."accountMetadata",
           "isActive" = EXCLUDED."isActive",
           "updatedAt" = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          authResult.user!.id,
          platform,
          account.platformAccountId,
          account.username,
          `${encryptedToken.encrypted}:${encryptedToken.iv}:${encryptedToken.keyId}`,
          expiresAt.toISOString(),
          JSON.stringify(account.permissions),
          JSON.stringify(account.metadata),
          true
        ],
        authResult.user!.id
      )

      const savedAccount = result.rows[0]!
      savedAccounts.push(savedAccount)

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

      console.log('[social-connect] ✅ Account saved and audit log created:', {
        accountId: savedAccount.id,
        platform,
        accountName: account.username,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully connected ${savedAccounts.length} ${platform} account(s)`,
      accounts: savedAccounts.map((acc: any) => ({
        id: acc.id,
        platform: acc.platform,
        accountName: acc.username,
        permissions: typeof acc.permissions === 'string' ? JSON.parse(acc.permissions) : acc.permissions,
        metadata: typeof acc.accountMetadata === 'string' ? JSON.parse(acc.accountMetadata) : acc.accountMetadata,
        connectedAt: acc.createdAt,
      })),
    })
  } catch (error: unknown) {
    console.error('❌ Social connect error:', error)

    return NextResponse.json(
      {
        error: 'Failed to connect social account',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = withRateLimitTier(postHandler, 'write')
