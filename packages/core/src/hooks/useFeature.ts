import { useSubscription } from './useSubscription'

/**
 * Hook to check if a feature is available on the current plan
 *
 * @param featureSlug - The slug of the feature to check (e.g., 'advanced_analytics')
 * @returns boolean - Whether the feature is available
 *
 * @example
 * ```tsx
 * const hasAdvancedAnalytics = useFeature('advanced_analytics')
 * if (hasAdvancedAnalytics) {
 *   // Show advanced analytics UI
 * }
 * ```
 */
export function useFeature(featureSlug: string): boolean {
  const { plan, isLoading } = useSubscription()

  if (isLoading || !plan) {
    return false
  }

  // Enterprise plans with '*' have all features
  if (plan.features.includes('*')) {
    return true
  }

  return plan.features.includes(featureSlug)
}
