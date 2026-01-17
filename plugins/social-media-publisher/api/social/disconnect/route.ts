/**
 * Social Media Disconnect Endpoint
 *
 * Disconnects a social media account (marks as inactive)
 * Accessible via: /api/v1/plugin/social-media-publisher/social/disconnect
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { DisconnectAccountSchema } from '../../../lib/validation'
import { queryOneWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

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
    const validation = DisconnectAccountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { accountId } = validation.data

    // 3. Get social account from database
    const account = await queryOneWithRLS<{
      id: string
      userId: string
      platform: string
      platformAccountId: string
      username: string
      isActive: boolean
    }>(
      `SELECT id, "userId", platform, "platformAccountId", "username", "isActive"
       FROM "social_accounts"
       WHERE id = $1 AND "userId" = $2`,
      [accountId, authResult.user!.id],
      authResult.user!.id
    )

    // Verify account exists
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
          error: 'Account already disconnected',
          message: 'This account is already inactive.',
        },
        { status: 400 }
      )
    }

    // 4. Mark account as inactive (soft delete)
    await mutateWithRLS(
      `UPDATE "social_accounts"
       SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1 AND "userId" = $2`,
      [accountId, authResult.user!.id],
      authResult.user!.id
    )

    console.log('[social-disconnect] ✅ Account marked as inactive:', {
      accountId,
      userId: authResult.user!.id,
      platform: account.platform,
      accountName: account.username,
    })

    // 5. Create audit log
    await mutateWithRLS(
      `INSERT INTO "audit_logs"
        ("userId", "accountId", action, details, "ipAddress", "userAgent")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        authResult.user!.id,
        accountId,
        'account_disconnected',
        JSON.stringify({
          platform: account.platform,
          accountName: account.username,
          success: true,
          disconnectedAt: new Date().toISOString()
        }),
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        request.headers.get('user-agent') || null
      ],
      authResult.user!.id
    )

    console.log('[social-disconnect] ✅ Audit log created:', {
      action: 'account_disconnected',
      platform: account.platform,
      success: true,
    })

    // 6. Return success
    return NextResponse.json({
      success: true,
      accountId,
      message: `Successfully disconnected ${account.username} (${account.platform})`,
    })
  } catch (error: unknown) {
    console.error('❌ Social disconnect error:', error)

    return NextResponse.json(
      {
        error: 'Failed to disconnect account',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = withRateLimitTier(postHandler, 'write')

/**
 * DELETE method - Alternative endpoint using accountId in URL
 */
const deleteHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) => {
  try {
    // 1. Authentication
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const accountId = resolvedParams.accountId

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID format' },
        { status: 400 }
      )
    }

    // Reuse POST logic
    const body = { accountId }
    return POST(
      new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(body),
      })
    )
  } catch (error: unknown) {
    console.error('❌ Social disconnect DELETE error:', error)

    return NextResponse.json(
      {
        error: 'Failed to disconnect account',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const DELETE = withRateLimitTier(deleteHandler, 'write')
