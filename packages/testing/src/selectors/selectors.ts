/**
 * Centralized Selector System
 *
 * Single source of truth for data-cy selectors.
 * Components consume selectors from this module, ensuring consistency
 * between UI components, POM classes, and tests.
 *
 * Architecture:
 * - `core-selectors.ts` - CORE_SELECTORS object (selector definitions)
 * - `selector-factory.ts` - createSelectorHelpers() factory function
 * - `selectors.ts` (this file) - Pre-bound exports for core usage
 *
 * @example Component usage:
 * ```tsx
 * import { sel } from '@nextsparkjs/testing/selectors'
 *
 * <nav data-cy={sel('dashboard.navigation.main')}>
 *   <Link data-cy={sel('dashboard.navigation.entityLink', { slug: 'customers' })}>
 * ```
 *
 * @example Test/POM usage:
 * ```ts
 * import { cySelector } from '@nextsparkjs/testing/selectors'
 *
 * cy.get(cySelector('dashboard.navigation.main'))
 * ```
 *
 * @example Theme extension:
 * ```ts
 * // In theme's selectors.ts
 * import { createSelectorHelpers, CORE_SELECTORS } from '@nextsparkjs/testing/selectors'
 *
 * const THEME_SELECTORS = { ...CORE_SELECTORS, myFeature: { ... } }
 * export const { sel, cySelector } = createSelectorHelpers(THEME_SELECTORS)
 * ```
 */

import { createSelectorHelpers } from './selector-factory'
import { CORE_SELECTORS, type CoreSelectorsType } from './core-selectors'

// =============================================================================
// PRE-BOUND EXPORTS (for core components)
// =============================================================================

/**
 * Create helpers bound to CORE_SELECTORS
 */
const helpers = createSelectorHelpers(CORE_SELECTORS)

/**
 * Main selector object - single source of truth
 */
export const SELECTORS = helpers.SELECTORS

/**
 * Get a selector value by path with optional placeholder replacements.
 * @see selector-factory.ts for full documentation
 */
export const sel = helpers.sel

/**
 * Alias for sel
 */
export const s = helpers.s

/**
 * Get selector only in dev/test environments
 */
export const selDev = helpers.selDev

/**
 * Get Cypress selector string [data-cy="..."]
 */
export const cySelector = helpers.cySelector

/**
 * Create entity-specific selector helpers
 */
export const entitySelectors = helpers.entitySelectors

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Type for the SELECTORS object
 */
export type SelectorsType = CoreSelectorsType

/**
 * Re-export Replacements type
 */
export type { Replacements } from './selector-factory'

/**
 * Helper type to extract leaf paths from nested object
 */
type PathImpl<T, K extends keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? T[K] extends ArrayLike<unknown>
      ? K
      : `${K}.${PathImpl<T[K], keyof T[K]>}`
    : K
  : never

type Path<T> = PathImpl<T, keyof T>

/**
 * All valid selector paths
 */
export type SelectorPath = Path<SelectorsType>

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  SELECTORS,
  sel,
  s,
  selDev,
  cySelector,
  entitySelectors,
}
