/**
 * Assign Social Accounts to Entity
 *
 * POST endpoint that links accounts the user has connected to an entity, via the adapter (entity level).
 * The request names each account by its platformAccountId; the token is read on the server, from the user's
 * social_accounts row or, for a Page or Instagram account Graph returns for a stored Meta token, from Graph. A token
 * in the request body is not read.
 *
 * Accessible via: /api/plugins/social-media-publisher/social/assign
 *
 * Body:
 * - entityId: Target entity ID (e.g., client ID)
 * - accounts: Array of { platformAccountId, platform? }, accounts listed by GET .../social/accounts
 *
 * Architecture:
 * 1. An account found through Graph is stored in social_accounts (USER level - plugin-owned)
 * 2. Create/update links via adapter (ENTITY level - theme-owned)
 * 3. This enables token reuse across multiple entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { TokenEncryption } from '@nextsparkjs/core/lib/oauth/encryption'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'
import { getAdapter, ensureAdapter, adapterRequiredResponse } from '../../../lib/adapter'
import { auditTeamId, recordAuditLog } from '../../../lib/audit-log'
import { ACCOUNT_CONNECTED_ELSEWHERE, listUserAccounts } from '../../../lib/user-accounts'

interface AccountToAssign {
  platformAccountId: string
  /** Optional: when given, the account must be of this platform */
  platform?: string
}

interface AssignRequest {
  entityId?: string
  clientId?: string // Legacy support
  accounts: AccountToAssign[]
}

const postHandler = async (request: NextRequest) => {
  try {
    // 1. Authentication; the API-key scope is declared at the entry point,
    // which fails closed for keys that lack it (#93).
    const authResult = await authenticateRequest(request, { requiredScope: 'social:write' })
    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    const userId = authResult.user!.id

    // 2. Parse and validate request body
    const body = await request.json() as AssignRequest
    // Support both entityId (new) and clientId (legacy)
    const entityId = body.entityId || body.clientId
    const { accounts } = body

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId is required' },
        { status: 400 }
      )
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json(
        { error: 'accounts array is required' },
        { status: 400 }
      )
    }

    // 3. Get adapter and verify entity access
    if (!(await ensureAdapter())) {
      return adapterRequiredResponse()
    }
    const adapter = await getAdapter()
    const accessResult = await adapter.checkEntityAccess(userId, entityId)

    console.log('[assign-accounts] Assigning accounts to entity:', {
      entityId,
      entitySlug: adapter.getEntitySlug(),
      accountCount: accounts.length,
      userId
    })

    if (!accessResult.hasAccess) {
      console.log('[assign-accounts] Entity access check failed:', { entityId, userId })
      return NextResponse.json(
        { error: accessResult.reason || 'Entity not found or access denied' },
        { status: 404 }
      )
    }

    console.log('[assign-accounts] Entity access verified:', {
      entityId,
      entitySlug: adapter.getEntitySlug(),
      teamId: accessResult.teamId
    })

    // The team the audit rows belong to: the entity's, else the request's
    const teamId = await auditTeamId(request, authResult, accessResult.teamId)
    if (teamId instanceof NextResponse) return teamId

    // 4. Process each account
    const results: Array<{
      platformAccountId: string
      username: string
      success: boolean
      error?: string
    }> = []

    // The accounts the user can assign, with their tokens, from the server's side only
    const userAccounts = await listUserAccounts(userId)

    for (const requested of accounts) {
      try {
        if (!requested?.platformAccountId) {
          results.push({
            platformAccountId: 'unknown',
            username: 'unknown',
            success: false,
            error: 'Missing required fields'
          })
          continue
        }

        // Only the account's id (and platform) are read from the request: its token and details are the server's
        const account = userAccounts.find(candidate =>
          candidate.platformAccountId === requested.platformAccountId &&
          (!requested.platform || candidate.platform === requested.platform))
        if (!account) {
          results.push({
            platformAccountId: requested.platformAccountId,
            username: 'unknown',
            success: false,
            error: 'Account not found among your connected accounts'
          })
          continue
        }

        const tokenExpiresAt = new Date(account.tokenExpiresAt)
        let socialAccountId = account.socialAccountId

        // STEP 1: An account found through Graph gets its own social_accounts row (USER level - plugin-owned table)
        if (!account.stored) {
          const encryptedToken = await TokenEncryption.encrypt(account.accessToken)
          const tokenString = `${encryptedToken.encrypted}:${encryptedToken.iv}:${encryptedToken.keyId}`
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
             WHERE "social_accounts"."userId" = EXCLUDED."userId"
             RETURNING id`,
            [
              userId,
              account.platform,
              account.platformAccountId,
              account.username,
              tokenString,
              tokenExpiresAt.toISOString(),
              JSON.stringify(account.permissions),
              JSON.stringify(account.accountMetadata),
            ],
            userId
          )

          // No row: the account's row is another user's, and the upsert left it as it is
          const rowId = socialAccountResult?.rows?.[0]?.id
          if (!rowId) {
            console.warn(`[assign-accounts] ${account.platformAccountId} has a social_accounts row of another user: not assigned`)
            results.push({
              platformAccountId: account.platformAccountId,
              username: account.username,
              success: false,
              error: ACCOUNT_CONNECTED_ELSEWHERE
            })
            continue
          }
          socialAccountId = rowId
          console.log(`[assign-accounts] ✅ Saved to social_accounts: ${account.username} (${socialAccountId})`)
        }

        // STEP 2: Link via adapter (ENTITY level - theme-owned)
        const assignmentResult = await adapter.saveAssignment({
          entityId,
          platform: account.platform,
          platformAccountId: account.platformAccountId,
          username: account.username,
          accessToken: account.accessToken, // the server's token; the adapter will encrypt it
          tokenExpiresAt,
          permissions: account.permissions,
          accountMetadata: account.accountMetadata,
          socialAccountId
        }, userId)

        console.log(`[assign-accounts] ✅ Linked to entity: ${account.username} (${assignmentResult.isNew ? 'new' : 'updated'})`)

        // Create audit log (plugin-owned)
        await recordAuditLog(request, {
          userId,
          teamId,
          accountId: socialAccountId,
          action: 'account_assigned',
          details: {
            entityId,
            entitySlug: adapter.getEntitySlug(),
            platform: account.platform,
            accountName: account.username,
            success: true,
            isNewAssignment: assignmentResult.isNew,
            assignedAt: new Date().toISOString()
          },
        })

        results.push({
          platformAccountId: account.platformAccountId,
          username: account.username,
          success: true
        })

      } catch (error) {
        console.error(`[assign-accounts] Error processing ${requested?.platformAccountId}:`, error)
        results.push({
          platformAccountId: requested?.platformAccountId || 'unknown',
          username: 'unknown',
          success: false,
          error: 'Failed to assign the account'
        })
      }
    }

    // 5. Return results
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    console.log(`[assign-accounts] Completed: ${successCount} success, ${failureCount} failures`)

    return NextResponse.json({
      success: successCount > 0,
      message: `Assigned ${successCount} of ${accounts.length} accounts`,
      entitySlug: adapter.getEntitySlug(),
      entityId,
      results,
      stats: {
        total: accounts.length,
        success: successCount,
        failed: failureCount
      }
    })

  } catch (error) {
    console.error('[assign-accounts] Error:', error)
    return NextResponse.json(
      { error: 'Failed to assign accounts' },
      { status: 500 }
    )
  }
}

export const POST = withRateLimitTier(postHandler, 'write')

export const OPTIONS = corsPreflight
