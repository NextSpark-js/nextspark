/**
 * Block selectors, and a `sel` bound to them alone.
 *
 * Block components import `sel` from here, not from ./selectors: that file merges CORE_SELECTORS (every domain's
 * map, ~10 kB gzip), and the loader that renders a page imports every block, so a block importing it puts the
 * whole map on each public page. ./selectors re-exports BLOCK_SELECTORS, so Cypress still reaches the same paths.
 */

import { createSelectorHelpers } from '@nextsparkjs/core/lib/selectors/selector-factory'

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

export const { sel } = createSelectorHelpers({ blocks: BLOCK_SELECTORS })
