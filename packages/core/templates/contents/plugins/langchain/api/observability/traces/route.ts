/**
 * GET /api/langchain/observability/traces
 *
 * List traces with pagination and filters.
 * Admin access required (superadmin or developer).
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import type { Trace } from '../../../types/observability.types'

interface TraceRow {
  traceId: string
  userId: string
  teamId: string
  sessionId: string | null
  agentName: string
  agentType: string | null
  parentId: string | null
  input: string
  output: string | null
  status: 'running' | 'success' | 'error'
  error: string | null
  errorType: string | null
  errorStack: string | null
  startedAt: Date
  endedAt: Date | null
  durationMs: number | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost: number
  llmCalls: number
  toolCalls: number
  metadata: Record<string, unknown>
  tags: string[] | null
  createdAt: Date
}

export async function GET(req: NextRequest) {
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
    const status = searchParams.get('status')
    const agent = searchParams.get('agent')
    const teamId = searchParams.get('teamId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const cursor = searchParams.get('cursor')

    // 3. Build query
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (agent) {
      conditions.push(`"agentName" = $${paramIndex}`)
      params.push(agent)
      paramIndex++
    }

    if (teamId) {
      conditions.push(`"teamId" = $${paramIndex}`)
      params.push(teamId)
      paramIndex++
    }

    if (from) {
      conditions.push(`"startedAt" >= $${paramIndex}`)
      params.push(from)
      paramIndex++
    }

    if (to) {
      conditions.push(`"startedAt" <= $${paramIndex}`)
      params.push(to)
      paramIndex++
    }

    if (cursor) {
      conditions.push(`"createdAt" < $${paramIndex}`)
      params.push(cursor)
      paramIndex++
    }

    // Always filter to show only root traces (no parent)
    conditions.push(`"parentId" IS NULL`)

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Add limit + 1 to check if there are more results
    params.push(limit + 1)
    const limitClause = `LIMIT $${paramIndex}`

    const query = `
      SELECT
        "traceId",
        "userId",
        "teamId",
        "sessionId",
        "agentName",
        "agentType",
        "parentId",
        input,
        output,
        status,
        error,
        "errorType",
        "errorStack",
        "startedAt",
        "endedAt",
        "durationMs",
        "inputTokens",
        "outputTokens",
        "totalTokens",
        "totalCost",
        "llmCalls",
        "toolCalls",
        metadata,
        tags,
        "createdAt"
      FROM public."langchain_traces"
      ${whereClause}
      ORDER BY "createdAt" DESC
      ${limitClause}
    `

    const rows = await queryWithRLS<TraceRow>(query, params, authResult.user.id)

    // Check if there are more results
    const hasMore = rows.length > limit
    const traces = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? traces[traces.length - 1].createdAt.toISOString() : undefined

    // 4. Format response
    const formattedTraces: Trace[] = traces.map((row) => ({
      traceId: row.traceId,
      userId: row.userId,
      teamId: row.teamId,
      sessionId: row.sessionId || undefined,
      agentName: row.agentName,
      agentType: row.agentType || undefined,
      parentId: row.parentId || undefined,
      input: row.input,
      output: row.output || undefined,
      status: row.status,
      error: row.error || undefined,
      errorType: row.errorType || undefined,
      errorStack: row.errorStack || undefined,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString(),
      durationMs: row.durationMs || undefined,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
      llmCalls: row.llmCalls,
      toolCalls: row.toolCalls,
      metadata: row.metadata,
      tags: row.tags || undefined,
      createdAt: row.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        traces: formattedTraces,
        hasMore,
        nextCursor,
      },
    })
  } catch (error) {
    console.error('[Observability API] List traces error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list traces' },
      { status: 500 }
    )
  }
}
