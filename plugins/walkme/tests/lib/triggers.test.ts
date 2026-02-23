import type { Tour } from '../../types/walkme.types'
import {
  shouldTriggerTour,
  evaluateOnFirstVisit,
  evaluateOnRouteEnter,
  evaluateOnEvent,
  evaluateScheduled,
  type TriggerEvaluationContext,
} from '../../lib/triggers'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createContext(overrides: Partial<TriggerEvaluationContext> = {}): TriggerEvaluationContext {
  return {
    currentRoute: '/dashboard',
    visitCount: 1,
    firstVisitDate: new Date().toISOString(),
    completedTourIds: [],
    customEvents: new Set(),
    ...overrides,
  }
}

function createTour(trigger: Tour['trigger']): Tour {
  return {
    id: 'test',
    name: 'Test',
    trigger,
    steps: [{ id: 's1', type: 'modal', title: 'T', content: 'C', actions: ['next'] }],
  }
}

// ---------------------------------------------------------------------------
// shouldTriggerTour
// ---------------------------------------------------------------------------

describe('shouldTriggerTour', () => {
  it('delegates to onFirstVisit evaluator', () => {
    const tour = createTour({ type: 'onFirstVisit' })
    expect(shouldTriggerTour(tour, createContext({ visitCount: 1 }))).toBe(true)
    expect(shouldTriggerTour(tour, createContext({ visitCount: 2 }))).toBe(false)
  })

  it('returns false for manual trigger', () => {
    const tour = createTour({ type: 'manual' })
    expect(shouldTriggerTour(tour, createContext())).toBe(false)
  })

  it('returns false for unknown trigger type', () => {
    const tour = createTour({ type: 'unknown' as any })
    expect(shouldTriggerTour(tour, createContext())).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateOnFirstVisit
// ---------------------------------------------------------------------------

describe('evaluateOnFirstVisit', () => {
  it('returns true when visitCount is 1', () => {
    expect(evaluateOnFirstVisit({ type: 'onFirstVisit' }, createContext({ visitCount: 1 }))).toBe(true)
  })

  it('returns false when visitCount is > 1', () => {
    expect(evaluateOnFirstVisit({ type: 'onFirstVisit' }, createContext({ visitCount: 5 }))).toBe(false)
  })

  it('returns false when visitCount is 0', () => {
    expect(evaluateOnFirstVisit({ type: 'onFirstVisit' }, createContext({ visitCount: 0 }))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateOnRouteEnter
// ---------------------------------------------------------------------------

describe('evaluateOnRouteEnter', () => {
  it('matches exact route', () => {
    const result = evaluateOnRouteEnter(
      { type: 'onRouteEnter', route: '/dashboard' },
      createContext({ currentRoute: '/dashboard' }),
    )
    expect(result).toBe(true)
  })

  it('does not match different route', () => {
    const result = evaluateOnRouteEnter(
      { type: 'onRouteEnter', route: '/settings' },
      createContext({ currentRoute: '/dashboard' }),
    )
    expect(result).toBe(false)
  })

  it('matches wildcard pattern /admin/*', () => {
    const trigger = { type: 'onRouteEnter' as const, route: '/admin/*' }
    expect(evaluateOnRouteEnter(trigger, createContext({ currentRoute: '/admin/users' }))).toBe(true)
    expect(evaluateOnRouteEnter(trigger, createContext({ currentRoute: '/admin' }))).toBe(true)
    expect(evaluateOnRouteEnter(trigger, createContext({ currentRoute: '/other' }))).toBe(false)
  })

  it('matches glob pattern /docs/**', () => {
    const trigger = { type: 'onRouteEnter' as const, route: '/docs/**' }
    expect(evaluateOnRouteEnter(trigger, createContext({ currentRoute: '/docs/a/b/c' }))).toBe(true)
    expect(evaluateOnRouteEnter(trigger, createContext({ currentRoute: '/docs' }))).toBe(true)
  })

  it('returns false when no route in trigger', () => {
    const result = evaluateOnRouteEnter({ type: 'onRouteEnter' }, createContext())
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateOnEvent
// ---------------------------------------------------------------------------

describe('evaluateOnEvent', () => {
  it('returns true when event is in customEvents set', () => {
    const events = new Set(['my-event'])
    const result = evaluateOnEvent(
      { type: 'onEvent', event: 'my-event' },
      createContext({ customEvents: events }),
    )
    expect(result).toBe(true)
  })

  it('returns false when event is not in set', () => {
    const result = evaluateOnEvent(
      { type: 'onEvent', event: 'my-event' },
      createContext({ customEvents: new Set() }),
    )
    expect(result).toBe(false)
  })

  it('returns false when no event in trigger', () => {
    const result = evaluateOnEvent({ type: 'onEvent' }, createContext())
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateScheduled
// ---------------------------------------------------------------------------

describe('evaluateScheduled', () => {
  it('triggers when visitCount meets afterVisits threshold', () => {
    const result = evaluateScheduled(
      { type: 'scheduled', afterVisits: 5 },
      createContext({ visitCount: 5 }),
    )
    expect(result).toBe(true)
  })

  it('does not trigger when visitCount is below threshold', () => {
    const result = evaluateScheduled(
      { type: 'scheduled', afterVisits: 5 },
      createContext({ visitCount: 3 }),
    )
    expect(result).toBe(false)
  })

  it('triggers when enough days have passed since first visit', () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

    const result = evaluateScheduled(
      { type: 'scheduled', afterDays: 7 },
      createContext({ firstVisitDate: tenDaysAgo.toISOString() }),
    )
    expect(result).toBe(true)
  })

  it('does not trigger when not enough days have passed', () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const result = evaluateScheduled(
      { type: 'scheduled', afterDays: 7 },
      createContext({ firstVisitDate: twoDaysAgo.toISOString() }),
    )
    expect(result).toBe(false)
  })

  it('returns false when no thresholds specified', () => {
    const result = evaluateScheduled({ type: 'scheduled' }, createContext())
    expect(result).toBe(false)
  })

  it('returns false when firstVisitDate is null for afterDays', () => {
    const result = evaluateScheduled(
      { type: 'scheduled', afterDays: 1 },
      createContext({ firstVisitDate: null }),
    )
    expect(result).toBe(false)
  })
})
