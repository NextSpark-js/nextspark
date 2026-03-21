'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTeam } from '@nextsparkjs/core/hooks/useTeam'

// ===========================================
// TYPES
// ===========================================

export interface MarketplaceAccountData {
  id: string
  provider: string
  email: string
  businessName: string | null
  country: string
  currency: string
  onboardingStatus: 'pending' | 'in_progress' | 'active' | 'restricted' | 'disabled' | 'disconnected'
  chargesEnabled: boolean
  payoutsEnabled: boolean
  commissionRate: number
  fixedFee: number
  payoutSchedule: string
  createdAt: string
  dashboardUrl: string | null
  balance: {
    available: number
    pending: number
  } | null
}

interface MarketplaceAccountResponse {
  success: boolean
  data: {
    connected: boolean
    account: MarketplaceAccountData | null
  }
}

interface ConnectResponse {
  success: boolean
  data: {
    onboardingUrl: string
    accountId: string
    status: string
  }
}

// ===========================================
// HOOKS
// ===========================================

/**
 * Fetch the marketplace connected account for the current team.
 *
 * @example
 * const { account, isConnected, isLoading } = useMarketplaceAccount()
 */
export function useMarketplaceAccount() {
  const { teamId } = useTeam()

  const query = useQuery<MarketplaceAccountResponse>({
    queryKey: ['marketplace-account', teamId],
    queryFn: async () => {
      const response = await fetch('/api/v1/marketplace/account', {
        headers: teamId ? { 'x-team-id': teamId } : {},
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch' }))
        throw new Error(error.error || 'Failed to fetch marketplace account')
      }
      return response.json()
    },
    enabled: !!teamId,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  })

  return {
    ...query,
    account: query.data?.data?.account ?? null,
    isConnected: query.data?.data?.connected ?? false,
  }
}

/**
 * Mutation to connect a marketplace account (initiate onboarding).
 *
 * @example
 * const { connect, isConnecting } = useMarketplaceConnect()
 * connect({ country: 'US', businessName: 'My Salon' })
 */
export function useMarketplaceConnect() {
  const { teamId } = useTeam()
  const queryClient = useQueryClient()

  const mutation = useMutation<ConnectResponse, Error, { country: string; businessName?: string; businessType?: 'individual' | 'company' }>({
    mutationFn: async (params) => {
      const response = await fetch('/api/v1/marketplace/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(teamId ? { 'x-team-id': teamId } : {}),
        },
        body: JSON.stringify(params),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to connect' }))
        throw new Error(error.error || 'Failed to connect marketplace account')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-account', teamId] })
    },
  })

  return {
    connect: mutation.mutate,
    connectAsync: mutation.mutateAsync,
    isConnecting: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  }
}
