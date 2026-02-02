/**
 * Fetch User's Social Accounts for Entity Assignment
 *
 * GET endpoint that returns all social accounts owned by the user
 * that can be assigned to an entity (e.g., client, project).
 *
 * Accessible via: /api/v1/plugin/social-media-publisher/social/accounts
 *
 * Query params:
 * - entityId: The entity ID to check which accounts are already assigned
 * - platform: (optional) Filter by platform (instagram_business, facebook_page)
 *
 * Architecture:
 * - social_accounts: User-level OAuth tokens (plugin-owned, source of truth)
 * - Entity assignments: Theme-specific (via adapter)
 *
 * This enables token reuse - user connects once, can assign to multiple entities.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { TokenEncryption } from '@nextsparkjs/core/lib/oauth/encryption'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { FacebookAPI } from '../../../lib/providers/facebook'
import { getAdapter } from '../../../lib/adapter'

interface StoredSocialAccount {
  id: string
  platform: string
  platformAccountId: string
  username: string
  accessToken: string
  tokenExpiresAt: string
  permissions: string
  accountMetadata: string
  isActive: boolean
}

interface ConnectedClient {
  id: string
  name: string
}

interface AvailableAccount {
  platform: string
  platformAccountId: string
  username: string
  accessToken: string
  tokenExpiresAt: string
  permissions: string[]
  accountMetadata: Record<string, unknown>
  alreadyAssignedToEntity: boolean
  socialAccountId: string
  connectedClients: ConnectedClient[]
}

const getHandler = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    // Support both entityId (new) and clientId (legacy) for backward compatibility
    const entityId = searchParams.get('entityId') || searchParams.get('clientId')
    const platformFilter = searchParams.get('platform')

    console.log('[social-accounts] Fetching user accounts:', {
      entityId,
      platformFilter
    })

    // 1. Validate entityId
    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId is required' },
        { status: 400 }
      )
    }

    // 2. Authentication
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = authResult.user!.id

    // 3. Get adapter and verify entity access
    const adapter = await getAdapter()
    const accessResult = await adapter.checkEntityAccess(userId, entityId)

    if (!accessResult.hasAccess) {
      console.log('[social-accounts] Entity access check failed:', { entityId, userId })
      return NextResponse.json(
        { error: accessResult.reason || 'Entity not found or access denied' },
        { status: 404 }
      )
    }

    console.log('[social-accounts] Entity access verified:', {
      entityId,
      entitySlug: adapter.getEntitySlug(),
      teamId: accessResult.teamId
    })

    // 4. Get accounts already assigned to this entity via adapter
    const assignedAccountIds = await adapter.getAssignedPlatformIds(entityId, userId)

    // 4.1 Get ALL entities that use each platformAccountId (for showing connected entities info)
    // NOTE: This functionality should be moved into the adapter to avoid hardcoded assumptions
    // Current implementation assumes content-buddy theme structure
    // TODO: Add adapter.getConnectedEntities() method for theme-agnostic queries
    const clientsByPlatformAccountId = new Map<string, ConnectedClient[]>()

    const connectedClientsResult = await queryWithRLS<{
      platformAccountId: string
      clientId: string
      clientName: string
    }>(
      `SELECT DISTINCT
        csp."platformAccountId",
        c.id as "clientId",
        c.name as "clientName"
      FROM "clients_social_platforms" csp
      INNER JOIN "clients" c ON c.id = csp."parentId"
      INNER JOIN "team_members" tm ON tm."teamId" = c."teamId" AND tm."userId" = $1
      WHERE csp."isActive" = true
        AND csp."platformAccountId" IS NOT NULL`,
      [userId],
      userId
    )

    // Group by platformAccountId
    for (const row of connectedClientsResult || []) {
      if (!clientsByPlatformAccountId.has(row.platformAccountId)) {
        clientsByPlatformAccountId.set(row.platformAccountId, [])
      }
      clientsByPlatformAccountId.get(row.platformAccountId)!.push({
        id: row.clientId,
        name: row.clientName
      })
    }

    console.log(`[social-accounts] Found connected clients for ${clientsByPlatformAccountId.size} platform accounts`)

    // 5. Fetch user's social accounts from social_accounts table (plugin-owned)
    let query = `
      SELECT
        id,
        platform,
        "platformAccountId",
        username,
        "accessToken",
        "tokenExpiresAt",
        permissions,
        "accountMetadata",
        "isActive"
      FROM "social_accounts"
      WHERE "userId" = $1
        AND "isActive" = true
        AND "accessToken" IS NOT NULL
        AND "accessToken" != ''
    `

    const params: unknown[] = [userId]

    if (platformFilter) {
      query += ` AND platform = $2`
      params.push(platformFilter)
    }

    const result = await queryWithRLS<StoredSocialAccount>(query, params, userId)
    const storedAccounts = result || []

    console.log(`[social-accounts] Found ${storedAccounts.length} user social accounts`)

    // 6. Check token validity and fetch fresh account data from Meta API
    const availableAccounts: AvailableAccount[] = []
    const processedAccountIds = new Set<string>()

    for (const account of storedAccounts) {
      // Skip expired tokens
      const expiresAt = new Date(account.tokenExpiresAt)
      if (expiresAt < new Date()) {
        console.log(`[social-accounts] Token expired for ${account.username}, skipping`)
        continue
      }

      // Skip duplicates
      if (processedAccountIds.has(account.platformAccountId)) {
        continue
      }
      processedAccountIds.add(account.platformAccountId)

      // Decrypt token
      try {
        const tokenParts = account.accessToken.split(':')
        if (tokenParts.length !== 3) {
          console.log(`[social-accounts] Invalid token format for ${account.username}, skipping`)
          continue
        }

        const decrypted = await TokenEncryption.decrypt(
          tokenParts[0],
          tokenParts[1],
          tokenParts[2]
        )

        // Parse stored metadata
        let metadata: Record<string, unknown> = {}
        try {
          metadata = typeof account.accountMetadata === 'string'
            ? JSON.parse(account.accountMetadata)
            : account.accountMetadata || {}
        } catch {
          metadata = {}
        }

        let permissions: string[] = []
        try {
          permissions = typeof account.permissions === 'string'
            ? JSON.parse(account.permissions)
            : account.permissions || []
        } catch {
          permissions = []
        }

        // Add the stored account to available accounts
        availableAccounts.push({
          platform: account.platform,
          platformAccountId: account.platformAccountId,
          username: account.username,
          accessToken: decrypted,
          tokenExpiresAt: account.tokenExpiresAt,
          permissions,
          accountMetadata: metadata,
          alreadyAssignedToEntity: assignedAccountIds.has(account.platformAccountId),
          socialAccountId: account.id,
          connectedClients: clientsByPlatformAccountId.get(account.platformAccountId) || [],
        })

        // If this is a Meta token, try to fetch additional accounts
        if (account.platform === 'instagram_business' || account.platform === 'facebook_page') {
          try {
            const pages = await FacebookAPI.getUserPages(decrypted)

            for (const page of pages) {
              // Add Facebook Page if not filtered and not already added
              if ((!platformFilter || platformFilter === 'facebook_page') &&
                  !processedAccountIds.has(page.id)) {
                processedAccountIds.add(page.id)

                const pageInfo = await FacebookAPI.getPageInfo(page.id, page.accessToken)

                availableAccounts.push({
                  platform: 'facebook_page',
                  platformAccountId: page.id,
                  username: page.name,
                  accessToken: page.accessToken,
                  tokenExpiresAt: account.tokenExpiresAt,
                  permissions: page.tasks || [],
                  accountMetadata: {
                    category: page.category,
                    profilePictureUrl: page.pictureUrl || pageInfo.profilePictureUrl,
                    fanCount: pageInfo.fanCount,
                    about: pageInfo.about,
                    link: pageInfo.link,
                    lastSyncedAt: new Date().toISOString(),
                  },
                  alreadyAssignedToEntity: assignedAccountIds.has(page.id),
                  socialAccountId: account.id,
                  connectedClients: clientsByPlatformAccountId.get(page.id) || [],
                })
              }

              // Add Instagram Business Account if available
              if ((!platformFilter || platformFilter === 'instagram_business') &&
                  !processedAccountIds.has(page.id + '_ig')) {
                try {
                  const igAccount = await FacebookAPI.getInstagramBusinessAccount(
                    page.id,
                    page.accessToken
                  )

                  if (igAccount && !processedAccountIds.has(igAccount.id)) {
                    processedAccountIds.add(igAccount.id)

                    availableAccounts.push({
                      platform: 'instagram_business',
                      platformAccountId: igAccount.id,
                      username: igAccount.username,
                      accessToken: page.accessToken,
                      tokenExpiresAt: account.tokenExpiresAt,
                      permissions: [
                        'instagram_basic',
                        'instagram_content_publish',
                        'instagram_manage_comments',
                        'pages_show_list',
                        'pages_read_engagement',
                      ],
                      accountMetadata: {
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
                      alreadyAssignedToEntity: assignedAccountIds.has(igAccount.id),
                      socialAccountId: account.id,
                      connectedClients: clientsByPlatformAccountId.get(igAccount.id) || [],
                    })
                  }
                } catch {
                  // No Instagram account for this page, skip
                }
              }
            }
          } catch (error) {
            console.error('[social-accounts] Error fetching from Meta API:', error)
            // Don't fail - return what we have stored
          }
        }
      } catch (error) {
        console.error(`[social-accounts] Failed to process account ${account.username}:`, error)
      }
    }

    console.log(`[social-accounts] Total available accounts: ${availableAccounts.length}`)
    console.log(`[social-accounts] Already assigned to entity: ${availableAccounts.filter(a => a.alreadyAssignedToEntity).length}`)

    return NextResponse.json({
      success: true,
      accounts: availableAccounts,
      hasValidToken: storedAccounts.length > 0,
      assignedCount: assignedAccountIds.size,
      entitySlug: adapter.getEntitySlug(),
    })

  } catch (error) {
    console.error('[social-accounts] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export const GET = withRateLimitTier(getHandler, 'read')
