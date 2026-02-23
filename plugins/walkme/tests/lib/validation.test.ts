import {
  TourTriggerSchema,
  TourStepSchema,
  TourSchema,
  TourArraySchema,
  validateTour,
  validateTours,
  validateStep,
} from '../../lib/validation'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validStep = {
  id: 'step-1',
  type: 'modal',
  title: 'Title',
  content: 'Content',
  actions: ['next'],
}

const validTooltipStep = {
  id: 'tooltip-1',
  type: 'tooltip',
  target: '#my-element',
  title: 'Tooltip',
  content: 'Content',
  position: 'bottom',
  actions: ['next', 'prev'],
}

const validTour = {
  id: 'tour-1',
  name: 'My Tour',
  trigger: { type: 'manual' },
  steps: [validStep],
}

// ---------------------------------------------------------------------------
// TourTriggerSchema
// ---------------------------------------------------------------------------

describe('TourTriggerSchema', () => {
  it('accepts all valid trigger types', () => {
    for (const type of ['onFirstVisit', 'onRouteEnter', 'onEvent', 'manual', 'scheduled']) {
      expect(TourTriggerSchema.safeParse({ type }).success).toBe(true)
    }
  })

  it('rejects invalid trigger type', () => {
    expect(TourTriggerSchema.safeParse({ type: 'invalid' }).success).toBe(false)
  })

  it('accepts optional delay, route, event fields', () => {
    const result = TourTriggerSchema.safeParse({
      type: 'onRouteEnter',
      delay: 500,
      route: '/dashboard/*',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative delay', () => {
    const result = TourTriggerSchema.safeParse({ type: 'manual', delay: -1 })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TourStepSchema
// ---------------------------------------------------------------------------

describe('TourStepSchema', () => {
  it('accepts a valid modal step (no target required)', () => {
    const result = TourStepSchema.safeParse(validStep)
    expect(result.success).toBe(true)
  })

  it('accepts a valid tooltip step with target', () => {
    const result = TourStepSchema.safeParse(validTooltipStep)
    expect(result.success).toBe(true)
  })

  it('rejects tooltip step without target', () => {
    const result = TourStepSchema.safeParse({
      id: 'tooltip-bad',
      type: 'tooltip',
      title: 'Bad',
      content: 'No target',
      actions: ['next'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects spotlight step without target', () => {
    const result = TourStepSchema.safeParse({
      id: 'spotlight-bad',
      type: 'spotlight',
      title: 'Bad',
      content: 'No target',
      actions: ['next'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects beacon step without target', () => {
    const result = TourStepSchema.safeParse({
      id: 'beacon-bad',
      type: 'beacon',
      title: 'Bad',
      content: 'No target',
      actions: ['next'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects step with empty id', () => {
    const result = TourStepSchema.safeParse({ ...validStep, id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects step with empty actions array', () => {
    const result = TourStepSchema.safeParse({ ...validStep, actions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects step with invalid action', () => {
    const result = TourStepSchema.safeParse({ ...validStep, actions: ['invalid'] })
    expect(result.success).toBe(false)
  })

  it('accepts all valid step types', () => {
    for (const type of ['tooltip', 'modal', 'spotlight', 'beacon', 'floating']) {
      const step = type === 'modal' || type === 'floating'
        ? { ...validStep, type }
        : { ...validStep, type, target: '#el' }
      expect(TourStepSchema.safeParse(step).success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// TourSchema
// ---------------------------------------------------------------------------

describe('TourSchema', () => {
  it('accepts a valid tour', () => {
    const result = TourSchema.safeParse(validTour)
    expect(result.success).toBe(true)
  })

  it('rejects tour with empty id', () => {
    const result = TourSchema.safeParse({ ...validTour, id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects tour with no steps', () => {
    const result = TourSchema.safeParse({ ...validTour, steps: [] })
    expect(result.success).toBe(false)
  })

  it('accepts tour with conditions', () => {
    const result = TourSchema.safeParse({
      ...validTour,
      conditions: {
        userRole: ['admin'],
        completedTours: ['onboarding'],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts tour with priority', () => {
    const result = TourSchema.safeParse({ ...validTour, priority: 10 })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TourArraySchema
// ---------------------------------------------------------------------------

describe('TourArraySchema', () => {
  it('validates an array of tours', () => {
    const result = TourArraySchema.safeParse([validTour, { ...validTour, id: 'tour-2' }])
    expect(result.success).toBe(true)
  })

  it('rejects if any tour is invalid', () => {
    const result = TourArraySchema.safeParse([validTour, { id: '' }])
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateTour
// ---------------------------------------------------------------------------

describe('validateTour', () => {
  it('returns valid: true for a valid tour', () => {
    const result = validateTour(validTour)
    expect(result.valid).toBe(true)
    expect(result.tour).toBeDefined()
    expect(result.errors).toBeUndefined()
  })

  it('returns valid: false with errors for invalid tour', () => {
    const result = validateTour({ id: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.tour).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validateTours
// ---------------------------------------------------------------------------

describe('validateTours', () => {
  it('filters valid tours from mixed input', () => {
    const result = validateTours([validTour, { id: '' }, { ...validTour, id: 'tour-2' }])
    expect(result.validTours).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.valid).toBe(false)
  })

  it('returns valid: true when all tours are valid', () => {
    const result = validateTours([validTour])
    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validateStep
// ---------------------------------------------------------------------------

describe('validateStep', () => {
  it('returns valid: true for a valid step', () => {
    expect(validateStep(validStep).valid).toBe(true)
  })

  it('returns valid: false for invalid step', () => {
    const result = validateStep({ id: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })
})
