/**
 * Productivity Theme - Block Selectors
 *
 * This file defines selectors for block components in the theme.
 * It's placed in lib/ instead of tests/ so TypeScript can resolve imports.
 *
 * Used by:
 * - Block components (for data-cy attributes)
 * - Cypress tests (via tests/cypress/src/selectors.ts)
 */

import { createSelectorHelpers } from '@nextsparkjs/core/lib/test/selector-factory'
import { CORE_SELECTORS } from '@nextsparkjs/core/lib/test/core-selectors'

// =============================================================================
// BLOCK SELECTORS
// =============================================================================

/**
 * Block-specific selectors for the productivity theme.
 * Each block has at minimum a 'container' selector.
 * Dynamic selectors use {index} placeholder.
 */
export const BLOCK_SELECTORS = {
  // Productivity theme currently has no custom blocks
  // Add block selectors here when blocks are created
} as const

// =============================================================================
// ENTITY SELECTORS
// =============================================================================

/**
 * Entity-specific selectors for the productivity theme.
 */
export const ENTITY_SELECTORS = {
  boards: {
    list: 'boards-list',
    listItem: 'board-item-{index}',
    card: 'board-card-{id}',
    name: 'board-name',
    description: 'board-description',
    createButton: 'board-create-button',
    editButton: 'board-edit-button',
    deleteButton: 'board-delete-button',
    settingsButton: 'board-settings-button',
    form: {
      container: 'board-form',
      name: 'board-form-name',
      description: 'board-form-description',
      submit: 'board-form-submit',
      cancel: 'board-form-cancel',
    },
  },
  lists: {
    container: 'list-container-{id}',
    header: 'list-header-{id}',
    name: 'list-name',
    cardsContainer: 'list-cards-{id}',
    addCardButton: 'list-add-card-{id}',
    createButton: 'list-create-button',
    editButton: 'list-edit-button',
    deleteButton: 'list-delete-button',
    moveHandle: 'list-move-handle-{id}',
    form: {
      container: 'list-form',
      name: 'list-form-name',
      submit: 'list-form-submit',
      cancel: 'list-form-cancel',
    },
  },
  cards: {
    container: 'card-container-{id}',
    title: 'card-title',
    description: 'card-description',
    dueDate: 'card-due-date',
    assignee: 'card-assignee',
    labels: 'card-labels',
    createButton: 'card-create-button',
    editButton: 'card-edit-button',
    deleteButton: 'card-delete-button',
    moveHandle: 'card-move-handle-{id}',
    form: {
      container: 'card-form',
      title: 'card-form-title',
      description: 'card-form-description',
      dueDate: 'card-form-due-date',
      assignee: 'card-form-assignee',
      labels: 'card-form-labels',
      submit: 'card-form-submit',
      cancel: 'card-form-cancel',
    },
    detail: {
      modal: 'card-detail-modal',
      header: 'card-detail-header',
      body: 'card-detail-body',
      comments: 'card-detail-comments',
      attachments: 'card-detail-attachments',
      checklist: 'card-detail-checklist',
      closeButton: 'card-detail-close',
    },
  },
} as const

// =============================================================================
// KANBAN-SPECIFIC SELECTORS
// =============================================================================

/**
 * Kanban-specific UI selectors.
 */
export const KANBAN_SELECTORS = {
  board: {
    container: 'kanban-board',
    header: 'kanban-board-header',
    listsContainer: 'kanban-lists-container',
    addListButton: 'kanban-add-list-button',
    settings: 'kanban-board-settings',
  },
  dragDrop: {
    dragging: 'dragging',
    dragHandle: 'drag-handle',
    dropZone: 'drop-zone-{id}',
    dropIndicator: 'drop-indicator',
    placeholder: 'drag-placeholder',
  },
  filters: {
    container: 'kanban-filters',
    search: 'kanban-search',
    assigneeFilter: 'kanban-assignee-filter',
    labelFilter: 'kanban-label-filter',
    dueDateFilter: 'kanban-due-date-filter',
    clearFilters: 'kanban-clear-filters',
  },
} as const

// =============================================================================
// THEME SELECTORS (CORE + BLOCKS + ENTITIES + KANBAN)
// =============================================================================

/**
 * Complete theme selectors merging core, blocks, and entities.
 */
export const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  blocks: BLOCK_SELECTORS,
  entities: ENTITY_SELECTORS,
  kanban: KANBAN_SELECTORS,
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
 * sel('entities.boards.list') // 'boards-list'
 * sel('entities.cards.container', { id: 'abc123' }) // 'card-container-abc123'
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
 * cySelector('entities.boards.list') // '[data-cy="boards-list"]'
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
export type KanbanSelectorsType = typeof KANBAN_SELECTORS
export type { Replacements } from '@nextsparkjs/core/lib/test/selector-factory'
export { CORE_SELECTORS }
