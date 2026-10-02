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

import { createSelectorHelpers, CORE_SELECTORS } from '@nextsparkjs/core/selectors'
import { BLOCK_SELECTORS } from './block-selectors'

// =============================================================================
// BLOCK SELECTORS
// =============================================================================

export { BLOCK_SELECTORS }

// =============================================================================
// THEME SELECTORS (CORE + BLOCKS)
// =============================================================================

// =============================================================================
// DEVTOOLS SELECTORS
// =============================================================================

/**
 * DevTools-specific selectors for the default theme.
 */
export const DEVTOOLS_SELECTORS = {
  scheduledActions: {
    page: 'devtools-scheduled-actions-page',
    filterStatus: 'scheduled-actions-filter-status',
    filterType: 'scheduled-actions-filter-type',
    filterApply: 'scheduled-actions-filter-apply',
    filterReset: 'scheduled-actions-filter-reset',
    table: 'scheduled-actions-table',
    row: 'scheduled-actions-row-{id}',
    cellType: 'scheduled-actions-cell-type',
    cellStatus: 'scheduled-actions-cell-status',
    cellScheduledAt: 'scheduled-actions-cell-scheduled-at',
    cellTeam: 'scheduled-actions-cell-team',
    cellPayload: 'scheduled-actions-cell-payload',
    cellError: 'scheduled-actions-cell-error',
    statusPending: 'scheduled-actions-status-pending',
    statusRunning: 'scheduled-actions-status-running',
    statusCompleted: 'scheduled-actions-status-completed',
    statusFailed: 'scheduled-actions-status-failed',
    pagination: 'scheduled-actions-pagination',
    paginationPrev: 'scheduled-actions-pagination-prev',
    paginationNext: 'scheduled-actions-pagination-next',
    emptyState: 'scheduled-actions-empty-state',
  },
} as const

// =============================================================================
// THEME SELECTORS (CORE + BLOCKS + DEVTOOLS)
// =============================================================================

/**
 * Complete theme selectors merging core and blocks.
 * NOTE: devtools must be MERGED (not replaced) to keep CORE_SELECTORS.devtools
 */
export const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  blocks: BLOCK_SELECTORS,
  devtools: {
    ...CORE_SELECTORS.devtools,
    ...DEVTOOLS_SELECTORS,
  },
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
 * sel('blocks.faqAccordion.item', { index: '0' }) // 'faq-item-0'
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
export type { Replacements } from '@nextsparkjs/core/lib/selectors'
export { CORE_SELECTORS }
