'use client'

import { useQuery } from '@tanstack/react-query'
import { useTeam } from './useTeam'
import type { Invoice } from '../components/billing'

interface UseInvoicesOptions {
  limit?: number
  offset?: number
  enabled?: boolean
}

interface InvoicesResponse {
  success: boolean
  data: Invoice[]
  info: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export function useInvoices(options: UseInvoicesOptions = {}) {
  const { teamId } = useTeam()
  const { limit = 10, offset = 0, enabled = true } = options

  return useQuery<InvoicesResponse>({
    queryKey: ['invoices', teamId, limit, offset],
    queryFn: async () => {
      if (!teamId) {
        throw new Error('No active team')
      }

      const response = await fetch(
        `/api/v1/teams/${teamId}/invoices?limit=${limit}&offset=${offset}`
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch invoices' }))
        throw new Error(error.message || 'Failed to fetch invoices')
      }

      return response.json()
    },
    enabled: enabled && !!teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes - invoices don't change frequently
    retry: 1, // Only retry once for this read-only operation
  })
}
