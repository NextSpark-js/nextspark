/**
 * GET /api/langchain/observability/traces/[traceId]
 *
 * Get trace detail with spans and child traces.
 * Admin access required (superadmin or developer).
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import type { Trace, Span } from '../../../../types/observability.types'

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

interface SpanRow {
  spanId: string
  traceId: string
  parentSpanId: string | null
  name: string
  type: 'llm' | 'tool' | 'chain' | 'retriever'
  provider: string | null
  model: string | null
  inputTokens: number | null
  outputTokens: number | null
  toolName: string | null
  toolInput: unknown | null
  toolOutput: unknown | null
  input: unknown | null
  output: unknown | null
  status: 'running' | 'success' | 'error'
  error: string | null
  startedAt: Date
  endedAt: Date | null
  durationMs: number | null
  depth: number
  createdAt: Date
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ traceId: string }> }
) {
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
    const { traceId } = await params

    // 2. Get trace
    const traceQuery = `
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
      WHERE "traceId" = $1
    `

    const traceRows = await queryWithRLS<TraceRow>(
      traceQuery,
      [traceId],
      authResult.user.id
    )

    if (traceRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Trace not found' },
        { status: 404 }
      )
    }

    const traceRow = traceRows[0]

    // 3. Get spans for this trace
    const spansQuery = `
      SELECT
        "spanId",
        "traceId",
        "parentSpanId",
        name,
        type,
        provider,
        model,
        "inputTokens",
        "outputTokens",
        "toolName",
        "toolInput",
        "toolOutput",
        input,
        output,
        status,
        error,
        "startedAt",
        "endedAt",
        "durationMs",
        depth,
        "createdAt"
      FROM public."langchain_spans"
      WHERE "traceId" = $1
      ORDER BY "startedAt" ASC
    `

    const spanRows = await queryWithRLS<SpanRow>(
      spansQuery,
      [traceId],
      authResult.user.id
    )

    // 4. Get child traces
    const childTracesQuery = `
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
      WHERE "parentId" = $1
      ORDER BY "startedAt" ASC
    `

    const childTraceRows = await queryWithRLS<TraceRow>(
      childTracesQuery,
      [traceId],
      authResult.user.id
    )

    // 4.5. Get spans for each child trace (for timeline display)
    const childSpansMap: Record<string, Span[]> = {}
    if (childTraceRows.length > 0) {
      const childTraceIds = childTraceRows.map((row) => row.traceId)
      const childSpansQuery = `
        SELECT
          "spanId",
          "traceId",
          "parentSpanId",
          name,
          type,
          provider,
          model,
          "inputTokens",
          "outputTokens",
          "toolName",
          "toolInput",
          "toolOutput",
          input,
          output,
          status,
          error,
          "startedAt",
          "endedAt",
          "durationMs",
          depth,
          "createdAt"
        FROM public."langchain_spans"
        WHERE "traceId" = ANY($1)
        ORDER BY "traceId", "startedAt" ASC
      `
      const childSpanRows = await queryWithRLS<SpanRow>(
        childSpansQuery,
        [childTraceIds],
        authResult.user.id
      )

      // Group spans by traceId
      for (const row of childSpanRows) {
        if (!childSpansMap[row.traceId]) {
          childSpansMap[row.traceId] = []
        }
        childSpansMap[row.traceId].push({
          spanId: row.spanId,
          traceId: row.traceId,
          parentSpanId: row.parentSpanId || undefined,
          name: row.name,
          type: row.type,
          provider: row.provider || undefined,
          model: row.model || undefined,
          inputTokens: row.inputTokens || undefined,
          outputTokens: row.outputTokens || undefined,
          toolName: row.toolName || undefined,
          toolInput: row.toolInput,
          toolOutput: row.toolOutput,
          input: row.input,
          output: row.output,
          status: row.status,
          error: row.error || undefined,
          startedAt: row.startedAt.toISOString(),
          endedAt: row.endedAt?.toISOString(),
          durationMs: row.durationMs || undefined,
          depth: row.depth,
          createdAt: row.createdAt.toISOString(),
        })
      }
    }

    // 5. Get parent trace if this is a child trace
    let parentTrace: { traceId: string; agentName: string } | undefined
    if (traceRow.parentId) {
      const parentQuery = `
        SELECT "traceId", "agentName"
        FROM public."langchain_traces"
        WHERE "traceId" = $1
      `
      const parentRows = await queryWithRLS<{ traceId: string; agentName: string }>(
        parentQuery,
        [traceRow.parentId],
        authResult.user.id
      )
      if (parentRows.length > 0) {
        parentTrace = {
          traceId: parentRows[0].traceId,
          agentName: parentRows[0].agentName,
        }
      }
    }

    // 6. Format response
    const trace: Trace = {
      traceId: traceRow.traceId,
      userId: traceRow.userId,
      teamId: traceRow.teamId,
      sessionId: traceRow.sessionId || undefined,
      agentName: traceRow.agentName,
      agentType: traceRow.agentType || undefined,
      parentId: traceRow.parentId || undefined,
      input: traceRow.input,
      output: traceRow.output || undefined,
      status: traceRow.status,
      error: traceRow.error || undefined,
      errorType: traceRow.errorType || undefined,
      errorStack: traceRow.errorStack || undefined,
      startedAt: traceRow.startedAt.toISOString(),
      endedAt: traceRow.endedAt?.toISOString(),
      durationMs: traceRow.durationMs || undefined,
      inputTokens: traceRow.inputTokens,
      outputTokens: traceRow.outputTokens,
      totalTokens: traceRow.totalTokens,
      totalCost: traceRow.totalCost,
      llmCalls: traceRow.llmCalls,
      toolCalls: traceRow.toolCalls,
      metadata: traceRow.metadata,
      tags: traceRow.tags || undefined,
      createdAt: traceRow.createdAt.toISOString(),
    }

    const spans: Span[] = spanRows.map((row) => ({
      spanId: row.spanId,
      traceId: row.traceId,
      parentSpanId: row.parentSpanId || undefined,
      name: row.name,
      type: row.type,
      provider: row.provider || undefined,
      model: row.model || undefined,
      inputTokens: row.inputTokens || undefined,
      outputTokens: row.outputTokens || undefined,
      toolName: row.toolName || undefined,
      toolInput: row.toolInput,
      toolOutput: row.toolOutput,
      input: row.input,
      output: row.output,
      status: row.status,
      error: row.error || undefined,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString(),
      durationMs: row.durationMs || undefined,
      depth: row.depth,
      createdAt: row.createdAt.toISOString(),
    }))

    const childTraces: Trace[] = childTraceRows.map((row) => ({
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
        trace,
        spans,
        childTraces,
        childSpansMap,
        parentTrace,
      },
    })
  } catch (error) {
    console.error('[Observability API] Get trace detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get trace detail' },
      { status: 500 }
    )
  }
}
