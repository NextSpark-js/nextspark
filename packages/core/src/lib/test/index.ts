/**
 * Core Testing Utilities - RUNTIME
 *
 * These utilities are used by core components at runtime for:
 * - data-cy attributes
 * - Accessibility attributes
 * - Testing props
 *
 * For Cypress tests in npm mode, use @nextsparkjs/testing
 */

// Selector exports
export {
  CORE_SELECTORS,
  type CoreSelectorsType,
} from './core-selectors'

export {
  createSelectorHelpers,
  getNestedValue,
  replacePlaceholders,
  type Replacements,
  type SelectorObject,
  type SelectorHelpers,
  type EntitySelectorHelpers,
} from './selector-factory'

export {
  SELECTORS,
  sel,
  s,
  selDev,
  cySelector,
  entitySelectors,
  type SelectorsType,
  type SelectorPath,
} from './selectors'

// Utility exports
export {
  type TestIdPattern,
  type CypressIdPattern,
  createTestId,
  createCyId,
  createStateAttr,
  createPriorityAttr,
  createTestingProps,
  createAriaLabel,
  testingPatterns,
  keyboardHelpers,
  createEntityCyId,
  createEntityTestingHelper,
  type EntityTestingHelper,
} from './utils'
