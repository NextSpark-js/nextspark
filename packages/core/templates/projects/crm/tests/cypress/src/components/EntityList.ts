/**
 * Generic Entity List POM for CRM Theme
 *
 * Page Object Model for entity list pages in CRM theme.
 * Uses standardized data-cy selectors from entities.json.
 *
 * Convention: {slug}-{component}-{detail}
 * Examples: leads-table, contacts-create-btn, opportunities-row-{id}
 *
 * Usage:
 *   const leadsList = EntityList.for('leads')
 *   const contactsList = EntityList.for('contacts')
 */

// Import entity configs from CRM theme
import entitiesConfig from '../../fixtures/entities.json'

export interface EntityConfig {
  slug: string
  singular: string
  plural: string
  tableName: string
  fields: string[]
  sections: string[]
  filters: string[]
}

export class EntityList {
  private config: EntityConfig
  private slug: string

  /**
   * Create a new EntityList POM instance from entity config
   */
  constructor(entityKey: string) {
    const config = entitiesConfig.entities[entityKey as keyof typeof entitiesConfig.entities]
    if (!config) {
      throw new Error(`Unknown entity: ${entityKey}. Available: ${Object.keys(entitiesConfig.entities).join(', ')}`)
    }
    this.config = config as EntityConfig
    this.slug = config.slug
  }

  // ============================================
  // STATIC FACTORY METHOD
  // ============================================

  /**
   * Create an EntityList from entity key
   */
  static for(entityKey: string): EntityList {
    return new EntityList(entityKey)
  }

  // ============================================
  // DYNAMIC SELECTORS (from entities.json convention)
  // ============================================

  /**
   * Get selectors for this entity following the standard convention
   */
  get selectors() {
    const slug = this.slug
    return {
      // Page elements
      page: `[data-cy="${slug}-page"]`,
      pageTitle: '[data-cy="page-title"]',

      // Table
      table: `[data-cy="${slug}-table"]`,

      // Create button
      createButton: `[data-cy="${slug}-create-btn"]`,

      // Search
      search: `[data-cy="${slug}-search"]`,
      searchInput: `[data-cy="${slug}-search-input"]`,

      // Filters
      filter: (fieldName: string) => `[data-cy="${slug}-filter-${fieldName}"]`,
      filterTrigger: (fieldName: string) => `[data-cy="${slug}-filter-${fieldName}-trigger"]`,
      filterOption: (fieldName: string, value: string) => `[data-cy="${slug}-filter-${fieldName}-option-${value}"]`,

      // Rows
      row: (id: string) => `[data-cy="${slug}-row-${id}"]`,
      rowGeneric: `[data-cy^="${slug}-row-"]`,

      // Cards (for kanban/grid views)
      card: (id: string) => `[data-cy="${slug}-card-${id}"]`,
      cardGeneric: `[data-cy^="${slug}-card-"]`,

      // Actions
      actionEdit: (id: string) => `[data-cy="${slug}-action-edit-${id}"]`,
      actionDelete: (id: string) => `[data-cy="${slug}-action-delete-${id}"]`,
      actionView: (id: string) => `[data-cy="${slug}-action-view-${id}"]`,
      actionsDropdown: (id: string) => `[data-cy="${slug}-actions-${id}"]`,
      actionsTrigger: (id: string) => `[data-cy="${slug}-actions-trigger-${id}"]`,

      // Pagination
      pagination: `[data-cy="${slug}-pagination"]`,
      paginationPrev: `[data-cy="${slug}-pagination-prev"]`,
      paginationNext: `[data-cy="${slug}-pagination-next"]`,

      // Bulk actions
      bulkActions: `[data-cy="${slug}-bulk-actions"]`,

      // Empty state
      emptyState: `[data-cy="${slug}-empty"]`,

      // Dialogs
      confirmDelete: `[data-cy="${slug}-confirm-delete"]`,
      confirmDeleteBtn: `[data-cy="${slug}-confirm-delete-btn"]`,
      cancelDeleteBtn: `[data-cy="${slug}-cancel-delete-btn"]`,
    }
  }

  /**
   * Get the entity config
   */
  get entityConfig(): EntityConfig {
    return this.config
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate the list page is visible
   */
  validatePageVisible() {
    cy.get(this.selectors.page).should('be.visible')
    return this
  }

  /**
   * Validate the table is visible
   */
  validateTableVisible() {
    cy.get(this.selectors.table).should('be.visible')
    return this
  }

  /**
   * Validate the page title text
   */
  validatePageTitle(expectedTitle: string) {
    cy.get(this.selectors.pageTitle).should('contain.text', expectedTitle)
    return this
  }

  /**
   * Validate the create button is visible
   */
  validateCreateButtonVisible() {
    cy.get(this.selectors.createButton).should('be.visible')
    return this
  }

  /**
   * Validate the table has rows
   */
  validateTableHasRows() {
    cy.get(this.selectors.table).find('tbody tr').should('have.length.at.least', 1)
    return this
  }

  /**
   * Validate the table is empty
   */
  validateTableEmpty() {
    cy.get(this.selectors.table).find('tbody tr').should('have.length', 0)
    return this
  }

  // ============================================
  // INTERACTION METHODS
  // ============================================

  /**
   * Click the create button
   */
  clickCreate() {
    cy.get(this.selectors.createButton).click()
    return this
  }

  /**
   * Search for a term
   */
  search(term: string) {
    cy.get(this.selectors.searchInput).clear().type(term)
    return this
  }

  /**
   * Clear the search input
   */
  clearSearch() {
    cy.get(this.selectors.searchInput).clear()
    return this
  }

  /**
   * Select a filter option
   */
  selectFilter(fieldName: string, value: string) {
    cy.get(this.selectors.filterTrigger(fieldName)).click()
    cy.get(this.selectors.filterOption(fieldName, value)).click()
    return this
  }

  /**
   * Click on a table row by index (0-based)
   */
  clickRowByIndex(index: number) {
    cy.get(this.selectors.table).find('tbody tr').eq(index).click()
    return this
  }

  /**
   * Click on a table row by text content
   */
  clickRowByText(text: string) {
    cy.get(this.selectors.table).find('tbody tr').contains(text).click()
    return this
  }

  /**
   * Click on a specific row by ID
   */
  clickRowById(id: string) {
    cy.get(this.selectors.row(id)).click()
    return this
  }

  /**
   * Click edit action for a row
   */
  clickEditAction(id: string) {
    cy.get(this.selectors.actionEdit(id)).click()
    return this
  }

  /**
   * Click delete action for a row
   */
  clickDeleteAction(id: string) {
    cy.get(this.selectors.actionDelete(id)).click()
    return this
  }

  /**
   * Open actions dropdown for a row
   */
  openActionsDropdown(id: string) {
    cy.get(this.selectors.actionsTrigger(id)).click()
    return this
  }

  // ============================================
  // PAGINATION METHODS
  // ============================================

  /**
   * Go to next page
   */
  nextPage() {
    cy.get(this.selectors.paginationNext).click()
    return this
  }

  /**
   * Go to previous page
   */
  previousPage() {
    cy.get(this.selectors.paginationPrev).click()
    return this
  }

  // ============================================
  // BULK ACTIONS METHODS
  // ============================================

  /**
   * Select all rows using the header checkbox
   */
  selectAll() {
    cy.get(this.selectors.table).find('thead input[type="checkbox"]').check()
    return this
  }

  /**
   * Deselect all rows
   */
  deselectAll() {
    cy.get(this.selectors.table).find('thead input[type="checkbox"]').uncheck()
    return this
  }

  /**
   * Select a row by index
   */
  selectRowByIndex(index: number) {
    cy.get(this.selectors.table).find('tbody tr').eq(index).find('input[type="checkbox"]').check()
    return this
  }

  /**
   * Validate bulk actions panel is visible
   */
  validateBulkActionsVisible() {
    cy.get(this.selectors.bulkActions).should('be.visible')
    return this
  }

  // ============================================
  // DELETE CONFIRMATION
  // ============================================

  /**
   * Confirm deletion in dialog
   */
  confirmDelete() {
    cy.get(this.selectors.confirmDeleteBtn).click()
    return this
  }

  /**
   * Cancel deletion in dialog
   */
  cancelDelete() {
    cy.get(this.selectors.cancelDeleteBtn).click()
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  /**
   * Wait for the table to load
   */
  waitForTableLoad() {
    cy.get(this.selectors.table).should('exist')
    cy.get(this.selectors.page).find('[data-loading]').should('not.exist')
    return this
  }

  /**
   * Wait for page load
   */
  waitForPageLoad() {
    cy.url().should('include', `/dashboard/${this.slug}`)
    cy.get(this.selectors.page).should('be.visible')
    return this
  }
}

export default EntityList
