/**
 * Core Selectors - SOURCE OF TRUTH
 *
 * This is the central location for all selector definitions.
 * The testing package re-exports from here.
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

// Domain selectors (re-exported from core-selectors)
export * from './domains'

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
