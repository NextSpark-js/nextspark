/**
 * PatternsPOM - Page Object Model for Patterns entity
 *
 * Extends DashboardEntityPOM for standard CRUD operations on patterns.
 * Patterns is a core entity, available in all themes.
 *
 * Includes pattern-specific methods for:
 * - Usage report interactions
 * - Delete dialog with usage checking
 * - Placeholder handling in block editor
 *
 * @example
 * // List operations
 * PatternsPOM.create()
 *   .visitList()
 *   .waitForList()
 *   .search('Hero Section')
 *
 * // View pattern usage
 * PatternsPOM.create()
 *   .visitDetailWithApiWait(patternId)
 *   .assertUsageStatsLoaded()
 *
 * // Delete with usage warning (from list)
 * PatternsPOM.create()
 *   .visitList()
 *   .openDeleteDialogFromList(patternId)
 *   .assertUsageWarningVisible()
 *   .confirmPatternDelete()
 */

import { DashboardEntityPOM } from '../core/DashboardEntityPOM'
import { cySelector } from '../selectors'

// Patterns is a core entity, always uses 'patterns' slug
const PATTERNS_SLUG = 'patterns'

export class PatternsPOM extends DashboardEntityPOM {
  constructor() {
    super(PATTERNS_SLUG)
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): PatternsPOM {
    return new PatternsPOM()
  }

  // ============================================
  // PATTERN-SPECIFIC SELECTORS
  // ============================================

  get patternSelectors() {
    return {
      // Usage Table
      usageTable: {
        container: cySelector('patterns.usageTable.container'),
        loading: cySelector('patterns.usageTable.loading'),
        empty: cySelector('patterns.usageTable.empty'),
        row: (id: string) => cySelector('patterns.usageTable.row', { id }),
        viewLink: (id: string) => cySelector('patterns.usageTable.viewLink', { id }),
      },
      // Usage Stats
      usageStats: {
        container: cySelector('patterns.usageStats.container'),
        loading: cySelector('patterns.usageStats.loading'),
        total: cySelector('patterns.usageStats.total'),
        byType: (entityType: string) => cySelector('patterns.usageStats.byType', { entityType }),
      },
      // Usage Report
      usageReport: {
        container: cySelector('patterns.usageReport.container'),
        error: cySelector('patterns.usageReport.error'),
        filters: cySelector('patterns.usageReport.filters'),
        filterSelect: cySelector('patterns.usageReport.filterSelect'),
        pagination: cySelector('patterns.usageReport.pagination'),
        prevPage: cySelector('patterns.usageReport.prevPage'),
        nextPage: cySelector('patterns.usageReport.nextPage'),
        resultsInfo: cySelector('patterns.usageReport.resultsInfo'),
      },
      // Delete Dialog
      deleteDialog: {
        trigger: cySelector('patterns.deleteDialog.trigger'),
        container: cySelector('patterns.deleteDialog.container'),
        loading: cySelector('patterns.deleteDialog.loading'),
        error: cySelector('patterns.deleteDialog.error'),
        warning: cySelector('patterns.deleteDialog.warning'),
        usageList: cySelector('patterns.deleteDialog.usageList'),
        noUsage: cySelector('patterns.deleteDialog.noUsage'),
        cancel: cySelector('patterns.deleteDialog.cancel'),
        confirm: cySelector('patterns.deleteDialog.confirm'),
      },
      // Deleted Pattern Placeholder
      placeholder: {
        container: cySelector('patterns.placeholder.container'),
        removeBtn: cySelector('patterns.placeholder.removeBtn'),
      },
    }
  }

  // ============================================
  // USAGE REPORT METHODS
  // ============================================

  /**
   * Assert usage stats container is visible and loaded
   */
  assertUsageStatsLoaded(): this {
    cy.get(this.patternSelectors.usageStats.container).should('be.visible')
    cy.get(this.patternSelectors.usageStats.loading).should('not.exist')
    return this
  }

  /**
   * Assert usage table is visible and loaded
   */
  assertUsageTableLoaded(): this {
    cy.get(this.patternSelectors.usageTable.container).should('be.visible')
    cy.get(this.patternSelectors.usageTable.loading).should('not.exist')
    return this
  }

  /**
   * Assert usage report shows empty state
   */
  assertUsageTableEmpty(): this {
    cy.get(this.patternSelectors.usageTable.empty).should('be.visible')
    return this
  }

  /**
   * Assert total usage count
   */
  assertTotalUsageCount(expectedCount: number): this {
    cy.get(this.patternSelectors.usageStats.total)
      .should('contain.text', expectedCount.toString())
    return this
  }

  /**
   * Filter usage by entity type
   */
  filterUsageByType(entityType: string): this {
    cy.get(this.patternSelectors.usageReport.filterSelect).click()
    cy.get(`[data-value="${entityType}"]`).click()
    return this
  }

  /**
   * Navigate to next page of usage results
   */
  goToNextUsagePage(): this {
    cy.get(this.patternSelectors.usageReport.nextPage).click()
    return this
  }

  /**
   * Navigate to previous page of usage results
   */
  goToPrevUsagePage(): this {
    cy.get(this.patternSelectors.usageReport.prevPage).click()
    return this
  }

  /**
   * Click view link for a specific usage row
   */
  clickUsageViewLink(usageId: string): this {
    cy.get(this.patternSelectors.usageTable.viewLink(usageId)).click()
    return this
  }

  // ============================================
  // DELETE DIALOG METHODS
  // ============================================

  /**
   * Open the delete dialog for a pattern from the list dropdown menu
   * @param id - The pattern ID to delete
   */
  openDeleteDialogFromList(id: string): this {
    // Click on the dropdown menu first
    cy.get(this.selectors.rowMenu(id)).click()
    // Then click the delete action
    cy.get(this.selectors.rowAction('delete', id)).click()
    // Wait for dialog to be visible
    cy.get(this.patternSelectors.deleteDialog.container).should('be.visible')
    return this
  }

  /**
   * Open the delete dialog using the standalone trigger (if present)
   * @deprecated Use openDeleteDialogFromList() for list-based deletion
   */
  openDeleteDialog(): this {
    cy.get(this.patternSelectors.deleteDialog.trigger).click()
    cy.get(this.patternSelectors.deleteDialog.container).should('be.visible')
    return this
  }

  /**
   * Wait for usage check to complete in delete dialog
   */
  waitForUsageCheck(): this {
    cy.get(this.patternSelectors.deleteDialog.loading).should('not.exist')
    return this
  }

  /**
   * Assert the delete dialog shows usage warning
   */
  assertUsageWarningVisible(): this {
    cy.get(this.patternSelectors.deleteDialog.warning).should('be.visible')
    return this
  }

  /**
   * Assert the delete dialog shows no usage message
   */
  assertNoUsageVisible(): this {
    cy.get(this.patternSelectors.deleteDialog.noUsage).should('be.visible')
    return this
  }

  /**
   * Assert the delete dialog shows error
   */
  assertDeleteDialogError(): this {
    cy.get(this.patternSelectors.deleteDialog.error).should('be.visible')
    return this
  }

  /**
   * Confirm deletion in the delete dialog
   */
  confirmPatternDelete(): this {
    cy.get(this.patternSelectors.deleteDialog.confirm).click()
    return this
  }

  /**
   * Cancel deletion in the delete dialog
   */
  cancelPatternDelete(): this {
    cy.get(this.patternSelectors.deleteDialog.cancel).click()
    return this
  }

  /**
   * Delete pattern from list with API wait
   * Handles the full flow: open dialog from dropdown, wait for usage check, confirm
   * @param id - The pattern ID to delete
   */
  deletePatternFromListWithApiWait(id: string): this {
    this.openDeleteDialogFromList(id)
    this.waitForUsageCheck()
    this.api.interceptDelete()
    this.confirmPatternDelete()
    this.api.waitForDelete()
    return this
  }

  /**
   * Delete pattern with API wait (using standalone trigger)
   * @deprecated Use deletePatternFromListWithApiWait() for list-based deletion
   */
  deletePatternWithApiWait(): this {
    this.openDeleteDialog()
    this.waitForUsageCheck()
    this.api.interceptDelete()
    this.confirmPatternDelete()
    this.api.waitForDelete()
    return this
  }

  // ============================================
  // PLACEHOLDER METHODS (Block Editor context)
  // ============================================

  /**
   * Assert deleted pattern placeholder is visible
   */
  assertPlaceholderVisible(): this {
    cy.get(this.patternSelectors.placeholder.container).should('be.visible')
    return this
  }

  /**
   * Click remove button on deleted pattern placeholder
   */
  clickPlaceholderRemove(): this {
    cy.get(this.patternSelectors.placeholder.removeBtn).click()
    return this
  }

  // ============================================
  // WORKFLOW METHODS
  // ============================================

  /**
   * Create a new pattern (navigates to create page)
   */
  navigateToCreate(): this {
    this.clickAdd()
    return this
  }

  /**
   * Navigate to edit a pattern
   */
  navigateToEdit(id: string): this {
    this.clickRowAction('edit', id)
    return this
  }

  /**
   * Assert pattern appears in list
   */
  assertPatternInList(title: string): this {
    return this.assertInList(title)
  }

  /**
   * Assert pattern does not appear in list
   */
  assertPatternNotInList(title: string): this {
    return this.assertNotInList(title)
  }
}

export default PatternsPOM
