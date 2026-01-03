'use client'

import { useQuery } from '@tanstack/react-query'
import type { Trace } from '../../types/observability.types'

interface TracesFilters {
  status?: string
  agent?: string
  teamId?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

interface TracesApiResponse {
  success: boolean
  data: {
    traces: Trace[]
    hasMore: boolean
    nextCursor?: string
  }
}

interface TracesResponse {
  traces: Trace[]
  hasMore: boolean
  nextCursor?: string
}

async function fetchTraces(filters: TracesFilters): Promise<TracesResponse> {
  const params = new URLSearchParams()

  if (filters.status) params.append('status', filters.status)
  if (filters.agent) params.append('agent', filters.agent)
  if (filters.teamId) params.append('teamId', filters.teamId)
  if (filters.from) params.append('from', filters.from)
  if (filters.to) params.append('to', filters.to)
  if (filters.limit) params.append('limit', filters.limit.toString())
  if (filters.cursor) params.append('cursor', filters.cursor)

  const response = await fetch(`/api/v1/plugin/langchain/observability/traces?${params}`)

  if (!response.ok) {
    throw new Error('Failed to fetch traces')
  }

  const json: TracesApiResponse = await response.json()
  return json.data
}

export function useTraces(filters: TracesFilters = {}) {
  return useQuery({
    queryKey: ['observability', 'traces', filters],
    queryFn: () => fetchTraces(filters),
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 3000,
  })
}
