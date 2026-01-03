/**
 * Theme Selectors
 *
 * Theme-level selector configuration that extends core selectors.
 * This is the single source of truth for Cypress tests in this theme.
 *
 * Architecture:
 * - Core selectors: `core/lib/test/core-selectors.ts`
 * - Theme selectors: This file (can extend core)
 * - POMs import: `import { cySelector } from '../selectors'`
 *
 * @example POM usage:
 * ```typescript
 * import { cySelector, sel, SELECTORS } from '../selectors'
 *
 * class MyPOM extends BasePOM {
 *   get elements() {
 *     return {
 *       loginForm: cySelector('auth.login.form'),
 *       submitButton: cySelector('auth.login.submit'),
 *     }
 *   }
 * }
 * ```
 *
 * @example Extending with theme-specific selectors:
 * ```typescript
 * const THEME_SELECTORS = {
 *   ...CORE_SELECTORS,
 *   myThemeFeature: {
 *     button: 'theme-specific-button',
 *     modal: 'theme-specific-modal',
 *   }
 * }
 * ```
 */

import { createSelectorHelpers } from '../../../../../lib/test/selector-factory'
import { CORE_SELECTORS } from '../../../../../lib/test/core-selectors'

// =============================================================================
// THEME SELECTORS
// =============================================================================

/**
 * Theme selectors extending core.
 *
 * Add theme-specific selectors here. For example:
 *
 * const THEME_SELECTORS = {
 *   ...CORE_SELECTORS,
 *   themeSpecific: {
 *     specialButton: 'theme-special-btn',
 *   }
 * }
 */
const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  // Add theme-specific selectors here if needed
  // themeFeature: {
  //   button: 'theme-feature-btn',
  // }
} as const

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Create helpers bound to theme selectors
 */
const helpers = createSelectorHelpers(THEME_SELECTORS)

/**
 * Full selectors object (core + theme extensions)
 */
export const SELECTORS = helpers.SELECTORS

/**
 * Get a selector value by path
 *
 * @example
 * sel('auth.login.form') // 'login-form'
 * sel('entities.table.row', { slug: 'customers', id: '123' }) // 'customers-row-123'
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
 *
 * @example
 * cySelector('auth.login.form') // '[data-cy="login-form"]'
 * cySelector('entities.table.row', { slug: 'customers', id: '123' }) // '[data-cy="customers-row-123"]'
 */
export const cySelector = helpers.cySelector

/**
 * Create entity-specific selector helpers
 *
 * @example
 * const taskSel = entitySelectors('tasks')
 * taskSel.row('abc123') // 'tasks-row-abc123'
 */
export const entitySelectors = helpers.entitySelectors

/**
 * Type for the selectors object
 */
export type ThemeSelectorsType = typeof THEME_SELECTORS

/**
 * Re-export types
 */
export type { Replacements } from '../../../../../lib/test/selector-factory'

/**
 * Re-export CORE_SELECTORS for reference
 */
export { CORE_SELECTORS }
