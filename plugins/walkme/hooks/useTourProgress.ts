'use client'

import { useWalkmeContext } from '../providers/walkme-context'

/**
 * Hook for tracking global tour completion progress.
 *
 * @example
 * ```tsx
 * const { completedTours, totalTours, percentage } = useTourProgress()
 *
 * return (
 *   <div>Onboarding: {percentage}% complete ({completedTours}/{totalTours})</div>
 * )
 * ```
 */
export function useTourProgress() {
  const ctx = useWalkmeContext()
  const totalTours = Object.keys(ctx.state.tours).length
  const completedTours = ctx.state.completedTours.length
  const percentage =
    totalTours > 0 ? Math.round((completedTours / totalTours) * 100) : 0

  return {
    /** Number of completed tours */
    completedTours,
    /** Total number of registered tours */
    totalTours,
    /** Completion percentage (0-100) */
    percentage,
    /** IDs of completed tours */
    completedTourIds: ctx.state.completedTours,
    /** IDs of skipped tours */
    skippedTourIds: ctx.state.skippedTours,
    /** Number of remaining tours */
    remainingTours: totalTours - completedTours,
  }
}
