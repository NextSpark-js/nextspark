/**
 * Posts List POM
 *
 * Page Object Model for the Posts list page in the admin dashboard.
 * Covers list viewing, search, filtering, and navigation to create/edit posts.
 *
 * Convention: posts-{component}-{element}
 * Based on selectors documented in tests.md
 */

import { ApiInterceptor } from '../helpers/ApiInterceptor'

export interface PostFormData {
  title: string
  slug: string
  excerpt?: string
  featuredImage?: string
  categoryIds?: string[]
  published?: boolean
  locale?: 'en' | 'es'
}

export class PostsListPOM {
  // ============================================
  // STATIC CONFIG
  // ============================================

  static get slug() {
    return 'posts'
  }

  // ============================================
  // API INTERCEPTOR (for deterministic waits)
  // ============================================

  private static _api: ApiInterceptor | null = null

  /**
   * Get the API interceptor instance for posts
   * Lazy-initialized on first access
   */
  static get api(): ApiInterceptor {
    if (!this._api) {
      this._api = new ApiInterceptor(this.slug)
    }
    return this._api
  }

  /**
   * Setup API intercepts for CRUD operations
   * Call this in beforeEach BEFORE navigation
   */
  static setupApiIntercepts(): typeof PostsListPOM {
    this.api.setupCrudIntercepts()
    return this
  }

  // ============================================
  // SELECTORS - Posts List
  // ============================================

  static get listSelectors() {
    // Using entity testing convention: {slug}-{component}
    // Based on createCyId(entityConfig.slug, component) from testing-utils.ts
    return {
      page: '[data-cy="posts-page"]',
      title: '[data-cy="posts-title"]',
      table: '[data-cy="posts-table"], table',
      createBtn: '[data-cy="posts-add"]',
      searchContainer: '[data-cy="posts-search"]',
      searchInput: '[data-cy="posts-search-input"]',
      categoryFilter: '[data-cy="posts-filter-categoryId"]',
      statusFilter: '[data-cy="posts-filter-status"]',
      pagination: '[data-cy="posts-pagination"]',
      row: (id: string) => `[data-cy="posts-row-${id}"]`,
      rowGeneric: 'table tbody tr',
      // Row menu actions (EntityTable patterns)
      menuTrigger: (id: string) => `[data-cy="posts-menu-${id}"]`,
      menuEdit: (id: string) => `[data-cy="posts-menu-edit-${id}"]`,
      menuDelete: (id: string) => `[data-cy="posts-menu-delete-${id}"]`,
      menuView: (id: string) => `[data-cy="posts-menu-view-${id}"]`,
      confirmDelete: '[data-cy="posts-confirm-delete"], [role="dialog"]',
      confirmDeleteBtn: '[data-cy="posts-confirm-delete-btn"], [role="dialog"] button:contains("Delete"), button.bg-destructive',
      cancelDeleteBtn: '[data-cy="posts-cancel-delete-btn"], [role="dialog"] button:contains("Cancel"),[role="dialog"] button[type="button"]:not(.bg-destructive)',
      emptyState: 'td:contains("No posts")',
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  static visitList() {
    cy.visit('/dashboard/posts')
    return this
  }

  static visitCreate() {
    cy.visit('/dashboard/posts/create')
    return this
  }

  static visitEdit(id: string) {
    cy.visit(`/dashboard/posts/${id}/edit`)
    return this
  }

  // ============================================
  // API-AWARE NAVIGATION
  // ============================================

  /**
   * Visit list page with API intercepts and wait for data load
   */
  static visitListWithApiWait(): typeof PostsListPOM {
    this.setupApiIntercepts()
    this.visitList()
    this.api.waitForList()
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  static waitForListLoad() {
    cy.url().should('include', '/dashboard/posts')
    cy.get(this.listSelectors.page, { timeout: 15000 }).should('exist')
    return this
  }

  // ============================================
  // LIST PAGE INTERACTIONS
  // ============================================

  static clickCreatePost() {
    cy.get(this.listSelectors.createBtn).click()
    return this
  }

  static searchPosts(term: string) {
    cy.get(this.listSelectors.searchInput).clear().type(term)
    return this
  }

  static clearSearch() {
    cy.get(this.listSelectors.searchInput).clear()
    return this
  }

  static filterByCategory(categoryName: string) {
    cy.get(this.listSelectors.categoryFilter).click()
    cy.contains('[role="option"]', categoryName).click()
    return this
  }

  static filterByStatus(status: 'all' | 'published' | 'draft') {
    cy.get(this.listSelectors.statusFilter).click()
    cy.contains('[role="option"]', status).click()
    return this
  }

  static openRowMenu(id: string) {
    cy.get(this.listSelectors.menuTrigger(id)).click()
    return this
  }

  static clickMenuEdit(id: string) {
    cy.get(this.listSelectors.menuEdit(id)).click()
    return this
  }

  static clickMenuDelete(id: string) {
    cy.get(this.listSelectors.menuDelete(id)).click()
    return this
  }

  static clickMenuView(id: string) {
    cy.get(this.listSelectors.menuView(id)).click()
    return this
  }

  static confirmDelete() {
    cy.get(this.listSelectors.confirmDeleteBtn).click()
    return this
  }

  static cancelDelete() {
    cy.get(this.listSelectors.cancelDeleteBtn).click()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  static assertListPageVisible() {
    cy.get(this.listSelectors.page).should('exist')
    return this
  }

  static assertPostInList(title: string) {
    cy.contains(this.listSelectors.rowGeneric, title).should('be.visible')
    return this
  }

  static assertPostNotInList(title: string) {
    cy.contains(this.listSelectors.rowGeneric, title).should('not.exist')
    return this
  }

  static assertEmptyList() {
    cy.get(this.listSelectors.emptyState).should('be.visible')
    return this
  }

  static assertCategoryBadgeVisible(categoryName: string) {
    cy.contains(this.listSelectors.table, categoryName).should('be.visible')
    return this
  }
}

export default PostsListPOM
