/**
 * PostsList - Blog Theme Posts List Page POM
 *
 * Handles posts listing with filters, views, and CRUD actions.
 * Supports both table and grid view modes.
 *
 * Test cases: BLOG_POST_READ_001-005, BLOG_POST_DELETE_001-003
 */
export class PostsList {
  static selectors = {
    // Container
    container: '[data-cy="posts-list-container"]',
    title: '[data-cy="posts-list-title"]',

    // Stats/Filters
    statAll: '[data-cy="posts-stat-all"]',
    statPublished: '[data-cy="posts-stat-published"]',
    statDraft: '[data-cy="posts-stat-draft"]',
    statScheduled: '[data-cy="posts-stat-scheduled"]',

    // Toolbar
    toolbar: '[data-cy="posts-toolbar"]',
    searchInput: '[data-cy="posts-search-input"]',
    sortSelect: '[data-cy="posts-sort-select"]',

    // View Toggles
    viewTable: '[data-cy="posts-view-table"]',
    viewGrid: '[data-cy="posts-view-grid"]',

    // Bulk Actions
    bulkActions: '[data-cy="posts-bulk-actions"]',
    bulkPublish: '[data-cy="posts-bulk-publish"]',
    bulkDelete: '[data-cy="posts-bulk-delete"]',

    // Table View
    tableContainer: '[data-cy="posts-table-container"]',
    table: '[data-cy="posts-table"]',

    // Grid View
    gridContainer: '[data-cy="posts-grid-container"]',

    // Create Button
    createButton: '[data-cy="posts-create-button"]',

    // States
    loading: '[data-cy="posts-loading"]',
    empty: '[data-cy="posts-empty"]',
    emptyCreate: '[data-cy="posts-empty-create"]',

    // Delete Dialog
    deleteDialog: '[data-cy="posts-delete-dialog"]',
    deleteConfirm: '[data-cy="posts-delete-confirm"]',
    deleteCancel: '[data-cy="posts-delete-cancel"]',
  }

  /**
   * Get dynamic selectors for a specific post by ID
   */
  static getPostSelectors(id) {
    return {
      // Table row
      row: `[data-cy="posts-row-${id}"]`,
      title: `[data-cy="posts-title-${id}"]`,
      status: `[data-cy="posts-status-${id}"]`,
      actions: `[data-cy="posts-actions-${id}"]`,
      edit: `[data-cy="posts-edit-${id}"]`,
      viewLive: `[data-cy="posts-view-live-${id}"]`,
      publish: `[data-cy="posts-publish-${id}"]`,
      unpublish: `[data-cy="posts-unpublish-${id}"]`,
      delete: `[data-cy="posts-delete-${id}"]`,

      // Grid card
      card: `[data-cy="posts-card-${id}"]`,
      cardTitle: `[data-cy="posts-card-title-${id}"]`,
    }
  }

  /**
   * Validate that the posts list page is visible and loaded
   */
  validateListVisible() {
    cy.get(PostsList.selectors.container).should('be.visible')
    cy.get(PostsList.selectors.title).should('be.visible')
    cy.url().should('include', '/dashboard/posts')
    return this
  }

  /**
   * Validate loading state
   */
  validateLoading() {
    cy.get(PostsList.selectors.loading).should('be.visible')
    return this
  }

  /**
   * Wait for loading to complete
   */
  waitForLoadingComplete() {
    cy.get(PostsList.selectors.loading).should('not.exist')
    return this
  }

  /**
   * Validate empty state is shown
   */
  validateEmptyState() {
    cy.get(PostsList.selectors.empty).should('be.visible')
    return this
  }

  /**
   * Filter posts by status using stat buttons
   * @param {string} status - 'all' | 'published' | 'draft' | 'scheduled'
   */
  filterByStatus(status) {
    const statusMap = {
      all: PostsList.selectors.statAll,
      published: PostsList.selectors.statPublished,
      draft: PostsList.selectors.statDraft,
      scheduled: PostsList.selectors.statScheduled,
    }
    cy.get(statusMap[status]).click()
    return this
  }

  /**
   * Search posts by term
   * @param {string} term - Search term
   */
  search(term) {
    cy.get(PostsList.selectors.searchInput)
      .clear()
      .type(term)
    return this
  }

  /**
   * Clear search input
   */
  clearSearch() {
    cy.get(PostsList.selectors.searchInput).clear()
    return this
  }

  /**
   * Set view mode
   * @param {string} mode - 'table' | 'grid'
   */
  setViewMode(mode) {
    if (mode === 'table') {
      cy.get(PostsList.selectors.viewTable).click()
    } else {
      cy.get(PostsList.selectors.viewGrid).click()
    }
    return this
  }

  /**
   * Validate current view mode
   * @param {string} mode - 'table' | 'grid'
   */
  validateViewMode(mode) {
    if (mode === 'table') {
      cy.get(PostsList.selectors.tableContainer).should('be.visible')
    } else {
      cy.get(PostsList.selectors.gridContainer).should('be.visible')
    }
    return this
  }

  /**
   * Sort posts by selecting option
   * @param {string} option - Sort option value
   */
  sortBy(option) {
    cy.get(PostsList.selectors.sortSelect).click()
    cy.get(`[data-value="${option}"]`).click()
    return this
  }

  /**
   * Click create new post button
   */
  clickCreate() {
    cy.get(PostsList.selectors.createButton).click()
    return this
  }

  /**
   * Get post row element (table view)
   * @param {string} id - Post ID
   */
  getPostRow(id) {
    return cy.get(PostsList.getPostSelectors(id).row)
  }

  /**
   * Get post card element (grid view)
   * @param {string} id - Post ID
   */
  getPostCard(id) {
    return cy.get(PostsList.getPostSelectors(id).card)
  }

  /**
   * Click on post title to navigate to edit
   * @param {string} id - Post ID
   */
  clickPostTitle(id) {
    cy.get(PostsList.getPostSelectors(id).title).click()
    return this
  }

  /**
   * Open actions menu for a post
   * @param {string} id - Post ID
   */
  openPostActions(id) {
    cy.get(PostsList.getPostSelectors(id).actions).click()
    return this
  }

  /**
   * Click edit action for a post
   * @param {string} id - Post ID
   */
  clickEdit(id) {
    this.openPostActions(id)
    cy.get(PostsList.getPostSelectors(id).edit).click()
    return this
  }

  /**
   * Click publish action for a post
   * @param {string} id - Post ID
   */
  clickPublish(id) {
    this.openPostActions(id)
    cy.get(PostsList.getPostSelectors(id).publish).click()
    return this
  }

  /**
   * Click unpublish action for a post
   * @param {string} id - Post ID
   */
  clickUnpublish(id) {
    this.openPostActions(id)
    cy.get(PostsList.getPostSelectors(id).unpublish).click()
    return this
  }

  /**
   * Click delete action for a post (opens confirmation dialog)
   * @param {string} id - Post ID
   */
  clickDelete(id) {
    this.openPostActions(id)
    cy.get(PostsList.getPostSelectors(id).delete).click()
    return this
  }

  /**
   * Confirm post deletion in dialog
   */
  confirmDelete() {
    cy.get(PostsList.selectors.deleteDialog).should('be.visible')
    cy.get(PostsList.selectors.deleteConfirm).click()
    return this
  }

  /**
   * Cancel post deletion in dialog
   */
  cancelDelete() {
    cy.get(PostsList.selectors.deleteDialog).should('be.visible')
    cy.get(PostsList.selectors.deleteCancel).click()
    return this
  }

  /**
   * Validate delete dialog is visible
   */
  validateDeleteDialogVisible() {
    cy.get(PostsList.selectors.deleteDialog).should('be.visible')
    return this
  }

  /**
   * Validate a post exists in the list
   * @param {string} id - Post ID
   */
  validatePostExists(id) {
    cy.get(PostsList.getPostSelectors(id).row).should('exist')
    return this
  }

  /**
   * Validate a post does not exist in the list
   * @param {string} id - Post ID
   */
  validatePostNotExists(id) {
    cy.get(PostsList.getPostSelectors(id).row).should('not.exist')
    return this
  }

  /**
   * Validate post status badge using data-cy-status attribute
   * @param {string} id - Post ID
   * @param {string} status - Expected status code ('draft' | 'published')
   */
  validatePostStatus(id, status) {
    cy.get(PostsList.getPostSelectors(id).status)
      .should('be.visible')
      .and('have.attr', 'data-cy-status', status)
    return this
  }

  /**
   * Validate post count in list
   * @param {number} count - Expected number of posts
   */
  validatePostCount(count) {
    if (count === 0) {
      this.validateEmptyState()
    } else {
      cy.get('[data-cy^="posts-row-"]').should('have.length', count)
    }
    return this
  }

  /**
   * Validate stat count
   * @param {string} status - Stat type ('all' | 'published' | 'draft' | 'scheduled')
   * @param {number} count - Expected count
   */
  validateStatCount(status, count) {
    const statusMap = {
      all: PostsList.selectors.statAll,
      published: PostsList.selectors.statPublished,
      draft: PostsList.selectors.statDraft,
      scheduled: PostsList.selectors.statScheduled,
    }
    cy.get(statusMap[status]).should('contain.text', count.toString())
    return this
  }
}

export default PostsList
