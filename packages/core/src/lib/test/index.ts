/**
 * Core Testing Utilities - RUNTIME
 *
 * These utilities are used by core components at runtime for:
 * - data-cy attributes (via sel())
 * - Accessibility attributes
 * - Testing props
 *
 * For Cypress tests in npm mode, use @nextsparkjs/testing
 *
 * NOTE: Selector definitions live in @nextsparkjs/core/selectors
 * This module re-exports them for backward compatibility.
 */

// =============================================================================
// SELECTORS (re-exported from lib/selectors which re-exports from testing)
// =============================================================================

export * from '../selectors'

// =============================================================================
// TESTING UTILITIES (kept here for runtime usage)
// =============================================================================

export {
  createStateAttr,
  createPriorityAttr,
  createTestingProps,
  createAriaLabel,
  keyboardHelpers,
} from './utils'
