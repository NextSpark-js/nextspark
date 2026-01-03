/**
 * EntityList - Page Object Model Class
 *
 * Generic POM for entity list pages.
 * Supports dynamic entity slugs for any entity type.
 */
export class EntityList {
  static selectors = {
    container: '[data-cy$="-list"]',
    header: '[data-cy$="-header"]',
    addButton: '[data-cy$="-add"]',
    row: '[data-cy$="-row"]',
    emptyState: '[data-cy$="-empty"]',
    pagination: '[data-cy$="-pagination"]',
    searchInput: '[data-cy$="-search"]',
    table: '[data-cy$="-table"]',
    toast: '[data-cy="toast"]',
    deleteButton: '[data-cy$="-delete"]',
    confirmDelete: '[data-cy="confirm-delete"]',
    cancelDelete: '[data-cy="cancel-delete"]',
  }

  /**
   * Get entity-specific selectors
   * @param {string} entitySlug - The entity slug (e.g., 'tasks', 'users')
   */
  static getEntitySelectors(entitySlug) {
    return {
      container: `[data-cy="${entitySlug}-list"]`,
      header: `[data-cy="${entitySlug}-header"]`,
      addButton: `[data-cy="${entitySlug}-add"]`,
      row: `[data-cy^="${entitySlug}-row-"]`,
      emptyState: `[data-cy="${entitySlug}-empty"]`,
      table: `[data-cy="${entitySlug}-table"]`,
      searchInput: `[data-cy="${entitySlug}-search"]`,
      pagination: `[data-cy="${entitySlug}-pagination"]`,
      deleteButton: `[data-cy="${entitySlug}-delete"]`,
    }
  }

  /**
   * @param {string} entitySlug - The entity slug
   */
  constructor(entitySlug) {
    this.entitySlug = entitySlug
    this.selectors = EntityList.getEntitySelectors(entitySlug)
  }

  /**
   * Validate list is visible and loaded
   */
  validateListVisible() {
    cy.get(this.selectors.container).should('be.visible')
    return this
  }

  /**
   * Click the add button to create a new entity
   */
  clickAdd() {
    cy.get(this.selectors.addButton).click()
    return this
  }

  /**
   * Click the create button (alias for clickAdd)
   */
  clickCreateButton() {
    return this.clickAdd()
  }

  /**
   * Validate create button is visible
   */
  validateCreateButtonVisible() {
    cy.get(this.selectors.addButton).should('be.visible')
    return this
  }

  /**
   * Click on a specific row by ID
   * @param {string} id - The entity ID
   */
  clickRow(id) {
    cy.get(`[data-cy="${this.entitySlug}-row-${id}"]`).click()
    return this
  }

  /**
   * Click on an item by its text content
   * @param {string} text - The text to search for
   */
  clickItemByText(text) {
    cy.contains(this.selectors.row, text).click()
    return this
  }

  /**
   * Validate specific row exists
   * @param {string} id - The entity ID
   */
  validateRowExists(id) {
    cy.get(`[data-cy="${this.entitySlug}-row-${id}"]`).should('exist')
    return this
  }

  /**
   * Validate an item with specific text exists
   * @param {string} text - The text to search for
   */
  validateItemExists(text) {
    cy.contains(this.selectors.row, text).should('exist')
    return this
  }

  /**
   * Validate an item with specific text does not exist
   * @param {string} text - The text to search for
   */
  validateItemNotExists(text) {
    cy.contains(this.selectors.row, text).should('not.exist')
    return this
  }

  /**
   * Validate an item contains specific text
   * @param {string} itemText - The item identifier text
   * @param {string} containsText - The text that should be contained
   */
  validateItemContainsText(itemText, containsText) {
    cy.contains(this.selectors.row, itemText).should('contain.text', containsText)
    return this
  }

  /**
   * Validate row count
   * @param {number} count - Expected number of rows
   */
  validateRowCount(count) {
    cy.get(this.selectors.row).should('have.length', count)
    return this
  }

  /**
   * Validate minimum number of items
   * @param {number} count - Minimum expected number of items
   */
  validateMinimumItems(count) {
    cy.get(this.selectors.row).should('have.length.at.least', count)
    return this
  }

  /**
   * Validate empty state is shown
   */
  validateEmptyState() {
    cy.get(this.selectors.emptyState).should('be.visible')
    return this
  }

  /**
   * Search for entities
   * @param {string} term - Search term
   */
  search(term) {
    cy.get(this.selectors.searchInput).clear().type(term)
    return this
  }

  /**
   * Clear search
   */
  clearSearch() {
    cy.get(this.selectors.searchInput).clear()
    return this
  }

  /**
   * Get row element
   * @param {string} id - The entity ID
   */
  getRow(id) {
    return cy.get(`[data-cy="${this.entitySlug}-row-${id}"]`)
  }

  /**
   * Validate list header is visible
   */
  validateHeaderVisible() {
    cy.get(this.selectors.header).should('be.visible')
    return this
  }

  /**
   * Validate toast success message
   * @param {string} message - Expected success message
   */
  validateToastSuccess(message) {
    cy.get('[data-cy="toast"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Delete an item by its text content
   * @param {string} text - The text to identify the item
   */
  deleteItemByText(text) {
    cy.contains(this.selectors.row, text).within(() => {
      cy.get('[data-cy$="-delete"], [data-cy="delete-button"], button[aria-label*="delete" i], button[aria-label*="Delete" i]').click()
    })
    return this
  }

  /**
   * Confirm deletion in modal/dialog
   */
  confirmDeletion() {
    cy.get('[data-cy="confirm-delete"], [data-cy="confirm-dialog-confirm"], button:contains("Delete"):visible, button:contains("Confirm"):visible').first().click()
    return this
  }

  /**
   * Cancel deletion in modal/dialog
   */
  cancelDeletion() {
    cy.get('[data-cy="cancel-delete"], [data-cy="confirm-dialog-cancel"], button:contains("Cancel"):visible').first().click()
    return this
  }

  /**
   * Validate delete button is visible for an item
   * @param {string} text - The text to identify the item
   */
  validateDeleteButtonVisible(text) {
    cy.contains(this.selectors.row, text).within(() => {
      cy.get('[data-cy$="-delete"], [data-cy="delete-button"], button[aria-label*="delete" i], button[aria-label*="Delete" i]').should('be.visible')
    })
    return this
  }
}
