/**
 * Assign Social Accounts to Entity
 *
 * POST endpoint that saves OAuth tokens to social_accounts (user level)
 * and creates links via the adapter (entity level).
 *
 * Accessible via: /api/v1/plugin/social-media-publisher/social/assign
 *
 * Body:
 * - entityId: Target entity ID (e.g., client ID)
 * - accounts: Array of account data to save
 *
 * Architecture:
 * 1. Upsert tokens to social_accounts (USER level - plugin-owned)
 * 2. Create/update links via adapter (ENTITY level - theme-owned)
 * 3. This enables token reuse across multiple entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { TokenEncryption } from '@nextsparkjs/core/lib/oauth/encryption'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'
import { getAdapter } from '../../../lib/adapter'

interface AccountToAssign {
  platform: string
  platformAccountId: string
  username: string
  accessToken: string
  tokenExpiresAt: string
  permissions: string[]
  accountMetadata: Record<string, unknown>
}

interface AssignRequest {
  entityId?: string
  clientId?: string // Legacy support
  accounts: AccountToAssign[]
}

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

    // 4. Process each account
    const results: Array<{
      platformAccountId: string
      username: string
      success: boolean
      error?: string
    }> = []

    for (const account of accounts) {
      try {
        // Validate required fields
        if (!account.platformAccountId || !account.platform || !account.accessToken) {
          results.push({
            platformAccountId: account.platformAccountId || 'unknown',
            username: account.username || 'unknown',
            success: false,
            error: 'Missing required fields'
          })
          continue
        }

        // Calculate token expiration
        const tokenExpiresAt = account.tokenExpiresAt
          ? new Date(account.tokenExpiresAt)
          : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days default

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
            JSON.stringify(account.permissions || []),
            JSON.stringify(account.accountMetadata || {}),
          ],
          userId
        )

        // Validate UPSERT result
        if (!socialAccountResult || !socialAccountResult.rows || socialAccountResult.rows.length === 0) {
          console.error(`[assign-accounts] UPSERT failed for ${account.username}: no rows returned`)
          results.push({
            platformAccountId: account.platformAccountId,
            username: account.username,
            success: false,
            error: 'Database operation failed'
          })
          continue
        }

        const socialAccountId = socialAccountResult.rows[0].id
        if (!socialAccountId) {
          console.error(`[assign-accounts] UPSERT returned row but no id for ${account.username}`)
          results.push({
            platformAccountId: account.platformAccountId,
            username: account.username,
            success: false,
            error: 'Failed to retrieve account id'
          })
          continue
        }

        console.log(`[assign-accounts] ✅ Saved to social_accounts: ${account.username} (${socialAccountId})`)

        // STEP 2: Link via adapter (ENTITY level - theme-owned)
        const assignmentResult = await adapter.saveAssignment({
          entityId,
          platform: account.platform,
          platformAccountId: account.platformAccountId,
          username: account.username,
          accessToken: account.accessToken, // Adapter will encrypt
          tokenExpiresAt,
          permissions: account.permissions || [],
          accountMetadata: account.accountMetadata || {},
          socialAccountId
        }, userId)

        console.log(`[assign-accounts] ✅ Linked to entity: ${account.username} (${assignmentResult.isNew ? 'new' : 'updated'})`)

        // Create audit log (plugin-owned)
        await mutateWithRLS(
          `INSERT INTO "audit_logs"
            ("userId", "accountId", action, details, "ipAddress", "userAgent")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            socialAccountId,
            'account_assigned',
            JSON.stringify({
              entityId,
              entitySlug: adapter.getEntitySlug(),
              platform: account.platform,
              accountName: account.username,
              success: true,
              isNewAssignment: assignmentResult.isNew,
              assignedAt: new Date().toISOString()
            }),
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            request.headers.get('user-agent') || null
          ],
          userId
        )

        results.push({
          platformAccountId: account.platformAccountId,
          username: account.username,
          success: true
        })

      } catch (error) {
        console.error(`[assign-accounts] Error processing ${account.username}:`, error)
        results.push({
          platformAccountId: account.platformAccountId,
          username: account.username,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
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
      {
        error: 'Failed to assign accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export const POST = withRateLimitTier(postHandler, 'write')
