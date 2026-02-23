'use client'

import { useWalkmeContext } from '../providers/walkme-context'

/**
 * Hook for accessing the state of a specific tour.
 *
 * @param tourId - The ID of the tour to track
 *
 * @example
 * ```tsx
 * const { isCompleted, progress, start } = useTour('onboarding')
 *
 * if (!isCompleted) {
 *   return <button onClick={start}>Start Onboarding</button>
 * }
 * ```
 */
export function useTour(tourId: string) {
  const ctx = useWalkmeContext()
  const tour = ctx.state.tours[tourId] ?? null
  const isActive = ctx.state.activeTour?.tourId === tourId
  const isCompleted = ctx.state.completedTours.includes(tourId)
  const isSkipped = ctx.state.skippedTours.includes(tourId)
  const currentStep = isActive ? (ctx.state.activeTour?.currentStepIndex ?? -1) : -1
  const totalSteps = tour?.steps.length ?? 0
  const progress =
    totalSteps > 0 && currentStep >= 0
      ? Math.round(((currentStep + 1) / totalSteps) * 100)
      : 0

  return {
    /** The full tour definition (null if not found) */
    tour,
    /** Whether this tour is currently active */
    isActive,
    /** Whether this tour has been completed */
    isCompleted,
    /** Whether this tour has been skipped */
    isSkipped,
    /** Current step index (-1 if not active) */
    currentStep,
    /** Total number of steps */
    totalSteps,
    /** Progress percentage (0-100) */
    progress,
    /** Start this tour */
    start: () => ctx.startTour(tourId),
    /** Reset this tour (remove from completed/skipped) */
    reset: () => ctx.resetTour(tourId),
  }
}
