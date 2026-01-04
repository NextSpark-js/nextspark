/**
 * Theme Block Selectors
 *
 * This file defines selectors for block components in the theme.
 * It's placed in lib/ instead of tests/ so TypeScript can resolve imports.
 *
 * Used by:
 * - Block components (for data-cy attributes)
 * - Cypress tests (via tests/cypress/src/selectors.ts)
 */

import { createSelectorHelpers, CORE_SELECTORS } from '@nextsparkjs/core/lib/test'

// =============================================================================
// BLOCK SELECTORS
// =============================================================================

/**
 * Block-specific selectors for the starter theme.
 * Each block has at minimum a 'container' selector.
 * Dynamic selectors use {index} placeholder.
 */
export const BLOCK_SELECTORS = {
  hero: {
    container: 'block-hero',
    cta: 'hero-cta',
  },
} as const

// =============================================================================
// THEME SELECTORS (CORE + BLOCKS)
// =============================================================================

/**
 * Complete theme selectors merging core and blocks.
 */
export const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  blocks: BLOCK_SELECTORS,
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
 * sel('blocks.hero.container') // 'block-hero'
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
 * cySelector('blocks.hero.container') // '[data-cy="block-hero"]'
 */
export const cySelector = helpers.cySelector

/**
 * Create entity-specific selector helpers
 */
export const entitySelectors = helpers.entitySelectors

/**
 * Type exports
 */
export type ThemeSelectorsType = typeof THEME_SELECTORS
export type BlockSelectorsType = typeof BLOCK_SELECTORS
export type { Replacements } from '@nextsparkjs/core/lib/test'
export { CORE_SELECTORS }
