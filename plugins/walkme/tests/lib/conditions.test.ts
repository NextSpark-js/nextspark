import type { ConditionContext, TourConditions } from '../../types/walkme.types'
import {
  evaluateConditions,
  evaluateRoleCondition,
  evaluateFeatureFlagCondition,
  evaluateCompletedToursCondition,
  evaluateNotCompletedCondition,
} from '../../lib/conditions'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createContext(overrides: Partial<ConditionContext> = {}): ConditionContext {
  return {
    userRole: 'user',
    featureFlags: [],
    completedTourIds: [],
    visitCount: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// evaluateConditions (integration)
// ---------------------------------------------------------------------------

describe('evaluateConditions', () => {
  it('returns true when conditions is undefined', () => {
    expect(evaluateConditions(undefined, createContext())).toBe(true)
  })

  it('returns true when conditions is empty object', () => {
    expect(evaluateConditions({}, createContext())).toBe(true)
  })

  it('returns true when all conditions pass', () => {
    const conditions: TourConditions = {
      userRole: ['admin', 'superadmin'],
      featureFlags: ['feature-a'],
      completedTours: ['onboarding'],
    }
    const ctx = createContext({
      userRole: 'admin',
      featureFlags: ['feature-a', 'feature-b'],
      completedTourIds: ['onboarding'],
    })
    expect(evaluateConditions(conditions, ctx)).toBe(true)
  })

  it('returns false when role check fails (AND logic)', () => {
    const conditions: TourConditions = {
      userRole: ['admin'],
      featureFlags: ['feature-a'],
    }
    const ctx = createContext({
      userRole: 'user',
      featureFlags: ['feature-a'],
    })
    expect(evaluateConditions(conditions, ctx)).toBe(false)
  })

  it('returns false when feature flag check fails', () => {
    const conditions: TourConditions = {
      featureFlags: ['feature-x'],
    }
    const ctx = createContext({ featureFlags: ['feature-y'] })
    expect(evaluateConditions(conditions, ctx)).toBe(false)
  })

  it('returns false when completedTours check fails', () => {
    const conditions: TourConditions = {
      completedTours: ['required-tour'],
    }
    const ctx = createContext({ completedTourIds: [] })
    expect(evaluateConditions(conditions, ctx)).toBe(false)
  })

  it('returns false when notCompletedTours check fails', () => {
    const conditions: TourConditions = {
      notCompletedTours: ['excluded-tour'],
    }
    const ctx = createContext({ completedTourIds: ['excluded-tour'] })
    expect(evaluateConditions(conditions, ctx)).toBe(false)
  })

  it('evaluates custom condition function', () => {
    const conditions: TourConditions = {
      custom: (ctx) => ctx.visitCount > 3,
    }
    expect(evaluateConditions(conditions, createContext({ visitCount: 5 }))).toBe(true)
    expect(evaluateConditions(conditions, createContext({ visitCount: 1 }))).toBe(false)
  })

  it('skips empty arrays in conditions', () => {
    const conditions: TourConditions = {
      userRole: [],
      featureFlags: [],
      completedTours: [],
      notCompletedTours: [],
    }
    expect(evaluateConditions(conditions, createContext())).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateRoleCondition
// ---------------------------------------------------------------------------

describe('evaluateRoleCondition', () => {
  it('returns true when user role is in allowed list', () => {
    expect(evaluateRoleCondition(['admin', 'editor'], 'admin')).toBe(true)
  })

  it('returns false when user role is not in allowed list', () => {
    expect(evaluateRoleCondition(['admin', 'editor'], 'user')).toBe(false)
  })

  it('returns false when user role is undefined', () => {
    expect(evaluateRoleCondition(['admin'], undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateFeatureFlagCondition
// ---------------------------------------------------------------------------

describe('evaluateFeatureFlagCondition', () => {
  it('returns true when all required flags are active', () => {
    expect(evaluateFeatureFlagCondition(['a', 'b'], ['a', 'b', 'c'])).toBe(true)
  })

  it('returns false when a required flag is missing', () => {
    expect(evaluateFeatureFlagCondition(['a', 'b'], ['a'])).toBe(false)
  })

  it('returns true when required flags is empty', () => {
    expect(evaluateFeatureFlagCondition([], ['a'])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateCompletedToursCondition
// ---------------------------------------------------------------------------

describe('evaluateCompletedToursCondition', () => {
  it('returns true when all required tours are completed', () => {
    expect(evaluateCompletedToursCondition(['t1', 't2'], ['t1', 't2', 't3'])).toBe(true)
  })

  it('returns false when a required tour is not completed', () => {
    expect(evaluateCompletedToursCondition(['t1', 't2'], ['t1'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateNotCompletedCondition
// ---------------------------------------------------------------------------

describe('evaluateNotCompletedCondition', () => {
  it('returns true when none of the excluded tours are completed', () => {
    expect(evaluateNotCompletedCondition(['t1', 't2'], ['t3'])).toBe(true)
  })

  it('returns false when any excluded tour is completed', () => {
    expect(evaluateNotCompletedCondition(['t1', 't2'], ['t2'])).toBe(false)
  })

  it('returns true when excluded list is empty', () => {
    expect(evaluateNotCompletedCondition([], ['t1'])).toBe(true)
  })
})
