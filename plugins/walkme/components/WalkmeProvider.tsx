'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WalkmeContext } from '../providers/walkme-context'
import { useTourState } from '../hooks/useTourState'
import { validateTours } from '../lib/validation'
import { shouldTriggerTour, type TriggerEvaluationContext } from '../lib/triggers'
import { evaluateConditions } from '../lib/conditions'
import {
  getActiveTour,
  getActiveStep,
  isFirstStep,
  isLastStep,
} from '../lib/core'
import { findTarget, waitForTarget, scrollToElement } from '../lib/targeting'
import type {
  WalkmeProviderProps,
  WalkmeContextValue,
  TourEvent,
  ConditionContext,
  WalkmeLabels,
} from '../types/walkme.types'
import { WalkmeOverlay } from './WalkmeOverlay'
import { WalkmeTooltip } from './WalkmeTooltip'
import { WalkmeModal } from './WalkmeModal'
import { WalkmeSpotlight } from './WalkmeSpotlight'
import { WalkmeBeacon } from './WalkmeBeacon'

/**
 * WalkMe Provider Component
 *
 * Wraps the application (or a section) to provide guided tour functionality.
 * Manages tour state, trigger evaluation, cross-page navigation, and rendering.
 *
 * @example
 * ```tsx
 * <WalkmeProvider tours={[introTour, featureTour]} autoStart>
 *   <App />
 * </WalkmeProvider>
 * ```
 */
const DEFAULT_LABELS: WalkmeLabels = {
  next: 'Next',
  prev: 'Previous',
  skip: 'Skip',
  complete: 'Complete',
  close: 'Close',
  progress: 'Step {current} of {total}',
  tourAvailable: 'Tour available',
}

export function WalkmeProvider({
  tours: rawTours,
  children,
  debug = false,
  autoStart = true,
  autoStartDelay = 1000,
  persistState = true,
  onTourStart,
  onTourComplete,
  onTourSkip,
  onStepChange,
  conditionContext: externalConditionContext,
  labels: userLabels,
}: WalkmeProviderProps) {
  const labels = useMemo<WalkmeLabels>(
    () => ({ ...DEFAULT_LABELS, ...userLabels }),
    [userLabels],
  )

  const pathname = usePathname()
  const router = useRouter()
  const prevPathRef = useRef(pathname)
  const customEventsRef = useRef<Set<string>>(new Set())
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const triggerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetElementRef = useRef<HTMLElement | null>(null)

  // Validate tours on mount
  const validatedTours = useMemo(() => {
    const result = validateTours(rawTours)
    if (!result.valid && debug) {
      console.warn(
        '[WalkMe] Some tours failed validation and were excluded:',
        result.errors,
      )
    }
    return result.validTours
  }, [rawTours, debug])

  // Core state management
  const { state, dispatch, storage } = useTourState(validatedTours, {
    persistState,
    debug,
  })

  // ---------------------------------------------------------------------------
  // Context value helpers
  // ---------------------------------------------------------------------------

  const startTour = useCallback(
    (tourId: string) => {
      const tour = state.tours[tourId]
      if (!tour) {
        if (debug) console.warn(`[WalkMe] Tour "${tourId}" not found`)
        return
      }

      previousFocusRef.current = document.activeElement as HTMLElement | null
      dispatch({ type: 'START_TOUR', tourId })

      onTourStart?.({
        type: 'tour_started',
        tourId,
        tourName: tour.name,
        stepIndex: 0,
        totalSteps: tour.steps.length,
        timestamp: Date.now(),
      })
    },
    [state.tours, dispatch, debug, onTourStart],
  )

  const pauseTour = useCallback(() => {
    dispatch({ type: 'PAUSE_TOUR' })
  }, [dispatch])

  const resumeTour = useCallback(() => {
    dispatch({ type: 'RESUME_TOUR' })
  }, [dispatch])

  const skipTour = useCallback(() => {
    const tour = getActiveTour(state)
    if (tour) {
      onTourSkip?.({
        type: 'tour_skipped',
        tourId: tour.id,
        tourName: tour.name,
        stepIndex: state.activeTour?.currentStepIndex,
        totalSteps: tour.steps.length,
        timestamp: Date.now(),
      })
      tour.onSkip?.()
    }
    dispatch({ type: 'SKIP_TOUR' })
    restoreFocus()
  }, [state, dispatch, onTourSkip])

  const completeTour = useCallback(() => {
    const tour = getActiveTour(state)
    if (tour) {
      onTourComplete?.({
        type: 'tour_completed',
        tourId: tour.id,
        tourName: tour.name,
        totalSteps: tour.steps.length,
        timestamp: Date.now(),
      })
      tour.onComplete?.()
    }
    dispatch({ type: 'COMPLETE_TOUR' })
    restoreFocus()
  }, [state, dispatch, onTourComplete])

  const nextStep = useCallback(() => {
    if (isLastStep(state)) {
      completeTour()
    } else {
      dispatch({ type: 'NEXT_STEP' })
    }
  }, [state, dispatch, completeTour])

  const prevStep = useCallback(() => {
    dispatch({ type: 'PREV_STEP' })
  }, [dispatch])

  const goToStep = useCallback(
    (stepIndex: number) => {
      dispatch({ type: 'NAVIGATE_TO_STEP', stepIndex })
    },
    [dispatch],
  )

  const resetTour = useCallback(
    (tourId: string) => {
      dispatch({ type: 'RESET_TOUR', tourId })
    },
    [dispatch],
  )

  const resetAllTours = useCallback(() => {
    dispatch({ type: 'RESET_ALL' })
  }, [dispatch])

  const isTourCompleted = useCallback(
    (tourId: string) => state.completedTours.includes(tourId),
    [state.completedTours],
  )

  const isTourActive = useCallback(
    (tourId: string) => state.activeTour?.tourId === tourId,
    [state.activeTour],
  )

  const emitEvent = useCallback(
    (eventName: string) => {
      customEventsRef.current.add(eventName)
      // Re-evaluate triggers after event emission
      evaluateTriggers()
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  function restoreFocus() {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }

  // ---------------------------------------------------------------------------
  // Trigger Evaluation
  // ---------------------------------------------------------------------------

  const evaluateTriggers = useCallback(() => {
    if (!state.initialized || state.activeTour || !autoStart) return

    const triggerContext: TriggerEvaluationContext = {
      currentRoute: pathname,
      visitCount: storage.getVisitCount(),
      firstVisitDate: storage.getFirstVisitDate(),
      completedTourIds: state.completedTours,
      customEvents: customEventsRef.current,
    }

    const conditionCtx: ConditionContext = {
      ...externalConditionContext,
      completedTourIds: state.completedTours,
      visitCount: storage.getVisitCount(),
      firstVisitDate: storage.getFirstVisitDate() ?? undefined,
    }

    // Sort tours by priority (lower number = higher priority)
    const sortedTours = Object.values(state.tours).sort(
      (a, b) => (a.priority ?? 999) - (b.priority ?? 999),
    )

    for (const tour of sortedTours) {
      if (state.completedTours.includes(tour.id)) continue
      if (state.skippedTours.includes(tour.id)) continue

      if (shouldTriggerTour(tour, triggerContext)) {
        if (evaluateConditions(tour.conditions, conditionCtx)) {
          const delay = tour.trigger.delay ?? autoStartDelay ?? 0

          if (triggerTimeoutRef.current) {
            clearTimeout(triggerTimeoutRef.current)
          }

          triggerTimeoutRef.current = setTimeout(() => {
            startTour(tour.id)
          }, delay)

          break // Only trigger one tour at a time
        }
      }
    }
  }, [
    state.initialized,
    state.activeTour,
    state.tours,
    state.completedTours,
    state.skippedTours,
    autoStart,
    pathname,
    storage,
    externalConditionContext,
    autoStartDelay,
    startTour,
  ])

  // Evaluate triggers on init and route change
  useEffect(() => {
    evaluateTriggers()
  }, [evaluateTriggers])

  // ---------------------------------------------------------------------------
  // Cross-Page Navigation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!state.activeTour || state.activeTour.status !== 'active') return

    const activeStep = getActiveStep(state)
    if (!activeStep?.route) return

    // If step requires a different route, navigate
    if (activeStep.route !== pathname) {
      try {
        router.push(activeStep.route)
      } catch (err) {
        if (debug) console.error('[WalkMe] Navigation failed:', err)
        // Skip to next step on navigation failure
        dispatch({ type: 'NEXT_STEP' })
      }
    }
  }, [state.activeTour?.currentStepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for target after route change
  useEffect(() => {
    if (prevPathRef.current === pathname) return
    prevPathRef.current = pathname

    if (!state.activeTour || state.activeTour.status !== 'active') return

    const activeStep = getActiveStep(state)
    if (!activeStep?.target) return

    waitForTarget(activeStep.target, { timeout: 5000 }).then((result) => {
      if (result.found && result.element) {
        targetElementRef.current = result.element
        scrollToElement(result.element)
      } else if (debug) {
        console.warn(
          `[WalkMe] Target "${activeStep.target}" not found after navigation`,
        )
      }
    })
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Target Element Resolution
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!state.activeTour || state.activeTour.status !== 'active') return

    const activeStep = getActiveStep(state)
    if (!activeStep?.target) {
      targetElementRef.current = null
      return
    }

    // Try finding immediately
    const result = findTarget(activeStep.target)
    if (result.found && result.element) {
      targetElementRef.current = result.element
      scrollToElement(result.element)
    } else {
      // Wait for the element
      waitForTarget(activeStep.target, { timeout: 5000 }).then((waitResult) => {
        if (waitResult.found && waitResult.element) {
          targetElementRef.current = waitResult.element
          scrollToElement(waitResult.element)
        } else {
          targetElementRef.current = null
          if (debug) {
            console.warn(
              `[WalkMe] Target "${activeStep.target}" not found, step may display without anchor`,
            )
          }
        }
      })
    }
  }, [state.activeTour?.currentStepIndex, state.activeTour?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Step Change Analytics
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!state.activeTour || state.activeTour.status !== 'active') return

    const tour = state.tours[state.activeTour.tourId]
    if (!tour) return

    const activeStep = getActiveStep(state)

    onStepChange?.({
      type: 'step_changed',
      tourId: tour.id,
      tourName: tour.name,
      stepId: activeStep?.id,
      stepIndex: state.activeTour.currentStepIndex,
      totalSteps: tour.steps.length,
      timestamp: Date.now(),
    })
  }, [state.activeTour?.currentStepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Keyboard Navigation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!state.activeTour || state.activeTour.status !== 'active') return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          nextStep()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prevStep()
          break
        case 'Escape':
          e.preventDefault()
          skipTour()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.activeTour, nextStep, prevStep, skipTour])

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (triggerTimeoutRef.current) {
        clearTimeout(triggerTimeoutRef.current)
      }
      targetElementRef.current = null
      previousFocusRef.current = null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Context Value
  // ---------------------------------------------------------------------------

  const contextValue = useMemo<WalkmeContextValue>(
    () => ({
      state,
      startTour,
      pauseTour,
      resumeTour,
      skipTour,
      completeTour,
      resetTour,
      resetAllTours,
      nextStep,
      prevStep,
      goToStep,
      isTourCompleted,
      isTourActive,
      getActiveTour: () => getActiveTour(state),
      getActiveStep: () => getActiveStep(state),
      emitEvent,
    }),
    [
      state,
      startTour,
      pauseTour,
      resumeTour,
      skipTour,
      completeTour,
      resetTour,
      resetAllTours,
      nextStep,
      prevStep,
      goToStep,
      isTourCompleted,
      isTourActive,
      emitEvent,
    ],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeTour = getActiveTour(state)
  const activeStep = getActiveStep(state)
  const showStep = activeTour && activeStep && state.activeTour?.status === 'active'

  // Build screen reader announcement
  const srAnnouncement = showStep && state.activeTour
    ? labels.progress
        .replace('{current}', String(state.activeTour.currentStepIndex + 1))
        .replace('{total}', String(activeTour!.steps.length))
      + ': ' + activeStep.title
    : ''

  return (
    <WalkmeContext.Provider value={contextValue}>
      {children}

      {/* Screen reader live region for step announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {srAnnouncement}
      </div>

      {showStep && state.activeTour && (
        <StepRenderer
          step={activeStep}
          targetElement={targetElementRef.current}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
          onComplete={completeTour}
          isFirst={isFirstStep(state)}
          isLast={isLastStep(state)}
          currentIndex={state.activeTour.currentStepIndex}
          totalSteps={activeTour.steps.length}
          labels={labels}
        />
      )}
    </WalkmeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Step Renderer (internal)
// ---------------------------------------------------------------------------

interface StepRendererProps {
  step: NonNullable<ReturnType<typeof getActiveStep>>
  targetElement: HTMLElement | null
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onComplete: () => void
  isFirst: boolean
  isLast: boolean
  currentIndex: number
  totalSteps: number
  labels: WalkmeLabels
}

function StepRenderer({
  step,
  targetElement,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isFirst,
  isLast,
  currentIndex,
  totalSteps,
  labels,
}: StepRendererProps) {
  const commonProps = {
    step,
    onNext,
    onPrev,
    onSkip,
    onComplete,
    isFirst,
    isLast,
    currentIndex,
    totalSteps,
    labels,
  }

  switch (step.type) {
    case 'modal':
      return (
        <>
          <WalkmeOverlay visible />
          <WalkmeModal {...commonProps} />
        </>
      )

    case 'tooltip':
      return (
        <WalkmeTooltip {...commonProps} targetElement={targetElement} />
      )

    case 'spotlight':
      return (
        <WalkmeSpotlight {...commonProps} targetElement={targetElement} />
      )

    case 'beacon':
      return (
        <WalkmeBeacon
          step={step}
          targetElement={targetElement}
          onClick={onNext}
          labels={labels}
        />
      )

    case 'floating':
      return (
        <>
          <WalkmeOverlay visible />
          <WalkmeModal {...commonProps} />
        </>
      )

    default:
      return null
  }
}
