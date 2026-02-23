/**
 * WalkMe Triggers Module
 *
 * Tour trigger evaluation system.
 * Determines when a tour should be automatically activated.
 */

import type { Tour, TourTrigger } from '../types/walkme.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriggerEvaluationContext {
  /** Current page route/pathname */
  currentRoute: string
  /** Total number of page visits */
  visitCount: number
  /** ISO date string of first visit */
  firstVisitDate: string | null
  /** IDs of completed tours */
  completedTourIds: string[]
  /** Set of custom events that have been emitted */
  customEvents: Set<string>
}

// ---------------------------------------------------------------------------
// Main Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a tour should be triggered based on its trigger config
 * and the current context. Does NOT check conditions (that's a separate step).
 */
export function shouldTriggerTour(
  tour: Tour,
  context: TriggerEvaluationContext,
): boolean {
  const { trigger } = tour

  switch (trigger.type) {
    case 'onFirstVisit':
      return evaluateOnFirstVisit(trigger, context)
    case 'onRouteEnter':
      return evaluateOnRouteEnter(trigger, context)
    case 'onEvent':
      return evaluateOnEvent(trigger, context)
    case 'manual':
      return false // Manual tours are started programmatically only
    case 'scheduled':
      return evaluateScheduled(trigger, context)
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Individual Trigger Evaluators
// ---------------------------------------------------------------------------

/** First visit: triggers only when visitCount === 1 */
export function evaluateOnFirstVisit(
  _trigger: TourTrigger,
  context: TriggerEvaluationContext,
): boolean {
  return context.visitCount === 1
}

/** Route enter: triggers when current route matches the trigger's route pattern */
export function evaluateOnRouteEnter(
  trigger: TourTrigger,
  context: TriggerEvaluationContext,
): boolean {
  if (!trigger.route) return false

  const pattern = trigger.route
  const route = context.currentRoute

  // Exact match
  if (pattern === route) return true

  // Wildcard match: /dashboard/* matches /dashboard/anything
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2)
    return route.startsWith(prefix)
  }

  // Glob match: /dashboard/** matches /dashboard/a/b/c
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3)
    return route.startsWith(prefix)
  }

  return false
}

/** Event trigger: activates when a specific custom event has been emitted */
export function evaluateOnEvent(
  trigger: TourTrigger,
  context: TriggerEvaluationContext,
): boolean {
  if (!trigger.event) return false
  return context.customEvents.has(trigger.event)
}

/** Scheduled trigger: activates after N visits or N days since first visit */
export function evaluateScheduled(
  trigger: TourTrigger,
  context: TriggerEvaluationContext,
): boolean {
  // Check visit-based threshold
  if (trigger.afterVisits !== undefined) {
    if (context.visitCount >= trigger.afterVisits) return true
  }

  // Check day-based threshold
  if (trigger.afterDays !== undefined && context.firstVisitDate) {
    const firstVisit = new Date(context.firstVisitDate)
    const now = new Date()
    const daysSinceFirstVisit = Math.floor(
      (now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (daysSinceFirstVisit >= trigger.afterDays) return true
  }

  return false
}
