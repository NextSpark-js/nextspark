/**
 * Social Media Publish Endpoint
 *
 * Publishes content to connected Instagram Business or Facebook Page accounts
 * Accessible via: /api/v1/plugin/social-media-publisher/social/publish
 *
 * Token Refresh Strategy:
 * - Checks token expiry before publishing
 * - Automatically refreshes if token expires within 10 minutes
 * - Uses Meta's token exchange endpoint (fb_exchange_token)
 * - Re-encrypts tokens with AES-256-GCM
 * - Blocks publishing if refresh fails (prevents wasted API calls)
 *
 * This ensures manual publishes never fail due to expired tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { TokenEncryption } from '@nextsparkjs/core/lib/oauth/encryption'
import { FacebookAPI } from '../../../lib/providers/facebook'
import { InstagramAPI } from '../../../lib/providers/instagram'
import { PublishPhotoSchema, validateImageUrl, validateCaption, platformRequiresImage } from '../../../lib/validation'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'
import { getAdapter } from '../../../lib/adapter'

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

    const userId = authResult.user!.id

    // 2. Parse and validate request body
    const body = await request.json()
    const validation = PublishPhotoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { accountId, entityId, imageUrl, imageUrls, caption, platform } = validation.data

    // Determine media URLs (UPDATED: Support carousels)
    const allImageUrls = imageUrls && imageUrls.length > 0
      ? imageUrls
      : imageUrl
        ? [imageUrl]
        : []
    const isCarousel = allImageUrls.length >= 2

    // 3. Platform-specific validation
    // Some platforms (Instagram, TikTok, Pinterest) REQUIRE image, Facebook/LinkedIn allow text-only
    if (platformRequiresImage(platform) && allImageUrls.length === 0) {
      return NextResponse.json(
        {
          error: `${platform} requires an image`,
          details: 'This platform does not support text-only posts. Please include at least one image.',
        },
        { status: 400 }
      )
    }

    // Validate image URLs format if provided
    for (const url of allImageUrls) {
      const imageValidation = validateImageUrl(url)
      if (!imageValidation.valid) {
        return NextResponse.json(
          {
            error: 'Invalid image URL',
            details: imageValidation.error,
          },
          { status: 400 }
        )
      }
    }

    if (caption) {
      const captionValidation = validateCaption(caption, platform)
      if (!captionValidation.valid) {
        return NextResponse.json(
          {
            error: 'Invalid caption',
            details: captionValidation.error,
          },
          { status: 400 }
        )
      }
    }

    // 4. Get adapter and look up account by accountId
    // NOTE: entityId is the CONTENT ID (for updating after publish), not the parent entity ID
    // The adapter's getAccountById() returns the parent entity ID for access checks
    const adapter = await getAdapter()

    // Look up account using the adapter (generic - no hardcoded table/column names)
    const accountLookup = await adapter.getAccountById(accountId, platform, userId)

    if (!accountLookup) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Verify user has access to the parent entity (e.g., client)
    const parentEntityId = accountLookup.parentEntityId
    const accessResult = await adapter.checkEntityAccess(userId, parentEntityId)
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: accessResult.reason || 'Access denied to this account' },
        { status: 403 }
      )
    }

    // Get the full account data including tokens from the adapter
    const assignments = await adapter.getAssignments(parentEntityId, userId)
    const account = assignments.find(a => a.id === accountId && a.platform === platform)

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 404 }
      )
    }

    // Verify account is active
    if (!account.isActive) {
      return NextResponse.json(
        {
          error: 'Account is inactive',
          message: 'This account has been disconnected. Please reconnect it.',
        },
        { status: 403 }
      )
    }

    // 5. Decrypt access token (handle both encrypted and plain tokens)
    let decryptedToken: string
    if (account.accessToken.includes(':')) {
      // Token is encrypted with format "encrypted:iv:keyId"
      const [encrypted, iv, keyId] = account.accessToken.split(':')
      decryptedToken = await TokenEncryption.decrypt(encrypted, iv, keyId)
    } else {
      // Token is in plain text (legacy or manual entry)
      decryptedToken = account.accessToken
      console.warn('[social-publish] Using unencrypted token - consider re-connecting account')
    }

    // 6. Check if token needs refresh
    const now = new Date()
    const expiresAt = new Date(account.tokenExpiresAt)
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60)

    // Token refresh threshold: 10 minutes before expiration
    const REFRESH_THRESHOLD_MINUTES = 10
    let currentExpiresAt = account.tokenExpiresAt.toISOString()

    if (minutesUntilExpiry < REFRESH_THRESHOLD_MINUTES) {
      console.log(`[social-publish] 🔄 Token expires in ${minutesUntilExpiry.toFixed(2)} minutes - refreshing...`)

      // Attempt to refresh the token (use platformAccountId to find token in social_accounts)
      const refreshResult = await refreshAccountToken(account.platformAccountId, platform, decryptedToken)

      if (refreshResult.success && refreshResult.newAccessToken) {
        console.log(`[social-publish] ✅ Token refreshed successfully for ${platform}`)
        // Update decrypted token for this request (DB already updated)
        decryptedToken = refreshResult.newAccessToken
        currentExpiresAt = refreshResult.newExpiresAt!
      } else {
        console.error(`[social-publish] ❌ Token refresh failed: ${refreshResult.error}`)
        return NextResponse.json(
          {
            error: 'Token expired and refresh failed',
            details: refreshResult.error,
            suggestion: 'Please reconnect your social media account'
          },
          { status: 403 }
        )
      }
    } else {
      console.log(`[social-publish] ✅ Token valid for ${minutesUntilExpiry.toFixed(2)} more minutes`)
    }

    // 7. Publish to platform (UPDATED: Support carousels)
    let publishResult

    if (platform === 'instagram_business') {
      if (isCarousel) {
        console.log(`[social-publish] Publishing ${allImageUrls.length}-image carousel to Instagram`)
        publishResult = await InstagramAPI.publishCarousel({
          igAccountId: account.platformAccountId,
          accessToken: decryptedToken,
          carouselItems: allImageUrls,
          caption,
        })
      } else {
        console.log('[social-publish] Publishing single image to Instagram')
        publishResult = await InstagramAPI.publishPhoto({
          igAccountId: account.platformAccountId,
          accessToken: decryptedToken,
          imageUrl: allImageUrls[0], // ✅ Already validated above (Instagram requires image)
          caption,
        })
      }
    } else if (platform === 'facebook_page') {
      if (isCarousel) {
        console.log(`[social-publish] Publishing ${allImageUrls.length}-image carousel to Facebook`)
        publishResult = await FacebookAPI.publishCarouselPost({
          pageId: account.platformAccountId,
          pageAccessToken: decryptedToken,
          message: caption || '',
          imageUrls: allImageUrls,
        })
      } else if (allImageUrls.length > 0) {
        console.log('[social-publish] Publishing single image to Facebook')
        publishResult = await FacebookAPI.publishPhotoPost({
          pageId: account.platformAccountId,
          pageAccessToken: decryptedToken,
          message: caption || '',
          imageUrl: allImageUrls[0],
        })
      } else {
        console.log('[social-publish] Publishing text-only post to Facebook')
        publishResult = await FacebookAPI.publishTextPost({
          pageId: account.platformAccountId,
          pageAccessToken: decryptedToken,
          message: caption || '',
        })
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      )
    }

    // 8. Create audit log (UPDATED: Track carousel details)
    const auditAction = publishResult.success ? 'post_published' : 'post_failed'
    const publishedAt = new Date().toISOString()

    await mutateWithRLS(
      `INSERT INTO "audit_logs"
        ("userId", "accountId", action, details, "ipAddress", "userAgent")
       VALUES ($1, $2::uuid, $3, $4, $5, $6)`,
      [
        userId,
        accountId, // Entity assignment ID cast to UUID for audit_logs compatibility
        auditAction,
        JSON.stringify({
          platform,
          entitySlug: adapter.getEntitySlug(),
          entityId,
          accountName: account.username,
          success: publishResult.success,
          postId: publishResult.postId,
          error: publishResult.error,
          postType: isCarousel ? 'carousel' : (allImageUrls.length > 0 ? 'photo' : 'text'),
          imageCount: allImageUrls.length,
          imageUrls: allImageUrls,
          caption: caption || '',
          publishedAt
        }),
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        request.headers.get('user-agent') || null
      ],
      userId
    )

    // 9. Update content entity with publish reference (if successful and entityId provided)
    if (publishResult.success && entityId) {
      try {
        await mutateWithRLS(
          `UPDATE "contents"
           SET "platformPostId" = $1,
               "platformPostUrl" = $2,
               "publishedAt" = $3,
               status = 'published',
               "updatedAt" = NOW()
           WHERE id = $4`,
          [
            publishResult.postId,
            publishResult.postUrl,
            publishedAt,
            entityId
          ],
          userId
        )
        console.log(`[social-publish] ✅ Updated content ${entityId} with platform reference`)
      } catch (updateError) {
        // Log but don't fail the request - the publish was successful
        console.error(`[social-publish] ⚠️ Failed to update content with publish reference:`, updateError)
      }
    }

    // 9. Return result
    if (!publishResult.success) {
      return NextResponse.json(
        {
          error: 'Publishing failed',
          platform,
          details: publishResult.error,
          errorDetails: publishResult.errorDetails,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      platform,
      postId: publishResult.postId,
      postUrl: publishResult.postUrl,
      message: `Successfully published to ${platform}`,
    })
  } catch (error: unknown) {
    console.error('❌ Social publish error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      type: typeof error
    })

    return NextResponse.json(
      {
        error: 'Failed to publish content',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export const POST = withRateLimitTier(postHandler, 'write')

/**
 * Refresh OAuth token for a social media account
 *
 * This function handles token refresh for social media accounts.
 * Uses Meta's token exchange endpoint to get a fresh long-lived token.
 *
 * IMPORTANT: Tokens are stored in the plugin's `social_accounts` table, NOT in
 * theme-specific assignment tables (e.g., clients_social_platforms).
 * This function updates tokens by platformAccountId in social_accounts.
 *
 * @param platformAccountId - The platform's account ID (e.g., Instagram Business Account ID)
 * @param platform - Platform type ('instagram_business' | 'facebook_page')
 * @param currentToken - Current decrypted access token
 * @returns Refresh result with new token (decrypted) and expiration
 */
async function refreshAccountToken(
  platformAccountId: string,
  platform: string,
  currentToken: string
): Promise<{
  success: boolean
  newAccessToken?: string
  newExpiresAt?: string
  error?: string
}> {
  try {
    // 1. Get OAuth client credentials from environment
    let clientId: string | undefined
    let clientSecret: string | undefined

    if (platform === 'facebook_page' || platform === 'instagram_business') {
      clientId = process.env.FACEBOOK_CLIENT_ID
      clientSecret = process.env.FACEBOOK_CLIENT_SECRET
    }
    // Add more platforms as needed (Google, Twitter, etc.)

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: `OAuth credentials not configured for ${platform}`
      }
    }

    // 2. Call Meta token refresh endpoint
    // For Facebook/Instagram, we use the token exchange endpoint
    // https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
    const tokenEndpoint = 'https://graph.facebook.com/v21.0/oauth/access_token'
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: currentToken
    })

    const response = await fetch(`${tokenEndpoint}?${params.toString()}`, {
      method: 'GET'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Meta API error: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()

    // 3. Encrypt new access token
    const newAccessToken = data.access_token
    const expiresIn = data.expires_in || 5184000 // Default: 60 days

    const { encrypted, iv, keyId } = await TokenEncryption.encrypt(newAccessToken)
    const encryptedToken = `${encrypted}:${iv}:${keyId}`
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // 4. Update token in social_accounts table (plugin's central token storage)
    // Tokens are stored by platformAccountId (unique per account)
    await mutateWithRLS(
      `UPDATE "social_accounts"
       SET "accessToken" = $1,
           "tokenExpiresAt" = $2,
           "updatedAt" = NOW()
       WHERE "platformAccountId" = $3`,
      [encryptedToken, newExpiresAt, platformAccountId],
      'system'
    )

    console.log(`[social-publish] 🔐 Token refreshed and encrypted for platformAccountId ${platformAccountId}`)
    console.log(`[social-publish] 📅 New expiration: ${newExpiresAt}`)

    // Return DECRYPTED token for immediate use in this request
    return {
      success: true,
      newAccessToken: newAccessToken, // Decrypted for immediate use
      newExpiresAt
    }

  } catch (error) {
    console.error(`[social-publish] Token refresh failed for platformAccountId ${platformAccountId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
