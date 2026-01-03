/**
 * Boards Page Object Model - Entity Testing Convention
 *
 * POM for managing boards in the productivity theme.
 * Follows the pattern: {slug}-{component}-{detail}
 *
 * Convention: boards-{component}-{detail}
 * Examples:
 *   - boards-page (list page container)
 *   - boards-create-btn (create button)
 *   - boards-card-{id} (board card)
 *   - boards-form (form container)
 *   - boards-field-name (name input)
 *
 * @see test/cypress/fixtures/themes/productivity/entities.json
 */

import entitiesConfig from '../../fixtures/entities.json'

// Get boards entity config from JSON
const boardsEntity = entitiesConfig.entities.boards
const slug = boardsEntity.slug

/**
 * Boards Page Object Model
 *
 * Uses the entity testing convention for consistent, maintainable selectors.
 */
export class BoardsPOM {
  // ============================================
  // ENTITY METADATA (from entities.json)
  // ============================================

  static get entityConfig() {
    return boardsEntity
  }

  static get slug() {
    return slug
  }

  static get fields() {
    return boardsEntity.fields
  }

  // ============================================
  // SELECTORS
  // ============================================

  static get selectors() {
    return {
      // List Page
      page: `[data-cy="${slug}-page"]`,
      createBtn: `[data-cy="${slug}-create-btn"]`,
      createCard: `[data-cy="${slug}-create-card"]`,

      // Board Cards (dynamic)
      card: (id: string) => `[data-cy="${slug}-card-${id}"]`,
      cardMenu: (id: string) => `[data-cy="${slug}-card-menu-${id}"]`,
      cardEdit: (id: string) => `[data-cy="${slug}-card-edit-${id}"]`,
      cardArchive: (id: string) => `[data-cy="${slug}-card-archive-${id}"]`,
      cardDelete: (id: string) => `[data-cy="${slug}-card-delete-${id}"]`,

      // Create Page
      createPage: `[data-cy="${slug}-create-page"]`,

      // Edit Page
      editPage: `[data-cy="${slug}-edit-page"]`,

      // Form (shared between create/edit)
      form: `[data-cy="${slug}-form"]`,
      fieldName: `[data-cy="${slug}-field-name"]`,
      fieldDescription: `[data-cy="${slug}-field-description"]`,
      fieldColor: `[data-cy="${slug}-field-color"]`,
      fieldArchived: `[data-cy="${slug}-field-archived"]`,
      formSubmit: `[data-cy="${slug}-form-submit"]`,
      formCancel: `[data-cy="${slug}-form-cancel"]`,
      formDelete: `[data-cy="${slug}-form-delete"]`,
    }
  }

  // ============================================
  // LIST PAGE ACTIONS
  // ============================================

  /**
   * Visit the boards list page
   */
  static visitList() {
    cy.visit('/dashboard/boards')
    return this
  }

  /**
   * Wait for list page to load
   */
  static waitForListLoad() {
    cy.url().should('include', '/dashboard/boards')
    cy.get(this.selectors.page, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Validate list page is visible
   */
  static validateListPageVisible() {
    cy.get(this.selectors.page).should('be.visible')
    return this
  }

  /**
   * Click create button
   */
  static clickCreate() {
    cy.get(this.selectors.createBtn).click()
    return this
  }

  /**
   * Click on a board card by ID
   */
  static clickCard(id: string) {
    cy.get(this.selectors.card(id)).click()
    return this
  }

  /**
   * Open board card menu
   */
  static openCardMenu(id: string) {
    cy.get(this.selectors.cardMenu(id)).click({ force: true })
    return this
  }

  /**
   * Click edit from card menu
   */
  static clickCardEdit(id: string) {
    this.openCardMenu(id)
    cy.get(this.selectors.cardEdit(id)).click()
    return this
  }

  /**
   * Click archive from card menu
   */
  static clickCardArchive(id: string) {
    this.openCardMenu(id)
    cy.get(this.selectors.cardArchive(id)).click()
    return this
  }

  /**
   * Click delete from card menu
   */
  static clickCardDelete(id: string) {
    this.openCardMenu(id)
    cy.get(this.selectors.cardDelete(id)).click()
    return this
  }

  /**
   * Get board card count
   */
  static getBoardCount(): Cypress.Chainable<number> {
    return cy.get(`[data-cy^="${slug}-card-"]`).its('length')
  }

  // ============================================
  // FORM PAGE ACTIONS
  // ============================================

  /**
   * Visit create form
   */
  static visitCreate() {
    cy.visit('/dashboard/boards/create')
    return this
  }

  /**
   * Visit edit form
   */
  static visitEdit(id: string) {
    cy.visit(`/dashboard/boards/${id}/edit`)
    return this
  }

  /**
   * Wait for form to load
   */
  static waitForFormLoad() {
    cy.get(this.selectors.form, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Validate form is visible
   */
  static validateFormVisible() {
    cy.get(this.selectors.form).should('be.visible')
    return this
  }

  /**
   * Fill the name field
   */
  static fillName(name: string) {
    cy.get(this.selectors.fieldName).clear().type(name)
    return this
  }

  /**
   * Fill the description field
   */
  static fillDescription(description: string) {
    cy.get(this.selectors.fieldDescription).clear().type(description)
    return this
  }

  /**
   * Select a color
   */
  static selectColor(color: string) {
    cy.get(this.selectors.fieldColor).click()
    cy.get(`[data-value="${color}"]`).click()
    return this
  }

  /**
   * Toggle archived status
   */
  static toggleArchived() {
    cy.get(this.selectors.fieldArchived).click()
    return this
  }

  /**
   * Submit the form
   */
  static submitForm() {
    cy.get(this.selectors.formSubmit).click()
    return this
  }

  /**
   * Cancel the form
   */
  static cancelForm() {
    cy.get(this.selectors.formCancel).click()
    return this
  }

  /**
   * Delete from edit page
   */
  static deleteFromEdit() {
    cy.get(this.selectors.formDelete).click()
    return this
  }

  /**
   * Fill board form with data
   */
  static fillBoardForm(data: { name?: string; description?: string; color?: string }) {
    if (data.name) {
      this.fillName(data.name)
    }
    if (data.description) {
      this.fillDescription(data.description)
    }
    if (data.color) {
      this.selectColor(data.color)
    }
    return this
  }

  /**
   * Create a board with given data
   */
  static createBoard(data: { name: string; description?: string; color?: string }) {
    this.visitCreate()
    this.waitForFormLoad()
    this.fillBoardForm(data)
    this.submitForm()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert board exists in list by name
   */
  static assertBoardInList(name: string) {
    cy.contains(name).should('be.visible')
    return this
  }

  /**
   * Assert board does not exist in list
   */
  static assertBoardNotInList(name: string) {
    cy.contains(name).should('not.exist')
    return this
  }

  /**
   * Assert current URL matches boards list
   */
  static assertOnListPage() {
    cy.url().should('include', '/dashboard/boards')
    cy.url().should('not.include', '/create')
    cy.url().should('not.include', '/edit')
    return this
  }

  /**
   * Assert current URL is create page
   */
  static assertOnCreatePage() {
    cy.url().should('include', '/dashboard/boards/create')
    return this
  }

  /**
   * Assert current URL is edit page
   */
  static assertOnEditPage(id: string) {
    cy.url().should('include', `/dashboard/boards/${id}/edit`)
    return this
  }

  /**
   * Assert form field has value
   */
  static assertFieldValue(field: 'name' | 'description', expectedValue: string) {
    const selector = field === 'name' ? this.selectors.fieldName : this.selectors.fieldDescription
    cy.get(selector).should('have.value', expectedValue)
    return this
  }

  /**
   * Confirm deletion dialog
   */
  static confirmDelete() {
    cy.on('window:confirm', () => true)
    return this
  }
}

export default BoardsPOM
