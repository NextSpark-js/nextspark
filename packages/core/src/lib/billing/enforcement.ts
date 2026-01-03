/**
 * Billing Enforcement Module
 *
 * Handles downgrade policy enforcement and quota checks.
 * Policy: Soft limit - existing resources remain, new ones blocked until under limit.
 *
 * P3: Downgrade Enforcement
 */

// Direct import to avoid circular dependency: services/index -> subscription.service -> enforcement -> services/index
import { SubscriptionService } from '../services/subscription.service'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import type { QuotaInfo } from './types'

export interface DowngradeCheck {
  canDowngrade: boolean
  overLimits: Array<{
    limitSlug: string
    limitName: string
    current: number
    newMax: number
    excess: number
  }>
  warnings: string[]
}

/**
 * Check if team can downgrade to a target plan
 * Returns info about any resources that exceed new limits
 *
 * Policy: Soft limit - downgrade is always allowed, but over-limit resources are read-only
 */
export async function checkDowngrade(teamId: string, targetPlanSlug: string): Promise<DowngradeCheck> {
  const subscription = await SubscriptionService.getActive(teamId)

  // No subscription = can always "downgrade" (it's really just subscribing)
  if (!subscription) {
    return { canDowngrade: true, overLimits: [], warnings: [] }
  }

  const targetPlan = BILLING_REGISTRY.plans.find(p => p.slug === targetPlanSlug)
  if (!targetPlan) {
    return { canDowngrade: false, overLimits: [], warnings: ['Target plan not found'] }
  }

  const overLimits: DowngradeCheck['overLimits'] = []
  const warnings: string[] = []

  // Check each limit in target plan
  for (const [limitSlug, newMax] of Object.entries(targetPlan.limits)) {
    if (newMax === -1) continue // Unlimited, no issue

    const currentQuota = await SubscriptionService.checkQuota(teamId, limitSlug)
    if (currentQuota.current > newMax) {
      const limitConfig = BILLING_REGISTRY.limits[limitSlug]

      overLimits.push({
        limitSlug,
        limitName: limitConfig?.name || limitSlug,
        current: currentQuota.current,
        newMax,
        excess: currentQuota.current - newMax
      })
    }
  }

  // Soft limit policy: Always allow downgrade but with warnings
  if (overLimits.length > 0) {
    warnings.push(
      'Some resources exceed new plan limits. Existing resources will remain accessible. You will not be able to create new ones until you are under the limit.'
    )
  }

  return {
    canDowngrade: true, // Soft limit: always allow
    overLimits,
    warnings
  }
}

/**
 * Enhanced quota check that considers enforcement policy
 * Used when user is over limit after downgrade
 */
export async function checkQuotaWithEnforcement(
  teamId: string,
  limitSlug: string
): Promise<QuotaInfo & { enforced: boolean; enforcementReason?: string }> {
  const quota = await SubscriptionService.checkQuota(teamId, limitSlug)

  // If already under limit, no enforcement needed
  if (quota.allowed) {
    return { ...quota, enforced: false }
  }

  // Over limit - enforce by blocking new resources
  // Policy: Existing resources remain, new blocked
  return {
    ...quota,
    allowed: false,
    enforced: true,
    enforcementReason: 'over_limit_after_downgrade'
  }
}
