/**
 * Fetch User's Social Accounts for Entity Assignment
 *
 * GET endpoint that returns all social accounts owned by the user
 * that can be assigned to an entity (e.g., client, project).
 *
 * Accessible via: /api/plugins/social-media-publisher/social/accounts
 *
 * Query params:
 * - entityId: (optional) The entity ID to check which accounts are already assigned; needs the project's adapter
 *   (501 without one). Without it, the user's accounts are listed with alreadyAssignedToEntity false.
 * - platform: (optional) Filter by platform (instagram_business, facebook_page)
 *
 * Architecture:
 * - social_accounts: User-level OAuth tokens (plugin-owned, source of truth); the response lists account and page
 *   details without tokens
 * - Entity assignments: Theme-specific (via adapter)
 *
 * This enables token reuse - user connects once, can assign to multiple entities.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { listUserAccounts } from '../../../lib/user-accounts'
import { getAdapter, ensureAdapter, adapterRequiredResponse, type ConnectedEntity } from '../../../lib/adapter'

interface AvailableAccount {
  platform: string
  platformAccountId: string
  username: string
  tokenExpiresAt: string
  permissions: string[]
  accountMetadata: Record<string, unknown>
  alreadyAssignedToEntity: boolean
  socialAccountId: string
  connectedClients: ConnectedEntity[]
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

    // 1. Authentication; the API-key scope is declared at the entry point,
    // which fails closed for keys that lack it (#93).
    const authResult = await authenticateRequest(request, { requiredScope: 'social:read' })
    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    const userId = authResult.user!.id

    // 2. The project's side, through its adapter: the user's accounts are the plugin's own (social_accounts) and
    // list without one; which of them an entity uses is the project's, so an entityId needs the adapter.
    const adapter = (await ensureAdapter()) ? await getAdapter() : null
    let assignedAccountIds = new Set<string>()

    if (entityId) {
      if (!adapter) {
        return adapterRequiredResponse()
      }

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

      // 3. Accounts already assigned to this entity
      assignedAccountIds = await adapter.getAssignedPlatformIds(entityId, userId)
    }

    // 4. The entities that use each platform account, from the adapter (the project's tables stay behind it)
    const clientsByPlatformAccountId: Map<string, ConnectedEntity[]> = adapter
      ? await adapter.getConnectedEntities(userId)
      : new Map()

    console.log(`[social-accounts] Found connected entities for ${clientsByPlatformAccountId.size} platform accounts`)

    // 5. The user's accounts (social_accounts, plus what Graph returns for a stored Meta token), listed without
    // their tokens: assign reads the token of the account it is asked for on the server
    const userAccounts = await listUserAccounts(userId, platformFilter)
    const availableAccounts: AvailableAccount[] = userAccounts.map(account => ({
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      username: account.username,
      tokenExpiresAt: account.tokenExpiresAt,
      permissions: account.permissions,
      accountMetadata: account.accountMetadata,
      alreadyAssignedToEntity: assignedAccountIds.has(account.platformAccountId),
      socialAccountId: account.socialAccountId,
      connectedClients: clientsByPlatformAccountId.get(account.platformAccountId) || [],
    }))

    console.log(`[social-accounts] Total available accounts: ${availableAccounts.length}`)
    console.log(`[social-accounts] Already assigned to entity: ${availableAccounts.filter(a => a.alreadyAssignedToEntity).length}`)

    return NextResponse.json({
      success: true,
      accounts: availableAccounts,
      hasValidToken: userAccounts.some(account => account.stored),
      assignedCount: assignedAccountIds.size,
      entitySlug: adapter ? adapter.getEntitySlug() : null,
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

export const OPTIONS = corsPreflight
