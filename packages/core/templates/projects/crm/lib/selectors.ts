/**
 * CRM Theme - Block Selectors
 *
 * This file defines selectors for block components in the theme.
 * It's placed in lib/ instead of tests/ so TypeScript can resolve imports.
 *
 * Used by:
 * - Block components (for data-cy attributes)
 * - Cypress tests (via tests/cypress/src/selectors.ts)
 */

import { createSelectorHelpers, CORE_SELECTORS } from '@nextsparkjs/core/selectors'

// =============================================================================
// BLOCK SELECTORS
// =============================================================================

/**
 * Block-specific selectors for the CRM theme.
 * Each block has at minimum a 'container' selector.
 * Dynamic selectors use {index} placeholder.
 */
export const BLOCK_SELECTORS = {
  // CRM theme currently has no custom blocks
  // Add block selectors here when blocks are created
} as const

// =============================================================================
// ENTITY SELECTORS
// =============================================================================

/**
 * Entity-specific selectors for the CRM theme.
 */
export const ENTITY_SELECTORS = {
  leads: {
    list: 'leads-list',
    listItem: 'lead-item-{index}',
    card: 'lead-card-{id}',
    name: 'lead-name',
    email: 'lead-email',
    phone: 'lead-phone',
    company: 'lead-company',
    status: 'lead-status',
    source: 'lead-source',
    createButton: 'lead-create-button',
    editButton: 'lead-edit-button',
    deleteButton: 'lead-delete-button',
    convertButton: 'lead-convert-button',
    form: {
      container: 'lead-form',
      name: 'lead-form-name',
      email: 'lead-form-email',
      phone: 'lead-form-phone',
      company: 'lead-form-company',
      status: 'lead-form-status',
      source: 'lead-form-source',
      submit: 'lead-form-submit',
      cancel: 'lead-form-cancel',
    },
  },
  contacts: {
    list: 'contacts-list',
    listItem: 'contact-item-{index}',
    card: 'contact-card-{id}',
    name: 'contact-name',
    email: 'contact-email',
    phone: 'contact-phone',
    company: 'contact-company',
    createButton: 'contact-create-button',
    editButton: 'contact-edit-button',
    deleteButton: 'contact-delete-button',
    form: {
      container: 'contact-form',
      firstName: 'contact-form-first-name',
      lastName: 'contact-form-last-name',
      email: 'contact-form-email',
      phone: 'contact-form-phone',
      company: 'contact-form-company',
      submit: 'contact-form-submit',
      cancel: 'contact-form-cancel',
    },
  },
  companies: {
    list: 'companies-list',
    listItem: 'company-item-{index}',
    card: 'company-card-{id}',
    name: 'company-name',
    website: 'company-website',
    industry: 'company-industry',
    size: 'company-size',
    createButton: 'company-create-button',
    editButton: 'company-edit-button',
    deleteButton: 'company-delete-button',
    form: {
      container: 'company-form',
      name: 'company-form-name',
      website: 'company-form-website',
      industry: 'company-form-industry',
      size: 'company-form-size',
      submit: 'company-form-submit',
      cancel: 'company-form-cancel',
    },
  },
  opportunities: {
    list: 'opportunities-list',
    listItem: 'opportunity-item-{index}',
    card: 'opportunity-card-{id}',
    name: 'opportunity-name',
    value: 'opportunity-value',
    stage: 'opportunity-stage',
    probability: 'opportunity-probability',
    closeDate: 'opportunity-close-date',
    createButton: 'opportunity-create-button',
    editButton: 'opportunity-edit-button',
    deleteButton: 'opportunity-delete-button',
    form: {
      container: 'opportunity-form',
      name: 'opportunity-form-name',
      value: 'opportunity-form-value',
      stage: 'opportunity-form-stage',
      probability: 'opportunity-form-probability',
      closeDate: 'opportunity-form-close-date',
      submit: 'opportunity-form-submit',
      cancel: 'opportunity-form-cancel',
    },
  },
  activities: {
    list: 'activities-list',
    listItem: 'activity-item-{index}',
    card: 'activity-card-{id}',
    type: 'activity-type',
    subject: 'activity-subject',
    dueDate: 'activity-due-date',
    status: 'activity-status',
    createButton: 'activity-create-button',
    editButton: 'activity-edit-button',
    deleteButton: 'activity-delete-button',
    completeButton: 'activity-complete-button',
    form: {
      container: 'activity-form',
      type: 'activity-form-type',
      subject: 'activity-form-subject',
      description: 'activity-form-description',
      dueDate: 'activity-form-due-date',
      submit: 'activity-form-submit',
      cancel: 'activity-form-cancel',
    },
  },
  notes: {
    list: 'notes-list',
    listItem: 'note-item-{index}',
    card: 'note-card-{id}',
    title: 'note-title',
    content: 'note-content',
    createButton: 'note-create-button',
    editButton: 'note-edit-button',
    deleteButton: 'note-delete-button',
    form: {
      container: 'note-form',
      title: 'note-form-title',
      content: 'note-form-content',
      submit: 'note-form-submit',
      cancel: 'note-form-cancel',
    },
  },
  campaigns: {
    list: 'campaigns-list',
    listItem: 'campaign-item-{index}',
    card: 'campaign-card-{id}',
    name: 'campaign-name',
    type: 'campaign-type',
    status: 'campaign-status',
    budget: 'campaign-budget',
    createButton: 'campaign-create-button',
    editButton: 'campaign-edit-button',
    deleteButton: 'campaign-delete-button',
    form: {
      container: 'campaign-form',
      name: 'campaign-form-name',
      type: 'campaign-form-type',
      status: 'campaign-form-status',
      budget: 'campaign-form-budget',
      startDate: 'campaign-form-start-date',
      endDate: 'campaign-form-end-date',
      submit: 'campaign-form-submit',
      cancel: 'campaign-form-cancel',
    },
  },
  products: {
    list: 'products-list',
    listItem: 'product-item-{index}',
    card: 'product-card-{id}',
    name: 'product-name',
    sku: 'product-sku',
    price: 'product-price',
    category: 'product-category',
    createButton: 'product-create-button',
    editButton: 'product-edit-button',
    deleteButton: 'product-delete-button',
    form: {
      container: 'product-form',
      name: 'product-form-name',
      sku: 'product-form-sku',
      price: 'product-form-price',
      description: 'product-form-description',
      category: 'product-form-category',
      submit: 'product-form-submit',
      cancel: 'product-form-cancel',
    },
  },
  pipelines: {
    list: 'pipelines-list',
    listItem: 'pipeline-item-{index}',
    card: 'pipeline-card-{id}',
    name: 'pipeline-name',
    stages: 'pipeline-stages',
    createButton: 'pipeline-create-button',
    editButton: 'pipeline-edit-button',
    deleteButton: 'pipeline-delete-button',
    form: {
      container: 'pipeline-form',
      name: 'pipeline-form-name',
      description: 'pipeline-form-description',
      stages: 'pipeline-form-stages',
      submit: 'pipeline-form-submit',
      cancel: 'pipeline-form-cancel',
    },
  },
} as const

// =============================================================================
// CRM-SPECIFIC SELECTORS
// =============================================================================

/**
 * CRM-specific UI selectors.
 */
export const CRM_SELECTORS = {
  dashboard: {
    container: 'crm-dashboard',
    statsCards: 'dashboard-stats-cards',
    recentActivities: 'dashboard-recent-activities',
    pipeline: 'dashboard-pipeline',
    charts: 'dashboard-charts',
  },
  pipelineView: {
    container: 'pipeline-view',
    stage: 'pipeline-stage-{index}',
    stageHeader: 'pipeline-stage-header-{index}',
    opportunityCard: 'pipeline-opportunity-{id}',
    dropZone: 'pipeline-drop-zone-{index}',
  },
  reporting: {
    container: 'crm-reporting',
    dateRange: 'report-date-range',
    filters: 'report-filters',
    exportButton: 'report-export-button',
    chart: 'report-chart',
  },
} as const

// =============================================================================
// THEME SELECTORS (CORE + BLOCKS + ENTITIES + CRM)
// =============================================================================

/**
 * Complete theme selectors merging core, blocks, and entities.
 */
export const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  blocks: BLOCK_SELECTORS,
  entities: ENTITY_SELECTORS,
  crm: CRM_SELECTORS,
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
 * sel('entities.leads.list') // 'leads-list'
 * sel('entities.leads.listItem', { index: '0' }) // 'lead-item-0'
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
 * cySelector('entities.leads.list') // '[data-cy="leads-list"]'
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
export type EntitySelectorsType = typeof ENTITY_SELECTORS
export type CRMSelectorsType = typeof CRM_SELECTORS
export type { Replacements } from '@nextsparkjs/core/selectors'
export { CORE_SELECTORS }
