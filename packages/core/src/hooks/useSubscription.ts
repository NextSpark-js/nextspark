import { useSubscriptionContext } from '../contexts/SubscriptionContext'

/**
 * Hook to access subscription data
 *
 * @example
 * ```tsx
 * const { plan, status, isActive } = useSubscription()
 * ```
 */
export function useSubscription() {
  return useSubscriptionContext()
}
