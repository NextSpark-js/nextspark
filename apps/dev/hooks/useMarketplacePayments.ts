'use client'

import { useQuery } from '@tanstack/react-query'
import { useTeam } from '@nextsparkjs/core/hooks/useTeam'

// ===========================================
// TYPES
// ===========================================

export interface MarketplacePayment {
  id: string
  referenceId: string
  referenceType: string
  totalAmount: number
  applicationFee: number
  businessAmount: number
  currency: string
  commissionRate: number
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'disputed' | 'canceled'
  statusDetail: string | null
  paymentMethod: string | null
  paymentType: string | null
  refundedAmount: number
  paidAt: string | null
  createdAt: string
}

interface MarketplacePaymentsResponse {
  success: boolean
  data: MarketplacePayment[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface UseMarketplacePaymentsOptions {
  page?: number
  limit?: number
  status?: string
  enabled?: boolean
}

// ===========================================
// HOOK
// ===========================================

/**
 * Fetch marketplace payments for the current team's connected account.
 *
 * @example
 * const { payments, total, isLoading } = useMarketplacePayments({ page: 1, limit: 20 })
 */
export function useMarketplacePayments(options: UseMarketplacePaymentsOptions = {}) {
  const { teamId } = useTeam()
  const { page = 1, limit = 20, status, enabled = true } = options

  const query = useQuery<MarketplacePaymentsResponse>({
    queryKey: ['marketplace-payments', teamId, page, limit, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (status) params.set('status', status)

      const response = await fetch(`/api/v1/marketplace/payments?${params}`, {
        headers: teamId ? { 'x-team-id': teamId } : {},
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch' }))
        throw new Error(error.error || 'Failed to fetch marketplace payments')
      }
      return response.json()
    },
    enabled: enabled && !!teamId,
    staleTime: 30 * 1000,
    retry: 1,
  })

  return {
    ...query,
    payments: query.data?.data ?? [],
    total: query.data?.pagination?.total ?? 0,
    totalPages: query.data?.pagination?.totalPages ?? 0,
  }
}
