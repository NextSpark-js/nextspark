/**
 * GET /api/langchain/observability/metrics
 *
 * Get basic metrics for a time period (MVP simple aggregation).
 * Admin access required (superadmin or developer).
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'

interface MetricsRow {
  totalTraces: string
  successTraces: string
  errorTraces: string
  avgLatency: string
  totalTokens: string
}

const PERIOD_HOURS: Record<string, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

const getHandler = async (req: NextRequest) => {
  // 1. Authenticate (superadmin only)
  const authResult = await authenticateRequest(req)
  if (!authResult.success || !authResult.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Check if user has admin-level access (superadmin or developer)
  const adminRoles = ['superadmin', 'developer']
  if (!adminRoles.includes(authResult.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Admin access required' },
      { status: 403 }
    )
  }

  try {
    // 2. Parse query parameters
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '24h'

    // Validate period
    if (!PERIOD_HOURS[period]) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Must be one of: 1h, 24h, 7d, 30d' },
        { status: 400 }
      )
    }

    const hours = PERIOD_HOURS[period]

    // 3. Query metrics (parameterized to prevent SQL injection)
    const query = `
      SELECT
        COUNT(*)::text AS "totalTraces",
        COUNT(*) FILTER (WHERE status = 'success')::text AS "successTraces",
        COUNT(*) FILTER (WHERE status = 'error')::text AS "errorTraces",
        COALESCE(AVG("durationMs"), 0)::text AS "avgLatency",
        COALESCE(SUM("totalTokens"), 0)::text AS "totalTokens"
      FROM public."langchain_traces"
      WHERE "startedAt" >= NOW() - INTERVAL '1 hour' * $1
    `

    const rows = await queryWithRLS<MetricsRow>(query, [hours], authResult.user.id)

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period,
          totalTraces: 0,
          successTraces: 0,
          errorTraces: 0,
          avgLatency: 0,
          totalTokens: 0,
        },
      })
    }

    const row = rows[0]

    // 4. Format response
    return NextResponse.json({
      success: true,
      data: {
        period,
        totalTraces: parseInt(row.totalTraces, 10),
        successTraces: parseInt(row.successTraces, 10),
        errorTraces: parseInt(row.errorTraces, 10),
        avgLatency: Math.round(parseFloat(row.avgLatency)),
        totalTokens: parseInt(row.totalTokens, 10),
      },
    })
  } catch (error) {
    console.error('[Observability API] Get metrics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get metrics' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimitTier(getHandler, 'read')
