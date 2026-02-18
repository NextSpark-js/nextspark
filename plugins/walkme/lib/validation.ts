/**
 * WalkMe Validation Module
 *
 * Zod schemas for runtime validation of tour configurations.
 * Ensures tour definitions are well-formed before they're used.
 */

import { z } from 'zod'
import type { Tour, TourStep as TourStepType } from '../types/walkme.types'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const TourTriggerSchema = z.object({
  type: z.enum(['onFirstVisit', 'onRouteEnter', 'onEvent', 'manual', 'scheduled']),
  delay: z.number().min(0).optional(),
  route: z.string().optional(),
  event: z.string().optional(),
  afterVisits: z.number().min(1).optional(),
  afterDays: z.number().min(0).optional(),
})

export const TourConditionsSchema = z.object({
  userRole: z.array(z.string()).optional(),
  featureFlags: z.array(z.string()).optional(),
  completedTours: z.array(z.string()).optional(),
  notCompletedTours: z.array(z.string()).optional(),
  custom: z.function().optional(),
}).optional()

export const TourStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['tooltip', 'modal', 'spotlight', 'beacon', 'floating']),
  title: z.string().min(1),
  content: z.string(),
  target: z.string().optional(),
  route: z.string().optional(),
  position: z.enum(['top', 'bottom', 'left', 'right', 'auto']).optional(),
  actions: z.array(z.enum(['next', 'prev', 'skip', 'complete', 'close'])).min(1),
  delay: z.number().min(0).optional(),
  autoAdvance: z.number().min(0).optional(),
  beforeShow: z.function().optional(),
  afterShow: z.function().optional(),
}).refine(
  (step) => {
    // tooltip, spotlight, and beacon require a target
    if (['tooltip', 'spotlight', 'beacon'].includes(step.type)) {
      return !!step.target
    }
    return true
  },
  {
    message: 'Steps of type tooltip, spotlight, and beacon require a target selector',
  },
)

export const TourSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: TourTriggerSchema,
  conditions: TourConditionsSchema,
  steps: z.array(TourStepSchema).min(1),
  onComplete: z.function().optional(),
  onSkip: z.function().optional(),
  priority: z.number().optional(),
})

export const TourArraySchema = z.array(TourSchema)

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/** Validate a single tour configuration */
export function validateTour(
  tour: unknown,
): { valid: boolean; errors?: z.ZodError; tour?: Tour } {
  const result = TourSchema.safeParse(tour)
  if (result.success) {
    // Zod's output matches our Tour type structurally; functions (onComplete,
    // onSkip, beforeShow, afterShow, custom) are validated as z.function() but
    // their signatures aren't preserved in the inferred type, so we cast once here.
    return { valid: true, tour: result.data as Tour }
  }
  return { valid: false, errors: result.error }
}

/** Validate an array of tours, returning only the valid ones */
export function validateTours(
  tours: unknown[],
): { valid: boolean; errors?: z.ZodError[]; validTours: Tour[] } {
  const validTours: Tour[] = []
  const errors: z.ZodError[] = []

  for (const tour of tours) {
    const result = TourSchema.safeParse(tour)
    if (result.success) {
      validTours.push(result.data as Tour)
    } else {
      errors.push(result.error)
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    validTours,
  }
}

/** Validate a single step configuration */
export function validateStep(
  step: unknown,
): { valid: boolean; errors?: z.ZodError; step?: TourStepType } {
  const result = TourStepSchema.safeParse(step)
  if (result.success) {
    return { valid: true, step: result.data as TourStepType }
  }
  return { valid: false, errors: result.error }
}
