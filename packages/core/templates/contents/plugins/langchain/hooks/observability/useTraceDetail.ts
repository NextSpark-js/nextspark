'use client'

import { useQuery } from '@tanstack/react-query'
import type { Trace, Span } from '../../types/observability.types'

interface ParentTraceInfo {
  traceId: string
  agentName: string
}

interface TraceDetailApiResponse {
  success: boolean
  data: {
    trace: Trace
    spans: Span[]
    childTraces: Trace[]
    childSpansMap: Record<string, Span[]>
    parentTrace?: ParentTraceInfo
  }
}

interface TraceDetailResponse {
  trace: Trace
  spans: Span[]
  childTraces: Trace[]
  childSpansMap: Record<string, Span[]>
  parentTrace?: ParentTraceInfo
}

async function fetchTraceDetail(traceId: string): Promise<TraceDetailResponse> {
  const response = await fetch(`/api/v1/plugin/langchain/observability/traces/${traceId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch trace detail')
  }

  const json: TraceDetailApiResponse = await response.json()
  return json.data
}

export function useTraceDetail(traceId: string | null) {
  return useQuery({
    queryKey: ['observability', 'trace', traceId],
    queryFn: () => fetchTraceDetail(traceId!),
    enabled: !!traceId,
    staleTime: 10000,
  })
}
