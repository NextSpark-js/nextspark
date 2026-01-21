/**
 * @nextsparkjs/testing
 *
 * Testing utilities for NextSpark applications.
 * Provides Page Object Models and Cypress helpers.
 *
 * For selectors, import from @nextsparkjs/core/selectors:
 * @example
 * ```ts
 * import { sel, cySelector } from '@nextsparkjs/core/selectors'
 * ```
 */

// =============================================================================
// UTILS
// =============================================================================
export {
  // Selector helpers
  createCyId,
  createTestId,
  sel,
  // Attribute generators
  createStateAttr,
  createPriorityAttr,
  createTestingProps,
  createAriaLabel,
  // Keyboard helpers
  keyboardHelpers,
} from './utils'

// =============================================================================
// PAGE OBJECT MODELS
// =============================================================================
export {
  BasePOMCore,
  DashboardEntityPOMCore,
  type EntityConfig,
} from './pom'

// =============================================================================
// HELPERS
// =============================================================================
export {
  ApiInterceptor,
  type ApiInterceptorConfig,
} from './helpers'
