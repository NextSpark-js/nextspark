/**
 * WalkMe Conditions Module
 *
 * Conditional display evaluation for tours.
 * All specified conditions must pass (AND logic).
 */

import type { TourConditions, ConditionContext } from '../types/walkme.types'

// ---------------------------------------------------------------------------
// Main Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate all conditions for a tour.
 * Returns true if no conditions are specified or all conditions pass.
 * Uses AND logic: every specified condition must be satisfied.
 */
export function evaluateConditions(
  conditions: TourConditions | undefined,
  context: ConditionContext,
): boolean {
  if (!conditions) return true

  // Check user role
  if (conditions.userRole && conditions.userRole.length > 0) {
    if (!evaluateRoleCondition(conditions.userRole, context.userRole)) {
      return false
    }
  }

  // Check feature flags
  if (conditions.featureFlags && conditions.featureFlags.length > 0) {
    if (
      !evaluateFeatureFlagCondition(
        conditions.featureFlags,
        context.featureFlags ?? [],
      )
    ) {
      return false
    }
  }

  // Check completed tours
  if (conditions.completedTours && conditions.completedTours.length > 0) {
    if (
      !evaluateCompletedToursCondition(
        conditions.completedTours,
        context.completedTourIds,
      )
    ) {
      return false
    }
  }

  // Check not-completed tours
  if (conditions.notCompletedTours && conditions.notCompletedTours.length > 0) {
    if (
      !evaluateNotCompletedCondition(
        conditions.notCompletedTours,
        context.completedTourIds,
      )
    ) {
      return false
    }
  }

  // Check custom condition
  if (conditions.custom) {
    if (!conditions.custom(context)) {
      return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Individual Condition Evaluators
// ---------------------------------------------------------------------------

/** User role must be in the allowed list */
export function evaluateRoleCondition(
  roles: string[],
  userRole: string | undefined,
): boolean {
  if (!userRole) return false
  return roles.includes(userRole)
}

/** All specified feature flags must be active */
export function evaluateFeatureFlagCondition(
  requiredFlags: string[],
  activeFlags: string[],
): boolean {
  return requiredFlags.every((flag) => activeFlags.includes(flag))
}

/** All specified tours must be completed */
export function evaluateCompletedToursCondition(
  requiredTours: string[],
  completedTourIds: string[],
): boolean {
  return requiredTours.every((tourId) => completedTourIds.includes(tourId))
}

/** None of the specified tours should be completed */
export function evaluateNotCompletedCondition(
  excludedTours: string[],
  completedTourIds: string[],
): boolean {
  return !excludedTours.some((tourId) => completedTourIds.includes(tourId))
}
