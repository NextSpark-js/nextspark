'use client'

import { createContext, useContext, ReactNode, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTeam } from '../hooks/useTeam'
import { SubscriptionWithPlan } from '../lib/billing/types'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'

interface LimitInfo {
  max: number
  resetPeriod: string
}

/**
 * CustomerProfile combines team metadata (who they are) with subscription data (what they have)
 * This enables feature flagging, segmentation, and personalized experiences
 */
export interface CustomerProfile {
  // Team metadata (quién es - business attributes)
  teamMetadata: Record<string, unknown>

  // Subscription data (qué tiene)
  plan: SubscriptionWithPlan['plan'] | null
  planSlug: string | null
  status: SubscriptionWithPlan['status'] | null
  isTrialing: boolean
  isActive: boolean

  // Features and limits from plan
  features: string[]
  limits: Record<string, LimitInfo>
}

export interface SubscriptionContextValue {
  subscription: SubscriptionWithPlan | null
  plan: SubscriptionWithPlan['plan'] | null
  planSlug: string | null
  status: SubscriptionWithPlan['status'] | null
  isTrialing: boolean
  isActive: boolean
  isPastDue: boolean
  isCanceled: boolean
  isLoading: boolean
  error: Error | null
  refetch: () => void
  // NEW: Cached features and limits for FIX2
  features: string[]
  limits: Record<string, LimitInfo>
  // NEW: CustomerProfile merge (team metadata + subscription data)
  customerProfile: CustomerProfile
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { team } = useTeam()

  // Fetch active subscription for current team
  const {
    data: subscription,
    isLoading,
    error,
    refetch
  } = useQuery<SubscriptionWithPlan | null>({
    queryKey: ['subscription', team?.id],
    queryFn: async () => {
      if (!team) return null

      const response = await fetch(`/api/v1/teams/${team.id}/subscription`)
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to fetch subscription')
      }

      const data = await response.json()
      // API returns { data: { subscription: {...} } }
      return data.data?.subscription ?? data.data
    },
    enabled: !!team,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  })

  // Compute features and limits from plan config (FIX2)
  const features = useMemo(() => {
    if (!subscription?.plan) return []

    const planConfig = BILLING_REGISTRY.plans.find(p => p.slug === subscription.plan.slug)
    return planConfig?.features ?? []
  }, [subscription?.plan])

  const limits = useMemo(() => {
    if (!subscription?.plan) return {}

    const planConfig = BILLING_REGISTRY.plans.find(p => p.slug === subscription.plan.slug)
    if (!planConfig) return {}

    const limitsObj: Record<string, LimitInfo> = {}

    for (const [limitSlug, max] of Object.entries(planConfig.limits)) {
      const limitConfig = BILLING_REGISTRY.limits[limitSlug]
      limitsObj[limitSlug] = {
        max,
        resetPeriod: limitConfig?.resetPeriod ?? 'never'
      }
    }

    return limitsObj
  }, [subscription?.plan])

  // Merge team metadata + subscription data into CustomerProfile
  const customerProfile: CustomerProfile = useMemo(() => ({
    // Team metadata (business attributes from teams.metadata JSONB)
    teamMetadata: (team as { metadata?: Record<string, unknown> })?.metadata ?? {},

    // Subscription data
    plan: subscription?.plan ?? null,
    planSlug: subscription?.plan?.slug ?? null,
    status: subscription?.status ?? null,
    isTrialing: subscription?.status === 'trialing',
    isActive: subscription?.status === 'active',

    // Features and limits from plan config
    features,
    limits
  }), [team, subscription, features, limits])

  const value: SubscriptionContextValue = {
    subscription: subscription ?? null,
    plan: subscription?.plan ?? null,
    planSlug: subscription?.plan?.slug ?? null,
    status: subscription?.status ?? null,
    isTrialing: subscription?.status === 'trialing',
    isActive: subscription?.status === 'active',
    isPastDue: subscription?.status === 'past_due',
    isCanceled: subscription?.status === 'canceled',
    isLoading,
    error: error as Error | null,
    refetch: () => {
      refetch()
    },
    features,
    limits,
    customerProfile
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider')
  }
  return context
}
