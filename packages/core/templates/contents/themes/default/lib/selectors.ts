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
 * Block-specific selectors for the default theme.
 * Each block has at minimum a 'container' selector.
 * Dynamic selectors use {index} placeholder.
 */
export const BLOCK_SELECTORS = {
  hero: {
    container: 'block-hero',
  },
  faqAccordion: {
    container: 'block-faq-accordion',
    item: 'faq-item-{index}',
    question: 'faq-question-{index}',
    answer: 'faq-answer-{index}',
  },
  benefits: {
    container: 'block-benefits',
  },
  ctaSection: {
    container: 'block-cta-section',
  },
  featuresGrid: {
    container: 'block-features-grid',
  },
  heroWithForm: {
    container: 'block-hero-with-form',
    form: {
      firstname: 'hero-form-firstname',
      lastname: 'hero-form-lastname',
      email: 'hero-form-email',
      phone: 'hero-form-phone',
      area: 'hero-form-area',
      consent: 'hero-form-consent',
      submit: 'hero-form-submit',
    },
  },
  jumbotron: {
    container: 'block-jumbotron',
  },
  logoCloud: {
    container: 'block-logo-cloud',
    item: 'logo-item-{index}',
    link: 'logo-link-{index}',
  },
  postContent: {
    container: 'block-post-content',
    divider: 'post-content-divider',
    cta: 'post-content-cta',
  },
  pricingTable: {
    container: 'block-pricing-table',
    plan: 'pricing-plan-{index}',
    features: 'plan-features',
    cta: 'plan-cta-{index}',
  },
  splitContent: {
    container: 'block-split-content',
  },
  statsCounter: {
    container: 'block-stats-counter',
  },
  testimonials: {
    container: 'block-testimonials',
  },
  textContent: {
    container: 'block-text-content',
  },
  timeline: {
    container: 'block-timeline',
  },
  videoHero: {
    container: 'block-video-hero',
  },
} as const

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
 */
export const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  blocks: BLOCK_SELECTORS,
  devtools: DEVTOOLS_SELECTORS,
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
export type { Replacements } from '@nextsparkjs/core/lib/test'
export { CORE_SELECTORS }
