/**
 * Posts POM - Blog Theme Posts List Page
 *
 * Entity-specific POM for posts listing with selector mapping.
 * Maps current blog theme selectors to the entity testing convention.
 *
 * Current selectors (blog theme):
 *   posts-list-container, posts-create-button, posts-table-container
 *
 * Convention selectors (target):
 *   posts-page, posts-create-btn, posts-table
 *
 * This POM uses the CURRENT selectors from the blog theme components
 * while providing the same API as the generic EntityList.
 *
 * Test cases: BLOG_POST_READ_001-005, BLOG_POST_DELETE_001-003
 */

import { EntityList, EntityConfig } from './EntityList'
import entitiesConfig from '../../fixtures/entities.json'

export class PostsPOM extends EntityList {
  // Static entity config from entities.json
  static entityConfig = entitiesConfig.entities.posts as EntityConfig
  static slug = PostsPOM.entityConfig.slug
  static fields = PostsPOM.entityConfig.fields

  constructor() {
    super('posts')
  }

  // ============================================
  // STATIC FACTORY METHOD
  // ============================================

  static for(_entityKey: string): PostsPOM {
    return new PostsPOM()
  }

  // ============================================
  // SELECTOR MAPPING (Current -> Convention)
  // Blog theme uses slightly different selectors than convention
  // ============================================

  /**
   * Override selectors to use current blog theme selectors
   * This maintains backwards compatibility with existing components
   */
  get selectors() {
    const slug = this.slug
    return {
      // Page elements - MAPPED to current blog selectors
      page: '[data-cy="posts-list-container"]',  // Convention: posts-page
      pageTitle: '[data-cy="posts-list-title"]',

      // Table - MAPPED
      table: '[data-cy="posts-table"]',
      tableContainer: '[data-cy="posts-table-container"]',  // Convention: posts-table

      // Create button - MAPPED
      createButton: '[data-cy="posts-create-button"]',  // Convention: posts-create-btn

      // Search
      search: '[data-cy="posts-search"]',
      searchInput: '[data-cy="posts-search-input"]',

      // Sort
      sortSelect: '[data-cy="posts-sort-select"]',

      // Filters (inherited from EntityList)
      filter: (fieldName: string) => `[data-cy="${slug}-filter-${fieldName}"]`,
      filterTrigger: (fieldName: string) => `[data-cy="${slug}-filter-${fieldName}-trigger"]`,
      filterOption: (fieldName: string, value: string) => `[data-cy="${slug}-filter-${fieldName}-option-${value}"]`,

      // Rows
      row: (id: string) => `[data-cy="${slug}-row-${id}"]`,
      rowGeneric: `[data-cy^="${slug}-row-"]`,

      // Cards (for grid view)
      card: (id: string) => `[data-cy="${slug}-card-${id}"]`,
      cardGeneric: `[data-cy^="${slug}-card-"]`,
      cardTitle: (id: string) => `[data-cy="${slug}-card-title-${id}"]`,

      // Row-specific elements
      rowTitle: (id: string) => `[data-cy="${slug}-title-${id}"]`,
      rowStatus: (id: string) => `[data-cy="${slug}-status-${id}"]`,

      // Actions - MAPPED (current uses posts-actions-{id}, convention: posts-actions-trigger-{id})
      actionEdit: (id: string) => `[data-cy="${slug}-edit-${id}"]`,
      actionDelete: (id: string) => `[data-cy="${slug}-delete-${id}"]`,
      actionView: (id: string) => `[data-cy="${slug}-view-live-${id}"]`,
      actionPublish: (id: string) => `[data-cy="${slug}-publish-${id}"]`,
      actionUnpublish: (id: string) => `[data-cy="${slug}-unpublish-${id}"]`,
      actionsDropdown: (id: string) => `[data-cy="${slug}-actions-${id}"]`,
      actionsTrigger: (id: string) => `[data-cy="${slug}-actions-${id}"]`,  // Same as dropdown in blog

      // Pagination
      pagination: `[data-cy="${slug}-pagination"]`,
      paginationPrev: `[data-cy="${slug}-pagination-prev"]`,
      paginationNext: `[data-cy="${slug}-pagination-next"]`,

      // Bulk actions
      bulkActions: '[data-cy="posts-bulk-actions"]',
      bulkPublish: '[data-cy="posts-bulk-publish"]',
      bulkDelete: '[data-cy="posts-bulk-delete"]',

      // States
      loading: '[data-cy="posts-loading"]',
      emptyState: '[data-cy="posts-empty"]',
      emptyCreate: '[data-cy="posts-empty-create"]',

      // Dialogs - MAPPED
      deleteDialog: '[data-cy="posts-delete-dialog"]',  // Convention: posts-confirm-delete
      confirmDelete: '[data-cy="posts-delete-dialog"]',
      confirmDeleteBtn: '[data-cy="posts-delete-confirm"]',
      cancelDeleteBtn: '[data-cy="posts-delete-cancel"]',
    }
  }

  // ============================================
  // POSTS-SPECIFIC SELECTORS
  // ============================================

  get postSelectors() {
    return {
      // Stats/Filters
      statAll: '[data-cy="posts-stat-all"]',
      statPublished: '[data-cy="posts-stat-published"]',
      statDraft: '[data-cy="posts-stat-draft"]',
      statScheduled: '[data-cy="posts-stat-scheduled"]',

      // View Toggles
      viewTable: '[data-cy="posts-view-table"]',
      viewGrid: '[data-cy="posts-view-grid"]',

      // View Containers
      tableContainer: '[data-cy="posts-table-container"]',
      gridContainer: '[data-cy="posts-grid-container"]',

      // Toolbar
      toolbar: '[data-cy="posts-toolbar"]',
    }
  }

  // ============================================
  // POSTS-SPECIFIC METHODS
  // ============================================

  /**
   * Validate the posts list page is visible and loaded
   */
  validateListVisible() {
    cy.get(this.selectors.page).should('be.visible')
    cy.get(this.selectors.pageTitle).should('be.visible')
    cy.url().should('include', '/dashboard/posts')
    return this
  }

  /**
   * Validate loading state
   */
  validateLoading() {
    cy.get(this.selectors.loading).should('be.visible')
    return this
  }

  /**
   * Wait for loading to complete
   */
  waitForLoadingComplete() {
    cy.get(this.selectors.loading).should('not.exist')
    return this
  }

  /**
   * Filter posts by status using stat buttons
   */
  filterByStatus(status: 'all' | 'published' | 'draft' | 'scheduled') {
    const statusMap = {
      all: this.postSelectors.statAll,
      published: this.postSelectors.statPublished,
      draft: this.postSelectors.statDraft,
      scheduled: this.postSelectors.statScheduled,
    }
    cy.get(statusMap[status]).click()
    return this
  }

  /**
   * Set view mode
   */
  setViewMode(mode: 'table' | 'grid') {
    if (mode === 'table') {
      cy.get(this.postSelectors.viewTable).click()
    } else {
      cy.get(this.postSelectors.viewGrid).click()
    }
    return this
  }

  /**
   * Validate current view mode
   */
  validateViewMode(mode: 'table' | 'grid') {
    if (mode === 'table') {
      cy.get(this.postSelectors.tableContainer).should('be.visible')
    } else {
      cy.get(this.postSelectors.gridContainer).should('be.visible')
    }
    return this
  }

  /**
   * Sort posts by selecting option
   */
  sortBy(option: string) {
    cy.get(this.selectors.sortSelect).click()
    cy.get(`[data-value="${option}"]`).click()
    return this
  }

  /**
   * Get post row element (table view)
   */
  getPostRow(id: string) {
    return cy.get(this.selectors.row(id))
  }

  /**
   * Get post card element (grid view)
   */
  getPostCard(id: string) {
    return cy.get(this.selectors.card(id))
  }

  /**
   * Click on post title to navigate to edit
   */
  clickPostTitle(id: string) {
    cy.get(this.selectors.rowTitle(id)).click()
    return this
  }

  /**
   * Open actions menu for a post
   */
  openPostActions(id: string) {
    cy.get(this.selectors.actionsDropdown(id)).click()
    return this
  }

  /**
   * Click edit action for a post
   */
  clickEdit(id: string) {
    this.openPostActions(id)
    cy.get(this.selectors.actionEdit(id)).click()
    return this
  }

  /**
   * Click publish action for a post
   */
  clickPublish(id: string) {
    this.openPostActions(id)
    cy.get(this.selectors.actionPublish(id)).click()
    return this
  }

  /**
   * Click unpublish action for a post
   */
  clickUnpublish(id: string) {
    this.openPostActions(id)
    cy.get(this.selectors.actionUnpublish(id)).click()
    return this
  }

  /**
   * Click delete action for a post (opens confirmation dialog)
   */
  clickDelete(id: string) {
    this.openPostActions(id)
    cy.get(this.selectors.actionDelete(id)).click()
    return this
  }

  /**
   * Validate delete dialog is visible
   */
  validateDeleteDialogVisible() {
    cy.get(this.selectors.deleteDialog).should('be.visible')
    return this
  }

  /**
   * Validate a post exists in the list
   */
  validatePostExists(id: string) {
    cy.get(this.selectors.row(id)).should('exist')
    return this
  }

  /**
   * Validate a post does not exist in the list
   */
  validatePostNotExists(id: string) {
    cy.get(this.selectors.row(id)).should('not.exist')
    return this
  }

  /**
   * Validate post status badge using data-cy-status attribute
   */
  validatePostStatus(id: string, status: 'draft' | 'published' | 'scheduled') {
    cy.get(this.selectors.rowStatus(id))
      .should('be.visible')
      .and('have.attr', 'data-cy-status', status)
    return this
  }

  /**
   * Validate post count in list
   */
  validatePostCount(count: number) {
    if (count === 0) {
      cy.get(this.selectors.emptyState).should('be.visible')
    } else {
      cy.get(this.selectors.rowGeneric).should('have.length', count)
    }
    return this
  }

  /**
   * Validate stat count
   */
  validateStatCount(status: 'all' | 'published' | 'draft' | 'scheduled', count: number) {
    const statusMap = {
      all: this.postSelectors.statAll,
      published: this.postSelectors.statPublished,
      draft: this.postSelectors.statDraft,
      scheduled: this.postSelectors.statScheduled,
    }
    cy.get(statusMap[status]).should('contain.text', count.toString())
    return this
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Visit the posts list page
   */
  visit() {
    cy.visit('/dashboard/posts')
    this.validateListVisible()
    return this
  }
}

export default PostsPOM
