import type { Tour, WalkmeState } from '../../types/walkme.types'
import {
  createInitialState,
  walkmeReducer,
  canStartTour,
  getActiveTour,
  getActiveStep,
  isFirstStep,
  isLastStep,
  getTourProgress,
  getGlobalProgress,
} from '../../lib/core'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const mockTour: Tour = {
  id: 'test-tour',
  name: 'Test Tour',
  trigger: { type: 'manual' },
  steps: [
    { id: 'step-1', type: 'modal', title: 'Step 1', content: 'First', actions: ['next'] },
    { id: 'step-2', type: 'tooltip', target: '#el', title: 'Step 2', content: 'Second', actions: ['next', 'prev'] },
    { id: 'step-3', type: 'spotlight', target: '#el2', title: 'Step 3', content: 'Third', actions: ['complete'] },
  ],
}

const emptyTour: Tour = {
  id: 'empty-tour',
  name: 'Empty Tour',
  trigger: { type: 'manual' },
  steps: [],
}

function initState(tours: Tour[] = [mockTour]): WalkmeState {
  return walkmeReducer(createInitialState(), { type: 'INITIALIZE', tours })
}

function startedState(): WalkmeState {
  const s = initState()
  return walkmeReducer(s, { type: 'START_TOUR', tourId: 'test-tour' })
}

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
  it('returns a clean initial state', () => {
    const state = createInitialState()
    expect(state.tours).toEqual({})
    expect(state.activeTour).toBeNull()
    expect(state.completedTours).toEqual([])
    expect(state.skippedTours).toEqual([])
    expect(state.tourHistory).toEqual({})
    expect(state.initialized).toBe(false)
    expect(state.debug).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - INITIALIZE
// ---------------------------------------------------------------------------

describe('walkmeReducer INITIALIZE', () => {
  it('registers tours and sets initialized to true', () => {
    const state = initState()
    expect(state.initialized).toBe(true)
    expect(state.tours['test-tour']).toBeDefined()
    expect(state.tours['test-tour'].name).toBe('Test Tour')
  })

  it('handles multiple tours', () => {
    const state = initState([mockTour, { ...mockTour, id: 'tour-2', name: 'Tour 2' }])
    expect(Object.keys(state.tours)).toHaveLength(2)
  })

  it('handles empty tour array', () => {
    const state = initState([])
    expect(state.initialized).toBe(true)
    expect(Object.keys(state.tours)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - START_TOUR
// ---------------------------------------------------------------------------

describe('walkmeReducer START_TOUR', () => {
  it('starts a tour and sets activeTour', () => {
    const state = startedState()
    expect(state.activeTour).not.toBeNull()
    expect(state.activeTour!.tourId).toBe('test-tour')
    expect(state.activeTour!.status).toBe('active')
    expect(state.activeTour!.currentStepIndex).toBe(0)
    expect(state.activeTour!.startedAt).toBeTruthy()
  })

  it('does nothing if a tour is already active', () => {
    const state = startedState()
    const state2 = walkmeReducer(state, { type: 'START_TOUR', tourId: 'test-tour' })
    expect(state2).toBe(state)
  })

  it('does nothing for unknown tour id', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'START_TOUR', tourId: 'nonexistent' })
    expect(state2).toBe(state)
  })

  it('does nothing for empty tours (no steps)', () => {
    const state = initState([emptyTour])
    const state2 = walkmeReducer(state, { type: 'START_TOUR', tourId: 'empty-tour' })
    expect(state2).toBe(state)
  })

  it('records tour history on start', () => {
    const state = startedState()
    expect(state.tourHistory['test-tour']).toBeDefined()
    expect(state.tourHistory['test-tour'].status).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - NEXT_STEP
// ---------------------------------------------------------------------------

describe('walkmeReducer NEXT_STEP', () => {
  it('advances the step index', () => {
    const state = walkmeReducer(startedState(), { type: 'NEXT_STEP' })
    expect(state.activeTour!.currentStepIndex).toBe(1)
  })

  it('completes the tour when advancing past last step', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'NEXT_STEP' }) // → step 1
    state = walkmeReducer(state, { type: 'NEXT_STEP' }) // → step 2
    state = walkmeReducer(state, { type: 'NEXT_STEP' }) // → completes
    expect(state.activeTour).toBeNull()
    expect(state.completedTours).toContain('test-tour')
  })

  it('does nothing when no active tour', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'NEXT_STEP' })
    expect(state2).toBe(state)
  })

  it('does nothing when tour is paused', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'PAUSE_TOUR' })
    const state2 = walkmeReducer(state, { type: 'NEXT_STEP' })
    expect(state2).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - PREV_STEP
// ---------------------------------------------------------------------------

describe('walkmeReducer PREV_STEP', () => {
  it('decrements the step index', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'NEXT_STEP' }) // → step 1
    state = walkmeReducer(state, { type: 'PREV_STEP' }) // → step 0
    expect(state.activeTour!.currentStepIndex).toBe(0)
  })

  it('does nothing at step 0', () => {
    const state = startedState()
    const state2 = walkmeReducer(state, { type: 'PREV_STEP' })
    expect(state2).toBe(state)
  })

  it('does nothing when no active tour', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'PREV_STEP' })
    expect(state2).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - NAVIGATE_TO_STEP
// ---------------------------------------------------------------------------

describe('walkmeReducer NAVIGATE_TO_STEP', () => {
  it('jumps to a specific step', () => {
    const state = walkmeReducer(startedState(), { type: 'NAVIGATE_TO_STEP', stepIndex: 2 })
    expect(state.activeTour!.currentStepIndex).toBe(2)
  })

  it('rejects negative index', () => {
    const state = startedState()
    const state2 = walkmeReducer(state, { type: 'NAVIGATE_TO_STEP', stepIndex: -1 })
    expect(state2).toBe(state)
  })

  it('rejects out of bounds index', () => {
    const state = startedState()
    const state2 = walkmeReducer(state, { type: 'NAVIGATE_TO_STEP', stepIndex: 99 })
    expect(state2).toBe(state)
  })

  it('does nothing when no active tour', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'NAVIGATE_TO_STEP', stepIndex: 0 })
    expect(state2).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - SKIP_TOUR
// ---------------------------------------------------------------------------

describe('walkmeReducer SKIP_TOUR', () => {
  it('skips the active tour', () => {
    const state = walkmeReducer(startedState(), { type: 'SKIP_TOUR' })
    expect(state.activeTour).toBeNull()
    expect(state.skippedTours).toContain('test-tour')
    expect(state.tourHistory['test-tour'].status).toBe('skipped')
  })

  it('does not duplicate in skippedTours', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'SKIP_TOUR' })
    // Start and skip again
    state = walkmeReducer(state, { type: 'START_TOUR', tourId: 'test-tour' })
    state = walkmeReducer(state, { type: 'SKIP_TOUR' })
    expect(state.skippedTours.filter((id) => id === 'test-tour')).toHaveLength(1)
  })

  it('does nothing when no active tour', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'SKIP_TOUR' })
    expect(state2).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - COMPLETE_TOUR
// ---------------------------------------------------------------------------

describe('walkmeReducer COMPLETE_TOUR', () => {
  it('completes the active tour', () => {
    const state = walkmeReducer(startedState(), { type: 'COMPLETE_TOUR' })
    expect(state.activeTour).toBeNull()
    expect(state.completedTours).toContain('test-tour')
    expect(state.tourHistory['test-tour'].status).toBe('completed')
  })

  it('does not duplicate in completedTours', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'COMPLETE_TOUR' })
    state = walkmeReducer(state, { type: 'START_TOUR', tourId: 'test-tour' })
    state = walkmeReducer(state, { type: 'COMPLETE_TOUR' })
    expect(state.completedTours.filter((id) => id === 'test-tour')).toHaveLength(1)
  })

  it('does nothing when no active tour', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'COMPLETE_TOUR' })
    expect(state2).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - PAUSE/RESUME
// ---------------------------------------------------------------------------

describe('walkmeReducer PAUSE_TOUR / RESUME_TOUR', () => {
  it('pauses an active tour', () => {
    const state = walkmeReducer(startedState(), { type: 'PAUSE_TOUR' })
    expect(state.activeTour!.status).toBe('paused')
  })

  it('resumes a paused tour', () => {
    let state = walkmeReducer(startedState(), { type: 'PAUSE_TOUR' })
    state = walkmeReducer(state, { type: 'RESUME_TOUR' })
    expect(state.activeTour!.status).toBe('active')
  })

  it('pause does nothing when already paused', () => {
    let state = walkmeReducer(startedState(), { type: 'PAUSE_TOUR' })
    const state2 = walkmeReducer(state, { type: 'PAUSE_TOUR' })
    expect(state2).toBe(state)
  })

  it('resume does nothing when not paused', () => {
    const state = startedState()
    const state2 = walkmeReducer(state, { type: 'RESUME_TOUR' })
    expect(state2).toBe(state)
  })

  it('pause does nothing when no active tour', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'PAUSE_TOUR' })
    expect(state2).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - RESET_TOUR
// ---------------------------------------------------------------------------

describe('walkmeReducer RESET_TOUR', () => {
  it('resets a specific tour from completed', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'COMPLETE_TOUR' })
    state = walkmeReducer(state, { type: 'RESET_TOUR', tourId: 'test-tour' })
    expect(state.completedTours).not.toContain('test-tour')
    expect(state.tourHistory['test-tour']).toBeUndefined()
  })

  it('resets a specific tour from skipped', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'SKIP_TOUR' })
    state = walkmeReducer(state, { type: 'RESET_TOUR', tourId: 'test-tour' })
    expect(state.skippedTours).not.toContain('test-tour')
  })

  it('clears activeTour if it matches the tour being reset', () => {
    const state = walkmeReducer(startedState(), { type: 'RESET_TOUR', tourId: 'test-tour' })
    expect(state.activeTour).toBeNull()
  })

  it('does not clear activeTour if it does not match', () => {
    const state = walkmeReducer(startedState(), { type: 'RESET_TOUR', tourId: 'some-other-tour' })
    expect(state.activeTour).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - RESET_ALL
// ---------------------------------------------------------------------------

describe('walkmeReducer RESET_ALL', () => {
  it('resets all state', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'COMPLETE_TOUR' })
    state = walkmeReducer(state, { type: 'RESET_ALL' })
    expect(state.activeTour).toBeNull()
    expect(state.completedTours).toEqual([])
    expect(state.skippedTours).toEqual([])
    expect(state.tourHistory).toEqual({})
    // tours and initialized should still be set
    expect(state.tours['test-tour']).toBeDefined()
    expect(state.initialized).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - SET_DEBUG
// ---------------------------------------------------------------------------

describe('walkmeReducer SET_DEBUG', () => {
  it('enables debug mode', () => {
    const state = walkmeReducer(createInitialState(), { type: 'SET_DEBUG', enabled: true })
    expect(state.debug).toBe(true)
  })

  it('disables debug mode', () => {
    let state = walkmeReducer(createInitialState(), { type: 'SET_DEBUG', enabled: true })
    state = walkmeReducer(state, { type: 'SET_DEBUG', enabled: false })
    expect(state.debug).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - RESTORE_STATE
// ---------------------------------------------------------------------------

describe('walkmeReducer RESTORE_STATE', () => {
  it('restores persisted state', () => {
    const state = walkmeReducer(initState(), {
      type: 'RESTORE_STATE',
      completedTours: ['tour-a'],
      skippedTours: ['tour-b'],
      tourHistory: {},
      activeTour: null,
    })
    expect(state.completedTours).toEqual(['tour-a'])
    expect(state.skippedTours).toEqual(['tour-b'])
  })
})

// ---------------------------------------------------------------------------
// walkmeReducer - unknown action
// ---------------------------------------------------------------------------

describe('walkmeReducer unknown action', () => {
  it('returns state unchanged for unknown action type', () => {
    const state = initState()
    const state2 = walkmeReducer(state, { type: 'UNKNOWN' } as any)
    expect(state2).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('canStartTour', () => {
  it('returns true when tour exists and no active tour', () => {
    expect(canStartTour(initState(), 'test-tour')).toBe(true)
  })

  it('returns false when a tour is already active', () => {
    expect(canStartTour(startedState(), 'test-tour')).toBe(false)
  })

  it('returns false for unknown tour id', () => {
    expect(canStartTour(initState(), 'nonexistent')).toBe(false)
  })

  it('returns false for empty tour (no steps)', () => {
    expect(canStartTour(initState([emptyTour]), 'empty-tour')).toBe(false)
  })
})

describe('getActiveTour', () => {
  it('returns the active Tour object', () => {
    const tour = getActiveTour(startedState())
    expect(tour).not.toBeNull()
    expect(tour!.id).toBe('test-tour')
  })

  it('returns null when no active tour', () => {
    expect(getActiveTour(initState())).toBeNull()
  })
})

describe('getActiveStep', () => {
  it('returns the current step', () => {
    const step = getActiveStep(startedState())
    expect(step).not.toBeNull()
    expect(step!.id).toBe('step-1')
  })

  it('returns null when no active tour', () => {
    expect(getActiveStep(initState())).toBeNull()
  })
})

describe('isFirstStep', () => {
  it('returns true at step 0', () => {
    expect(isFirstStep(startedState())).toBe(true)
  })

  it('returns false at step > 0', () => {
    const state = walkmeReducer(startedState(), { type: 'NEXT_STEP' })
    expect(isFirstStep(state)).toBe(false)
  })

  it('returns false when no active tour', () => {
    expect(isFirstStep(initState())).toBe(false)
  })
})

describe('isLastStep', () => {
  it('returns false at step 0 with 3 steps', () => {
    expect(isLastStep(startedState())).toBe(false)
  })

  it('returns true at last step', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'NEXT_STEP' })
    state = walkmeReducer(state, { type: 'NEXT_STEP' })
    expect(isLastStep(state)).toBe(true)
  })

  it('returns false when no active tour', () => {
    expect(isLastStep(initState())).toBe(false)
  })
})

describe('getTourProgress', () => {
  it('returns progress for active tour', () => {
    const progress = getTourProgress(startedState(), 'test-tour')
    expect(progress.current).toBe(1)
    expect(progress.total).toBe(3)
    expect(progress.percentage).toBe(33)
  })

  it('returns 0 progress for non-active tour', () => {
    const progress = getTourProgress(initState(), 'test-tour')
    expect(progress.current).toBe(0)
    expect(progress.total).toBe(3)
    expect(progress.percentage).toBe(0)
  })

  it('returns zero for unknown tour', () => {
    const progress = getTourProgress(initState(), 'nonexistent')
    expect(progress).toEqual({ current: 0, total: 0, percentage: 0 })
  })
})

describe('getGlobalProgress', () => {
  it('returns 0% when no tours completed', () => {
    const progress = getGlobalProgress(initState())
    expect(progress.completed).toBe(0)
    expect(progress.total).toBe(1)
    expect(progress.percentage).toBe(0)
  })

  it('returns 100% when all tours completed', () => {
    let state = startedState()
    state = walkmeReducer(state, { type: 'COMPLETE_TOUR' })
    const progress = getGlobalProgress(state)
    expect(progress.completed).toBe(1)
    expect(progress.total).toBe(1)
    expect(progress.percentage).toBe(100)
  })
})
