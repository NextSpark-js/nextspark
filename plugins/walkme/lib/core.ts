/**
 * WalkMe Core Engine
 *
 * Pure-function state machine for managing guided tour state.
 * All functions are side-effect free and testable without React.
 */

import type {
  Tour,
  TourStep,
  TourState,
  WalkmeState,
  WalkmeAction,
} from '../types/walkme.types'

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

/** Creates a fresh initial WalkmeState */
export function createInitialState(): WalkmeState {
  return {
    tours: {},
    activeTour: null,
    completedTours: [],
    skippedTours: [],
    tourHistory: {},
    initialized: false,
    debug: false,
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/** Main reducer for the WalkMe state machine */
export function walkmeReducer(state: WalkmeState, action: WalkmeAction): WalkmeState {
  switch (action.type) {
    case 'INITIALIZE': {
      const tours: Record<string, Tour> = {}
      for (const tour of action.tours) {
        tours[tour.id] = tour
      }
      return { ...state, tours, initialized: true }
    }

    case 'START_TOUR': {
      if (state.activeTour) return state
      const tour = state.tours[action.tourId]
      if (!tour) return state
      if (tour.steps.length === 0) return state

      const tourState: TourState = {
        tourId: action.tourId,
        status: 'active',
        currentStepIndex: 0,
        startedAt: new Date().toISOString(),
      }

      return {
        ...state,
        activeTour: tourState,
        tourHistory: { ...state.tourHistory, [action.tourId]: tourState },
      }
    }

    case 'NEXT_STEP': {
      if (!state.activeTour || state.activeTour.status !== 'active') return state
      const tour = state.tours[state.activeTour.tourId]
      if (!tour) return state

      const nextIndex = state.activeTour.currentStepIndex + 1

      // If we've passed the last step, complete the tour
      if (nextIndex >= tour.steps.length) {
        return completeTourState(state)
      }

      const updatedTour: TourState = {
        ...state.activeTour,
        currentStepIndex: nextIndex,
      }

      return {
        ...state,
        activeTour: updatedTour,
        tourHistory: { ...state.tourHistory, [updatedTour.tourId]: updatedTour },
      }
    }

    case 'PREV_STEP': {
      if (!state.activeTour || state.activeTour.status !== 'active') return state
      if (state.activeTour.currentStepIndex <= 0) return state

      const updatedTour: TourState = {
        ...state.activeTour,
        currentStepIndex: state.activeTour.currentStepIndex - 1,
      }

      return {
        ...state,
        activeTour: updatedTour,
        tourHistory: { ...state.tourHistory, [updatedTour.tourId]: updatedTour },
      }
    }

    case 'NAVIGATE_TO_STEP': {
      if (!state.activeTour || state.activeTour.status !== 'active') return state
      const tour = state.tours[state.activeTour.tourId]
      if (!tour) return state
      if (action.stepIndex < 0 || action.stepIndex >= tour.steps.length) return state

      const updatedTour: TourState = {
        ...state.activeTour,
        currentStepIndex: action.stepIndex,
      }

      return {
        ...state,
        activeTour: updatedTour,
        tourHistory: { ...state.tourHistory, [updatedTour.tourId]: updatedTour },
      }
    }

    case 'SKIP_TOUR': {
      if (!state.activeTour) return state

      const tourId = state.activeTour.tourId
      const skippedState: TourState = {
        ...state.activeTour,
        status: 'skipped',
        skippedAt: new Date().toISOString(),
      }

      return {
        ...state,
        activeTour: null,
        skippedTours: state.skippedTours.includes(tourId)
          ? state.skippedTours
          : [...state.skippedTours, tourId],
        tourHistory: { ...state.tourHistory, [tourId]: skippedState },
      }
    }

    case 'COMPLETE_TOUR': {
      if (!state.activeTour) return state
      return completeTourState(state)
    }

    case 'PAUSE_TOUR': {
      if (!state.activeTour || state.activeTour.status !== 'active') return state

      const paused: TourState = {
        ...state.activeTour,
        status: 'paused',
      }

      return {
        ...state,
        activeTour: paused,
        tourHistory: { ...state.tourHistory, [paused.tourId]: paused },
      }
    }

    case 'RESUME_TOUR': {
      if (!state.activeTour || state.activeTour.status !== 'paused') return state

      const resumed: TourState = {
        ...state.activeTour,
        status: 'active',
      }

      return {
        ...state,
        activeTour: resumed,
        tourHistory: { ...state.tourHistory, [resumed.tourId]: resumed },
      }
    }

    case 'RESET_TOUR': {
      const { [action.tourId]: _, ...remainingHistory } = state.tourHistory

      return {
        ...state,
        activeTour:
          state.activeTour?.tourId === action.tourId ? null : state.activeTour,
        completedTours: state.completedTours.filter((id) => id !== action.tourId),
        skippedTours: state.skippedTours.filter((id) => id !== action.tourId),
        tourHistory: remainingHistory,
      }
    }

    case 'RESET_ALL': {
      return {
        ...state,
        activeTour: null,
        completedTours: [],
        skippedTours: [],
        tourHistory: {},
      }
    }

    case 'SET_DEBUG': {
      return { ...state, debug: action.enabled }
    }

    case 'RESTORE_STATE': {
      return {
        ...state,
        completedTours: action.completedTours,
        skippedTours: action.skippedTours,
        tourHistory: action.tourHistory,
        activeTour: action.activeTour,
      }
    }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function completeTourState(state: WalkmeState): WalkmeState {
  if (!state.activeTour) return state

  const tourId = state.activeTour.tourId
  const completedState: TourState = {
    ...state.activeTour,
    status: 'completed',
    completedAt: new Date().toISOString(),
  }

  return {
    ...state,
    activeTour: null,
    completedTours: state.completedTours.includes(tourId)
      ? state.completedTours
      : [...state.completedTours, tourId],
    tourHistory: { ...state.tourHistory, [tourId]: completedState },
  }
}

/** Check if a tour can be started */
export function canStartTour(state: WalkmeState, tourId: string): boolean {
  if (state.activeTour) return false
  const tour = state.tours[tourId]
  if (!tour) return false
  if (tour.steps.length === 0) return false
  return true
}

/** Get the full Tour object for the currently active tour */
export function getActiveTour(state: WalkmeState): Tour | null {
  if (!state.activeTour) return null
  return state.tours[state.activeTour.tourId] ?? null
}

/** Get the current TourStep for the active tour */
export function getActiveStep(state: WalkmeState): TourStep | null {
  const tour = getActiveTour(state)
  if (!tour || !state.activeTour) return null
  return tour.steps[state.activeTour.currentStepIndex] ?? null
}

/** Check if the current step is the first step */
export function isFirstStep(state: WalkmeState): boolean {
  if (!state.activeTour) return false
  return state.activeTour.currentStepIndex === 0
}

/** Check if the current step is the last step */
export function isLastStep(state: WalkmeState): boolean {
  if (!state.activeTour) return false
  const tour = state.tours[state.activeTour.tourId]
  if (!tour) return false
  return state.activeTour.currentStepIndex === tour.steps.length - 1
}

/** Get progress for a specific tour */
export function getTourProgress(
  state: WalkmeState,
  tourId: string,
): { current: number; total: number; percentage: number } {
  const tour = state.tours[tourId]
  if (!tour) return { current: 0, total: 0, percentage: 0 }

  const total = tour.steps.length
  const isActive = state.activeTour?.tourId === tourId
  const current = isActive ? state.activeTour!.currentStepIndex + 1 : 0
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return { current, total, percentage }
}

/** Get global progress across all tours */
export function getGlobalProgress(
  state: WalkmeState,
): { completed: number; total: number; percentage: number } {
  const total = Object.keys(state.tours).length
  const completed = state.completedTours.length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return { completed, total, percentage }
}
