'use client'

import { useQuery } from '@tanstack/react-query'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'

interface MetricsResponse {
  success: boolean
  totalTraces: number
  successTraces: number
  errorTraces: number
  avgLatency: number
  totalTokens: number
}

async function fetchMetrics(period: string): Promise<MetricsResponse> {
  const response = await fetch(withBasePath(`/api/v1/plugin/langchain/observability/metrics?period=${period}`))

  if (!response.ok) {
    throw new Error('Failed to fetch metrics')
  }

  return response.json()
}

export function useMetrics(period: string = '24h') {
  return useQuery({
    queryKey: ['observability', 'metrics', period],
    queryFn: () => fetchMetrics(period),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000,
  })
}
