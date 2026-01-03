import { useSubscription } from './useSubscription'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import type { QuotaInfo } from '../lib/billing/types'

/**
 * Unified hook providing subscription, features, limits, and canDo() method
 *
 * This hook integrates RBAC permissions (from TeamContext), feature access (from Plan),
 * and quota enforcement (from Limits) into a single DX-friendly interface.
 *
 * FIX2: Refactored to avoid React hooks violations:
 * - hasFeature() now uses cached features from context (no hook calls)
 * - getQuota() returns sync cached data
 * - Added getQuotaAsync() for full quota info with current usage
 *
 * @example
 * ```tsx
 * const membership = useMembership()
 *
 * // Check subscription info
 * console.log(membership.plan.name) // 'Pro'
 * console.log(membership.subscription.status) // 'active'
 *
 * // Check feature access (sync, cached)
 * if (membership.hasFeature('advanced_analytics')) {
 *   // Show analytics
 * }
 *
 * // Check quota limits (sync, cached)
 * const projectsLimit = membership.getQuota('projects')
 * console.log(projectsLimit.max, projectsLimit.resetPeriod)
 *
 * // Get full quota info with current usage (async)
 * const projectsQuota = await membership.getQuotaAsync('projects')
 * console.log(projectsQuota.current, projectsQuota.max)
 *
 * // Unified permission check (Permission + Feature + Quota)
 * const canCreateProject = await membership.canDo('projects.create')
 * if (canCreateProject.allowed) {
 *   // Create project
 * } else {
 *   toast.error(canCreateProject.reason)
 * }
 * ```
 */
export function useMembership() {
  const subscriptionContext = useSubscription()

  return {
    // Subscription info
    plan: subscriptionContext.plan,
    subscription: subscriptionContext.subscription,
    status: subscriptionContext.status,
    isTrialing: subscriptionContext.isTrialing,
    isActive: subscriptionContext.isActive,
    isPastDue: subscriptionContext.isPastDue,
    isCanceled: subscriptionContext.isCanceled,
    isLoading: subscriptionContext.isLoading,

    // Feature check (FIX2: No hook calls, uses cached features)
    hasFeature: (featureSlug: string): boolean => {
      // Check cached features array from context
      if (subscriptionContext.features.includes('*')) return true
      return subscriptionContext.features.includes(featureSlug)
    },

    // Quota check (FIX2: Returns sync cached data)
    getQuota: (limitSlug: string): { max: number; resetPeriod: string } | null => {
      // Return cached limit info if available
      const limitInfo = subscriptionContext.limits[limitSlug]
      if (!limitInfo) return null

      return {
        max: limitInfo.max,
        resetPeriod: limitInfo.resetPeriod
      }
    },

    // NEW: Async version for full quota info with current usage
    getQuotaAsync: async (limitSlug: string): Promise<QuotaInfo | null> => {
      if (!subscriptionContext.subscription?.teamId) return null

      try {
        const response = await fetch(
          `/api/v1/teams/${subscriptionContext.subscription.teamId}/usage/${limitSlug}`
        )

        if (!response.ok) return null

        const data = await response.json()
        return data.data
      } catch (error) {
        console.error('Error fetching quota:', error)
        return null
      }
    },

    // Unified permission check (Permission + Feature + Quota)
    canDo: async (action: string): Promise<{ allowed: boolean; reason?: string }> => {
      try {
        // Resolve action mappings from registry
        const permissionMapping = BILLING_REGISTRY.actionMappings.permissions?.[action]
        const featureMapping = BILLING_REGISTRY.actionMappings.features?.[action]
        const limitMapping = BILLING_REGISTRY.actionMappings.limits?.[action]

        // If no mappings exist, allow by default (action not configured for billing checks)
        if (!permissionMapping && !featureMapping && !limitMapping) {
          return { allowed: true }
        }

        // Call server-side check-action endpoint (FIX1)
        // This endpoint verifies: RBAC permission + Feature + Quota
        const response = await fetch('/api/v1/billing/check-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        })

        if (!response.ok) {
          return { allowed: false, reason: 'Failed to check action permission' }
        }

        const data = await response.json()
        return data.data
      } catch (error) {
        console.error('Error checking action:', error)
        return { allowed: false, reason: 'Error checking permission' }
      }
    },

    // Refresh subscription data
    refetch: subscriptionContext.refetch
  }
}
