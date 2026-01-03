/**
 * Test Utilities Index
 *
 * Centralized exports for all testing-related utilities.
 *
 * @example Component usage:
 * ```typescript
 * import { sel, cySelector, createTestId } from './'
 * ```
 *
 * @example Theme extension:
 * ```typescript
 * import { createSelectorHelpers, CORE_SELECTORS } from './'
 *
 * const THEME_SELECTORS = { ...CORE_SELECTORS, myFeature: { ... } }
 * export const { sel, cySelector } = createSelectorHelpers(THEME_SELECTORS)
 * ```
 */

// =============================================================================
// SELECTOR FACTORY - For theme extension
// =============================================================================
export {
  createSelectorHelpers,
  getNestedValue,
  replacePlaceholders,
  type Replacements,
  type SelectorObject,
  type SelectorHelpers,
  type EntitySelectorHelpers,
} from './selector-factory'

// =============================================================================
// CORE SELECTORS - Base selector definitions
// =============================================================================
export {
  CORE_SELECTORS,
  type CoreSelectorsType,
} from './core-selectors'

// =============================================================================
// SELECTORS - Pre-bound helpers for core components
// =============================================================================
export {
  // Main selector object
  SELECTORS,
  // Core functions
  sel,
  s, // alias for sel
  selDev,
  cySelector,
  // Entity helpers
  entitySelectors,
  // Types
  type SelectorsType,
  type SelectorPath,
} from './selectors'

// =============================================================================
// UTILS - Testing attribute generators and helpers
// =============================================================================
export {
  // ID generators
  createTestId,
  createCyId,
  createStateAttr,
  createPriorityAttr,
  createTestingProps,
  createAriaLabel,
  // Entity testing helpers
  createEntityCyId,
  createEntityTestingHelper,
  type EntityTestingHelper,
  // Pre-built patterns
  testingPatterns,
  // Keyboard helpers
  keyboardHelpers,
} from './utils'
