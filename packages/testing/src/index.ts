/**
 * @nextsparkjs/testing
 *
 * Testing utilities for NextSpark applications.
 * Provides selectors, Page Object Models, and Cypress helpers.
 *
 * @example Basic usage:
 * ```ts
 * import { sel, cySelector, CORE_SELECTORS } from '@nextsparkjs/testing'
 *
 * // Get selector value
 * sel('dashboard.navigation.main') // 'nav-main'
 *
 * // Get Cypress selector
 * cySelector('dashboard.navigation.main') // '[data-cy="nav-main"]'
 * ```
 *
 * @example Subpath imports (recommended for tree-shaking):
 * ```ts
 * import { sel, cySelector } from '@nextsparkjs/testing/selectors'
 * import { createEntityTestingHelper } from '@nextsparkjs/testing/utils'
 * ```
 */

// =============================================================================
// SELECTORS
// =============================================================================
export {
  // Factory and utilities
  createSelectorHelpers,
  getNestedValue,
  replacePlaceholders,
  type Replacements,
  type SelectorObject,
  type SelectorHelpers,
  type EntitySelectorHelpers,
  // Core selectors
  CORE_SELECTORS,
  type CoreSelectorsType,
  // Pre-bound helpers
  SELECTORS,
  sel,
  s,
  selDev,
  cySelector,
  entitySelectors,
  type SelectorsType,
  type SelectorPath,
} from './selectors'

// =============================================================================
// UTILS
// =============================================================================
export {
  // Types
  type TestIdPattern,
  type CypressIdPattern,
  // Basic generators
  createTestId,
  createCyId,
  // Attribute generators
  createStateAttr,
  createPriorityAttr,
  createTestingProps,
  createAriaLabel,
  // Patterns
  testingPatterns,
  // Keyboard helpers
  keyboardHelpers,
  // Entity helpers
  createEntityCyId,
  createEntityTestingHelper,
  type EntityTestingHelper,
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
