/**
 * CRMDataTable - Page Object Model Class
 *
 * POM for the CRM theme data table component.
 * Handles data table interactions for entity lists (leads, contacts, companies, etc).
 *
 * Supports both entity-specific selectors (via constructor) and generic selectors.
 * When entitySlug is provided, uses `{entitySlug}-*` selectors.
 * Otherwise, uses generic `crm-datatable-*` selectors.
 */
export class CRMDataTable {
  // Generic fallback selectors (when no entitySlug provided)
  static selectors = {
    container: '[data-cy="crm-datatable-list"]',
    search: '[data-cy="crm-datatable-search"]',
    table: '[data-cy="crm-datatable-table"]',
    tableRow: '[data-cy^="crm-datatable-row-"]',
    emptyState: '[data-cy="crm-datatable-empty"]',
    pagination: '[data-cy="crm-datatable-pagination"]',
  }

  /**
   * Get entity-specific selectors
   * @param {string} entitySlug - The entity slug (e.g., 'leads', 'contacts')
   */
  static getEntitySelectors(entitySlug) {
    return {
      container: `[data-cy="${entitySlug}-list"]`,
      addButton: `[data-cy="${entitySlug}-add"]`,
      search: `[data-cy="${entitySlug}-search"]`,
      table: `[data-cy="${entitySlug}-table"]`,
      tableRow: `[data-cy^="${entitySlug}-row-"]`,
      emptyState: `[data-cy="${entitySlug}-empty"]`,
      pagination: `[data-cy="${entitySlug}-pagination"]`,
    }
  }

  /**
   * @param {string} [entitySlug] - Optional entity slug for entity-specific selectors
   */
  constructor(entitySlug = null) {
    this.entitySlug = entitySlug
    this.selectors = entitySlug
      ? CRMDataTable.getEntitySelectors(entitySlug)
      : CRMDataTable.selectors
  }

  /**
   * Validate data table container is visible
   */
  validateVisible() {
    cy.get(this.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate table is visible
   */
  validateTableVisible() {
    cy.get(this.selectors.table).should('be.visible')
    return this
  }

  /**
   * Click the add button to create a new entity
   */
  clickAdd() {
    if (!this.entitySlug) {
      throw new Error('clickAdd() requires entitySlug to be set in constructor')
    }
    cy.get(this.selectors.addButton).click()
    return this
  }

  /**
   * Validate add button is visible
   */
  validateAddButtonVisible() {
    if (!this.entitySlug) {
      throw new Error('validateAddButtonVisible() requires entitySlug to be set in constructor')
    }
    cy.get(this.selectors.addButton).should('be.visible')
    return this
  }

  /**
   * Validate add button is not visible (e.g., for restricted roles)
   */
  validateAddButtonNotVisible() {
    if (!this.entitySlug) {
      throw new Error('validateAddButtonNotVisible() requires entitySlug to be set in constructor')
    }
    cy.get(this.selectors.addButton).should('not.exist')
    return this
  }

  /**
   * Search for a term
   * @param {string} term - Search term
   */
  search(term) {
    cy.get(this.selectors.search).clear().type(term)
    // Wait for debounce
    cy.wait(300)
    return this
  }

  /**
   * Clear search input
   */
  clearSearch() {
    cy.get(this.selectors.search).clear()
    return this
  }

  /**
   * Validate search input has value
   * @param {string} value - Expected value
   */
  validateSearchValue(value) {
    cy.get(this.selectors.search).should('have.value', value)
    return this
  }

  /**
   * Get a specific row by ID
   * @param {string} id - Row ID
   */
  getRow(id) {
    const prefix = this.entitySlug || 'crm-datatable'
    return cy.get(`[data-cy="${prefix}-row-${id}"]`)
  }

  /**
   * Click a specific row
   * @param {string} id - Row ID
   */
  clickRow(id) {
    this.getRow(id).click()
    return this
  }

  /**
   * Validate row exists
   * @param {string} id - Row ID
   */
  validateRowExists(id) {
    this.getRow(id).should('exist')
    return this
  }

  /**
   * Validate row does not exist
   * @param {string} id - Row ID
   */
  validateRowNotExists(id) {
    const prefix = this.entitySlug || 'crm-datatable'
    cy.get(`[data-cy="${prefix}-row-${id}"]`).should('not.exist')
    return this
  }

  /**
   * Validate number of visible rows
   * @param {number} count - Expected row count
   */
  validateRowCount(count) {
    if (count === 0) {
      this.validateEmpty()
    } else {
      cy.get(this.selectors.tableRow).should('have.length', count)
    }
    return this
  }

  /**
   * Get all visible rows
   */
  getRows() {
    return cy.get(this.selectors.tableRow)
  }

  /**
   * Validate empty state is visible
   */
  validateEmpty() {
    cy.get(this.selectors.emptyState).should('be.visible')
    return this
  }

  /**
   * Validate empty state contains message
   * @param {string} message - Expected message
   */
  validateEmptyMessage(message) {
    cy.get(this.selectors.emptyState).should('contain', message)
    return this
  }

  /**
   * Validate table is not empty
   */
  validateNotEmpty() {
    cy.get(this.selectors.emptyState).should('not.exist')
    cy.get(this.selectors.tableRow).should('have.length.greaterThan', 0)
    return this
  }

  /**
   * Validate pagination is visible
   */
  validatePaginationVisible() {
    cy.get(this.selectors.pagination).should('be.visible')
    return this
  }

  /**
   * Validate pagination is not visible
   */
  validatePaginationNotVisible() {
    cy.get(this.selectors.pagination).should('not.exist')
    return this
  }
}
