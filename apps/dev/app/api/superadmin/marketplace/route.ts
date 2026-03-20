/**
 * Superadmin Marketplace Overview
 *
 * GET /api/superadmin/marketplace?page=1&limit=20&status=active
 * Returns connected accounts overview with stats for platform admins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthError } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { query, queryOne } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  // 1. Authentication + superadmin check
  const authResult = await authenticateRequest(request)
  if (!authResult.success || !authResult.user) {
    return createAuthError('Unauthorized', 401)
  }

  // Check superadmin role
  const user = await queryOne<{ role: string }>(
    'SELECT role FROM "users" WHERE id = $1',
    [authResult.user.id]
  )
  if (!user || (user.role !== 'superadmin' && user.role !== 'developer')) {
    return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 })
  }

  // 2. Parse params
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const status = searchParams.get('status')
  const offset = (page - 1) * limit

  // 3. Stats
  const statsResult = await queryOne<{
    totalAccounts: string
    activeAccounts: string
    pendingAccounts: string
  }>(`
    SELECT
      COUNT(*) as "totalAccounts",
      COUNT(*) FILTER (WHERE "onboardingStatus" = 'active') as "activeAccounts",
      COUNT(*) FILTER (WHERE "onboardingStatus" IN ('pending', 'in_progress')) as "pendingAccounts"
    FROM "connectedAccounts"
  `)

  const paymentStatsResult = await queryOne<{
    totalVolume: string
    totalCommission: string
    totalPayments: string
    succeededPayments: string
    disputedPayments: string
  }>(`
    SELECT
      COALESCE(SUM("totalAmount"), 0) as "totalVolume",
      COALESCE(SUM("applicationFee"), 0) as "totalCommission",
      COUNT(*) as "totalPayments",
      COUNT(*) FILTER (WHERE status = 'succeeded') as "succeededPayments",
      COUNT(*) FILTER (WHERE status = 'disputed') as "disputedPayments"
    FROM "marketplacePayments"
  `)

  // 4. Accounts list with team info
  let accountsQuery = `
    SELECT
      ca.id, ca."teamId", t.name as "teamName", ca.provider,
      ca."businessName", ca.email, ca.country, ca.currency,
      ca."onboardingStatus", ca."chargesEnabled", ca."commissionRate",
      ca."createdAt"
    FROM "connectedAccounts" ca
    LEFT JOIN "teams" t ON t.id = ca."teamId"
  `
  const params: (string | number)[] = []

  if (status) {
    accountsQuery += ` WHERE ca."onboardingStatus" = $1`
    params.push(status)
  }

  accountsQuery += ` ORDER BY ca."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(limit, offset)

  const accounts = await query(accountsQuery, params)

  // Total for pagination
  let countQuery = `SELECT COUNT(*) as count FROM "connectedAccounts"`
  const countParams: string[] = []
  if (status) {
    countQuery += ` WHERE "onboardingStatus" = $1`
    countParams.push(status)
  }
  const countResult = await queryOne<{ count: string }>(countQuery, countParams)
  const total = parseInt(countResult?.count ?? '0', 10)

  return NextResponse.json({
    stats: {
      totalAccounts: parseInt(statsResult?.totalAccounts ?? '0', 10),
      activeAccounts: parseInt(statsResult?.activeAccounts ?? '0', 10),
      pendingAccounts: parseInt(statsResult?.pendingAccounts ?? '0', 10),
      totalVolume: parseInt(paymentStatsResult?.totalVolume ?? '0', 10),
      totalCommission: parseInt(paymentStatsResult?.totalCommission ?? '0', 10),
      totalPayments: parseInt(paymentStatsResult?.totalPayments ?? '0', 10),
      succeededPayments: parseInt(paymentStatsResult?.succeededPayments ?? '0', 10),
      disputedPayments: parseInt(paymentStatsResult?.disputedPayments ?? '0', 10),
    },
    accounts: (accounts as any).rows || accounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}, 'read')
