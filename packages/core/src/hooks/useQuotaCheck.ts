'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchWithTeam } from '../lib/api/entities'

interface QuotaCheckResult {
  allowed: boolean
  reason?: string
  message?: string
  meta?: {
    limitSlug?: string
    remaining?: number
    requiredFeature?: string
    currentPlan?: string
  }
}

/**
 * Hook to check if the current team can perform a billing action.
 * Used to gate entity creation based on plan limits.
 *
 * @param action - The action to check (e.g., 'professionals.create')
 * @param enabled - Whether to run the check (default: true)
 *
 * @example
 * const { canCreate, isLoading, reason } = useQuotaCheck('professionals.create')
 * if (!canCreate) showUpgradeBanner()
 */
export function useQuotaCheck(action: string, enabled = true) {
  const { data, isLoading } = useQuery<QuotaCheckResult>({
    queryKey: ['quota-check', action],
    queryFn: async () => {
      const res = await fetchWithTeam('/api/v1/billing/check-action', {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      // An action no mapping names has no quota to exceed: this gate lets it through (the endpoint refuses it, #367)
      if (!json.data || json.data.reason === 'unknown_action') return { allowed: true }
      return json.data
    },
    enabled,
    staleTime: 30_000, // Cache for 30s
    retry: false,
  })

  return {
    canCreate: data?.allowed ?? true, // Default to true while loading
    isLoading,
    reason: data?.reason,
    message: data?.message,
    meta: data?.meta,
    isQuotaExceeded: data?.reason === 'quota_exceeded',
    isFeatureBlocked: data?.reason === 'feature_not_in_plan',
  }
}
