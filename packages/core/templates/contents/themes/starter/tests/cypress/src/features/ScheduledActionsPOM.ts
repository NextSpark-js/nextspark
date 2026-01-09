/**
 * ScheduledActionsPOM - Page Object Model for DevTools Scheduled Actions
 *
 * Provides methods for:
 * - Navigation to /devtools/scheduled-actions
 * - Filter interaction (status, action type)
 * - Table interaction and assertions
 * - Pagination controls
 * - Error and empty state assertions
 *
 * @version 1.0 - Uses centralized selectors from cySelector()
 *
 * @example
 * const scheduledActions = new ScheduledActionsPOM()
 * scheduledActions.visit()
 *                 .assertPageVisible()
 *                 .filterByStatus('pending')
 *                 .assertTableVisible()
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export class ScheduledActionsPOM extends BasePOM {
  // ============================================
  // SELECTORS using centralized cySelector()
  // ============================================

  get selectors() {
    return {
      // Page container
      page: cySelector('devtools.scheduledActions.page'),

      // Filters
      filterStatus: cySelector('devtools.scheduledActions.filterStatus'),
      filterType: cySelector('devtools.scheduledActions.filterType'),
      filterApply: cySelector('devtools.scheduledActions.filterApply'),
      filterReset: cySelector('devtools.scheduledActions.filterReset'),

      // Table
      table: cySelector('devtools.scheduledActions.table'),
      row: (id: string) => cySelector('devtools.scheduledActions.row', { id }),
      cellType: cySelector('devtools.scheduledActions.cellType'),
      cellStatus: cySelector('devtools.scheduledActions.cellStatus'),
      cellScheduledAt: cySelector('devtools.scheduledActions.cellScheduledAt'),
      cellTeam: cySelector('devtools.scheduledActions.cellTeam'),
      cellPayload: cySelector('devtools.scheduledActions.cellPayload'),
      cellError: cySelector('devtools.scheduledActions.cellError'),

      // Status badges
      statusPending: cySelector('devtools.scheduledActions.statusPending'),
      statusRunning: cySelector('devtools.scheduledActions.statusRunning'),
      statusCompleted: cySelector('devtools.scheduledActions.statusCompleted'),
      statusFailed: cySelector('devtools.scheduledActions.statusFailed'),

      // Pagination
      pagination: cySelector('devtools.scheduledActions.pagination'),
      paginationPrev: cySelector('devtools.scheduledActions.paginationPrev'),
      paginationNext: cySelector('devtools.scheduledActions.paginationNext'),

      // Empty state
      emptyState: cySelector('devtools.scheduledActions.emptyState'),
    }
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): ScheduledActionsPOM {
    return new ScheduledActionsPOM()
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Visit /devtools/scheduled-actions page
   */
  visit() {
    cy.visit('/devtools/scheduled-actions')
    return this
  }

  /**
   * Visit with failOnStatusCode: false (for access control tests)
   */
  attemptToVisit() {
    cy.visit('/devtools/scheduled-actions', { failOnStatusCode: false })
    return this
  }

  // ============================================
  // FILTER ACTIONS
  // ============================================

  /**
   * Filter by status using shadcn/ui Select (Radix UI)
   *
   * Uses text-based selection which is more reliable for Radix UI Select
   * since data-value attributes may have different formats.
   *
   * @param status - 'all' | 'pending' | 'running' | 'completed' | 'failed'
   */
  filterByStatus(status: string) {
    // Map values to display labels (matches i18n translations)
    const statusLabels: Record<string, string> = {
      all: 'All',
      pending: 'Pending',
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
    }

    // Click the SelectTrigger to open the dropdown
    cy.get(this.selectors.filterStatus).click()
    // Wait for dropdown content to be visible
    cy.get('[data-radix-select-viewport]').should('be.visible')
    // Click the option by visible text using contains() with selector
    cy.contains('[role="option"]', statusLabels[status] || status).click()
    return this
  }

  /**
   * Filter by action type using shadcn/ui Select (Radix UI)
   *
   * @param actionType - e.g., 'all', 'webhook:send', 'billing:check-renewals'
   */
  filterByType(actionType: string) {
    // Map 'all' to display label
    const displayText = actionType === 'all' ? 'All' : actionType

    // Click the SelectTrigger to open the dropdown
    cy.get(this.selectors.filterType).click()
    // Wait for dropdown content to be visible
    cy.get('[data-radix-select-viewport]').should('be.visible')
    // Click the option by visible text using contains() with selector
    cy.contains('[role="option"]', displayText).click()
    return this
  }

  /**
   * Click reset filters button
   */
  resetFilters() {
    cy.get(this.selectors.filterReset).click()
    return this
  }

  // ============================================
  // TABLE INTERACTIONS
  // ============================================

  /**
   * Click on a specific row (for expandable rows)
   * @param id - Action ID
   */
  clickRow(id: string) {
    cy.get(this.selectors.row(id)).click()
    return this
  }

  /**
   * Get all visible rows
   */
  getRows() {
    return cy.get(`[data-cy^="scheduled-actions-row-"]`)
  }

  // ============================================
  // PAGINATION
  // ============================================

  /**
   * Click next page button
   */
  clickNextPage() {
    cy.get(this.selectors.paginationNext).click()
    return this
  }

  /**
   * Click previous page button
   */
  clickPrevPage() {
    cy.get(this.selectors.paginationPrev).click()
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  /**
   * Wait for page to load
   */
  waitForPage() {
    cy.get(this.selectors.page, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Wait for table to load
   */
  waitForTable() {
    cy.get(this.selectors.table, { timeout: 10000 }).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTIONS - URL
  // ============================================

  /**
   * Assert user is on /devtools/scheduled-actions
   */
  assertOnScheduledActionsPage() {
    cy.url().should('include', '/devtools/scheduled-actions')
    return this
  }

  /**
   * Assert user was redirected to /dashboard (blocked access)
   */
  assertRedirectedToDashboard() {
    cy.url().should('include', '/dashboard')
    cy.url().should('not.include', '/devtools')
    return this
  }

  // ============================================
  // ASSERTIONS - PAGE ELEMENTS
  // ============================================

  /**
   * Assert page container is visible
   */
  assertPageVisible() {
    cy.get(this.selectors.page).should('be.visible')
    return this
  }

  /**
   * Assert table is visible
   */
  assertTableVisible() {
    cy.get(this.selectors.table).should('be.visible')
    return this
  }

  /**
   * Assert empty state is visible
   */
  assertEmptyStateVisible() {
    cy.get(this.selectors.emptyState).should('be.visible')
    return this
  }

  /**
   * Assert empty state is NOT visible (has data)
   */
  assertEmptyStateNotVisible() {
    cy.get(this.selectors.emptyState).should('not.exist')
    return this
  }

  // ============================================
  // ASSERTIONS - FILTERS
  // ============================================

  /**
   * Assert filter controls are visible
   */
  assertFiltersVisible() {
    cy.get(this.selectors.filterStatus).should('be.visible')
    cy.get(this.selectors.filterType).should('be.visible')
    return this
  }

  /**
   * Assert reset button is visible
   */
  assertResetButtonVisible() {
    cy.get(this.selectors.filterReset).should('be.visible')
    return this
  }

  /**
   * Assert reset button is NOT visible (no active filters)
   */
  assertResetButtonNotVisible() {
    cy.get(this.selectors.filterReset).should('not.exist')
    return this
  }

  // ============================================
  // ASSERTIONS - TABLE CONTENT
  // ============================================

  /**
   * Assert table has at least one row
   */
  assertTableHasRows() {
    this.getRows().should('have.length.greaterThan', 0)
    return this
  }

  /**
   * Assert table has no rows
   */
  assertTableEmpty() {
    this.getRows().should('have.length', 0)
    return this
  }

  /**
   * Assert specific row exists
   * @param id - Action ID
   */
  assertRowExists(id: string) {
    cy.get(this.selectors.row(id)).should('exist')
    return this
  }

  /**
   * Assert row does not exist
   * @param id - Action ID
   */
  assertRowNotExists(id: string) {
    cy.get(this.selectors.row(id)).should('not.exist')
    return this
  }

  // ============================================
  // ASSERTIONS - STATUS BADGES
  // ============================================

  /**
   * Assert status badge for a specific status exists
   * @param status - 'pending' | 'running' | 'completed' | 'failed'
   */
  assertStatusBadgeExists(status: 'pending' | 'running' | 'completed' | 'failed') {
    const selector = this.selectors[`status${status.charAt(0).toUpperCase() + status.slice(1)}` as keyof typeof this.selectors] as string
    cy.get(selector).should('exist')
    return this
  }

  /**
   * Assert at least one pending action is visible
   */
  assertPendingActionsVisible() {
    cy.get(this.selectors.statusPending).should('be.visible')
    return this
  }

  /**
   * Assert at least one running action is visible
   */
  assertRunningActionsVisible() {
    cy.get(this.selectors.statusRunning).should('be.visible')
    return this
  }

  /**
   * Assert at least one completed action is visible
   */
  assertCompletedActionsVisible() {
    cy.get(this.selectors.statusCompleted).should('be.visible')
    return this
  }

  /**
   * Assert at least one failed action is visible
   */
  assertFailedActionsVisible() {
    cy.get(this.selectors.statusFailed).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTIONS - COLUMN HEADERS
  // ============================================

  /**
   * Assert all table column headers are visible
   */
  assertColumnHeadersVisible() {
    cy.get(this.selectors.cellType).should('be.visible')
    cy.get(this.selectors.cellStatus).should('be.visible')
    cy.get(this.selectors.cellScheduledAt).should('be.visible')
    cy.get(this.selectors.cellTeam).should('be.visible')
    cy.get(this.selectors.cellPayload).should('be.visible')
    cy.get(this.selectors.cellError).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTIONS - ERROR DISPLAY
  // ============================================

  /**
   * Assert error column header is visible
   */
  assertErrorColumnVisible() {
    cy.get(this.selectors.cellError).should('be.visible')
    return this
  }

  /**
   * Assert at least one error message is visible in the table
   */
  assertErrorMessagesVisible() {
    cy.get(this.selectors.cellError).parent().parent().should('contain.text', 'Error')
    return this
  }

  // ============================================
  // ASSERTIONS - PAGINATION
  // ============================================

  /**
   * Assert pagination controls are visible
   */
  assertPaginationVisible() {
    cy.get(this.selectors.pagination).should('be.visible')
    return this
  }

  /**
   * Assert next button is enabled
   */
  assertNextButtonEnabled() {
    cy.get(this.selectors.paginationNext).should('not.be.disabled')
    return this
  }

  /**
   * Assert next button is disabled
   */
  assertNextButtonDisabled() {
    cy.get(this.selectors.paginationNext).should('be.disabled')
    return this
  }

  /**
   * Assert previous button is enabled
   */
  assertPrevButtonEnabled() {
    cy.get(this.selectors.paginationPrev).should('not.be.disabled')
    return this
  }

  /**
   * Assert previous button is disabled
   */
  assertPrevButtonDisabled() {
    cy.get(this.selectors.paginationPrev).should('be.disabled')
    return this
  }
}

export default ScheduledActionsPOM
