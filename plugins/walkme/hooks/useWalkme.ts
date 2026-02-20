'use client'

import { useWalkmeContext } from '../providers/walkme-context'
import { getActiveTour, getActiveStep } from '../lib/core'

/**
 * Main public hook for controlling WalkMe tours.
 *
 * @example
 * ```tsx
 * const { startTour, isActive, nextStep } = useWalkme()
 *
 * return (
 *   <button onClick={() => startTour('onboarding')}>
 *     Start Tour
 *   </button>
 * )
 * ```
 */
export function useWalkme() {
  const ctx = useWalkmeContext()

  return {
    // Tour control
    startTour: ctx.startTour,
    pauseTour: ctx.pauseTour,
    resumeTour: ctx.resumeTour,
    skipTour: ctx.skipTour,
    completeTour: ctx.completeTour,
    resetTour: ctx.resetTour,
    resetAllTours: ctx.resetAllTours,

    // Step navigation
    nextStep: ctx.nextStep,
    prevStep: ctx.prevStep,
    goToStep: ctx.goToStep,

    // State queries
    isActive: ctx.state.activeTour !== null,
    activeTourId: ctx.state.activeTour?.tourId ?? null,
    currentStepIndex: ctx.state.activeTour?.currentStepIndex ?? 0,

    // Tour info helpers
    getActiveTour: () => getActiveTour(ctx.state),
    getActiveStep: () => getActiveStep(ctx.state),
    isTourCompleted: ctx.isTourCompleted,
    isTourActive: ctx.isTourActive,

    // Custom events (for onEvent triggers)
    emitEvent: ctx.emitEvent,
  }
}
