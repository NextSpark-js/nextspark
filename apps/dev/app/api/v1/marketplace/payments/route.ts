/**
 * Marketplace Payments List Endpoint
 *
 * GET /api/v1/marketplace/payments?page=1&limit=20&status=succeeded
 * Returns paginated list of marketplace payments for the current team.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { query, queryOne } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  // 1. Authentication
  const authResult = await authenticateRequest(request)
  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // 2. Team context
  const teamId = request.headers.get('x-team-id') || authResult.user.defaultTeamId
  if (!teamId) {
    return NextResponse.json(
      { success: false, error: 'No team context. Provide x-team-id header.' },
      { status: 400 }
    )
  }

  // 3. Permission check
  const membership = await MembershipService.get(authResult.user.id, teamId)
  const actionResult = membership.canPerformAction('billing.checkout')
  if (!actionResult.allowed) {
    return NextResponse.json(
      { success: false, error: actionResult.message },
      { status: 403 }
    )
  }

  // 4. Parse query params
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const status = searchParams.get('status')
  const offset = (page - 1) * limit

  // 5. Get connected account for this team
  const account = await queryOne<{ id: string }>(
    `SELECT id FROM "connectedAccounts" WHERE "teamId" = $1 LIMIT 1`,
    [teamId]
  )

  if (!account) {
    return NextResponse.json({
      success: true,
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    })
  }

  // 6. Count total
  let countQuery = `SELECT COUNT(*) as count FROM "marketplacePayments" WHERE "connectedAccountId" = $1`
  const countParams: (string | number)[] = [account.id]
  if (status) {
    countQuery += ` AND status = $2`
    countParams.push(status)
  }

  const countResult = await queryOne<{ count: string }>(countQuery, countParams)
  const total = parseInt(countResult?.count ?? '0', 10)

  // 7. Fetch payments
  let paymentsQuery = `
    SELECT id, "referenceId", "referenceType", "totalAmount", "applicationFee",
           "businessAmount", currency, "commissionRate", status, "statusDetail",
           "paymentMethod", "paymentType", "refundedAmount", "paidAt", "createdAt"
    FROM "marketplacePayments"
    WHERE "connectedAccountId" = $1
  `
  const params: (string | number)[] = [account.id]

  if (status) {
    paymentsQuery += ` AND status = $${params.length + 1}`
    params.push(status)
  }

  paymentsQuery += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(limit, offset)

  const payments = await query(paymentsQuery, params)

  return NextResponse.json({
    success: true,
    data: payments.rows || payments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}, 'read')
