/**
 * Selectors Module
 *
 * Exports all selector-related utilities for testing.
 */

// Factory and utilities
export {
  createSelectorHelpers,
  getNestedValue,
  replacePlaceholders,
  type Replacements,
  type SelectorObject,
  type SelectorHelpers,
  type EntitySelectorHelpers,
} from './selector-factory'

// Core selectors
export { CORE_SELECTORS, type CoreSelectorsType } from './core-selectors'

// Pre-bound helpers
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
