/**
 * Kanban Board Page Object Model - Entity Testing Convention
 *
 * POM for the Kanban board view with columns (lists) and cards.
 * Follows the pattern: {slug}-{component}-{detail}
 *
 * Convention:
 *   - lists-{component}-{detail} for columns
 *   - cards-{component}-{detail} for cards
 *
 * Examples:
 *   - kanban-board (board container)
 *   - lists-column-{id} (column)
 *   - lists-add-column (add column button)
 *   - cards-item-{id} (card)
 *
 * @see test/cypress/fixtures/themes/productivity/entities.json
 */

import entitiesConfig from '../../fixtures/entities.json'

// Get lists and cards entity configs
const listsEntity = entitiesConfig.entities.lists
const cardsEntity = entitiesConfig.entities.cards

/**
 * Kanban Board Page Object Model
 *
 * Handles interactions with the Kanban board, columns (lists), and cards.
 */
export class KanbanPOM {
  // ============================================
  // ENTITY METADATA
  // ============================================

  static get listsConfig() {
    return listsEntity
  }

  static get cardsConfig() {
    return cardsEntity
  }

  // ============================================
  // SELECTORS
  // ============================================

  static get selectors() {
    return {
      // Board Container
      board: '[data-cy="kanban-board"]',

      // Column (List) Selectors
      addColumn: '[data-cy="lists-add-column"]',
      addColumnForm: '[data-cy="lists-add-form"]',
      columnFieldName: '[data-cy="lists-field-name"]',
      columnFormSubmit: '[data-cy="lists-form-submit"]',

      // Dynamic column selectors
      column: (id: string) => `[data-cy="lists-column-${id}"]`,
      columnHeader: (id: string) => `[data-cy="lists-column-header-${id}"]`,
      columnTitle: (id: string) => `[data-cy="lists-column-title-${id}"]`,
      columnMenuTrigger: (id: string) => `[data-cy="lists-column-menu-trigger-${id}"]`,
      columnMenu: (id: string) => `[data-cy="lists-column-menu-${id}"]`,

      // Column card actions
      addCard: (listId: string) => `[data-cy="lists-add-card-${listId}"]`,
      addCardForm: (listId: string) => `[data-cy="cards-add-form-${listId}"]`,
      cardFieldTitle: (listId: string) => `[data-cy="cards-field-title-${listId}"]`,
      cardFormSubmit: (listId: string) => `[data-cy="cards-form-submit-${listId}"]`,

      // Card Selectors
      card: (id: string) => `[data-cy="cards-item-${id}"]`,
      allCards: '[data-cy^="cards-item-"]',

      // Generic column selector
      allColumns: '[data-cy^="lists-column-"]',
    }
  }

  // ============================================
  // BOARD NAVIGATION
  // ============================================

  /**
   * Visit a specific board by ID
   */
  static visitBoard(boardId: string) {
    cy.visit(`/dashboard/boards/${boardId}`)
    return this
  }

  /**
   * Wait for board to load
   */
  static waitForBoardLoad() {
    cy.get(this.selectors.board, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Validate board is visible
   */
  static validateBoardVisible() {
    cy.get(this.selectors.board).should('be.visible')
    return this
  }

  // ============================================
  // COLUMN (LIST) ACTIONS
  // ============================================

  /**
   * Click add column button
   */
  static clickAddColumn() {
    cy.get(this.selectors.addColumn).click()
    return this
  }

  /**
   * Fill column name in add form
   */
  static fillColumnName(name: string) {
    cy.get(this.selectors.columnFieldName).clear().type(name)
    return this
  }

  /**
   * Submit add column form
   */
  static submitAddColumn() {
    cy.get(this.selectors.columnFormSubmit).click()
    return this
  }

  /**
   * Create a new column with given name
   */
  static createColumn(name: string) {
    this.clickAddColumn()
    this.fillColumnName(name)
    this.submitAddColumn()
    return this
  }

  /**
   * Get column by ID
   */
  static getColumn(id: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.column(id))
  }

  /**
   * Get column header
   */
  static getColumnHeader(id: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.columnHeader(id))
  }

  /**
   * Click on column title to rename
   */
  static clickColumnTitle(id: string) {
    cy.get(this.selectors.columnTitle(id)).click()
    return this
  }

  /**
   * Open column menu
   */
  static openColumnMenu(id: string) {
    cy.get(this.selectors.columnMenuTrigger(id)).click()
    return this
  }

  /**
   * Click rename in column menu
   */
  static clickColumnRename(id: string) {
    this.openColumnMenu(id)
    cy.get('[role="menuitem"]').contains('Rename').click()
    return this
  }

  /**
   * Click delete in column menu
   */
  static clickColumnDelete(id: string) {
    this.openColumnMenu(id)
    cy.get('[role="menuitem"]').contains('Delete').click()
    return this
  }

  /**
   * Get all columns
   */
  static getAllColumns(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.allColumns)
  }

  /**
   * Get column count
   */
  static getColumnCount(): Cypress.Chainable<number> {
    return cy.get(this.selectors.allColumns).its('length')
  }

  // ============================================
  // CARD ACTIONS
  // ============================================

  /**
   * Click add card button in a column
   */
  static clickAddCard(listId: string) {
    cy.get(this.selectors.addCard(listId)).click()
    return this
  }

  /**
   * Fill card title in add form
   */
  static fillCardTitle(listId: string, title: string) {
    cy.get(this.selectors.cardFieldTitle(listId)).clear().type(title)
    return this
  }

  /**
   * Submit add card form
   */
  static submitAddCard(listId: string) {
    cy.get(this.selectors.cardFormSubmit(listId)).click()
    return this
  }

  /**
   * Create a new card in a column
   */
  static createCard(listId: string, title: string) {
    this.clickAddCard(listId)
    this.fillCardTitle(listId, title)
    this.submitAddCard(listId)
    return this
  }

  /**
   * Get card by ID
   */
  static getCard(id: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.card(id))
  }

  /**
   * Click on a card to open modal
   */
  static clickCard(id: string) {
    cy.get(this.selectors.card(id)).click()
    return this
  }

  /**
   * Get all cards
   */
  static getAllCards(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.allCards)
  }

  /**
   * Get card count
   */
  static getCardCount(): Cypress.Chainable<number> {
    return cy.get(this.selectors.allCards).its('length')
  }

  /**
   * Get cards in a specific column
   */
  static getCardsInColumn(listId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.column(listId)).find('[data-cy^="cards-item-"]')
  }

  /**
   * Get card count in a specific column
   */
  static getCardCountInColumn(listId: string): Cypress.Chainable<number> {
    return this.getCardsInColumn(listId).its('length')
  }

  // ============================================
  // DRAG & DROP (Basic support)
  // ============================================

  /**
   * Drag a card to a different column
   * Note: This is a basic implementation. For complex drag-drop, use specialized plugins.
   */
  static dragCardToColumn(cardId: string, targetColumnId: string) {
    const card = this.selectors.card(cardId)
    const targetColumn = this.selectors.column(targetColumnId)

    cy.get(card).then(($card) => {
      cy.get(targetColumn).then(($column) => {
        const cardRect = $card[0].getBoundingClientRect()
        const columnRect = $column[0].getBoundingClientRect()

        // Use native drag events
        cy.get(card)
          .trigger('mousedown', { which: 1, force: true })
          .trigger('mousemove', {
            clientX: columnRect.left + columnRect.width / 2,
            clientY: columnRect.top + 100,
            force: true,
          })
          .trigger('mouseup', { force: true })
      })
    })

    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert column exists
   */
  static assertColumnExists(id: string) {
    cy.get(this.selectors.column(id)).should('exist')
    return this
  }

  /**
   * Assert column does not exist
   */
  static assertColumnNotExists(id: string) {
    cy.get(this.selectors.column(id)).should('not.exist')
    return this
  }

  /**
   * Assert column has title
   */
  static assertColumnTitle(id: string, title: string) {
    cy.get(this.selectors.columnTitle(id)).should('contain.text', title)
    return this
  }

  /**
   * Assert card exists
   */
  static assertCardExists(id: string) {
    cy.get(this.selectors.card(id)).should('exist')
    return this
  }

  /**
   * Assert card does not exist
   */
  static assertCardNotExists(id: string) {
    cy.get(this.selectors.card(id)).should('not.exist')
    return this
  }

  /**
   * Assert card is in column
   */
  static assertCardInColumn(cardId: string, columnId: string) {
    cy.get(this.selectors.column(columnId)).find(this.selectors.card(cardId)).should('exist')
    return this
  }

  /**
   * Assert column count
   */
  static assertColumnCount(count: number) {
    cy.get(this.selectors.allColumns).should('have.length', count)
    return this
  }

  /**
   * Assert card count in column
   */
  static assertCardCountInColumn(columnId: string, count: number) {
    this.getCardsInColumn(columnId).should('have.length', count)
    return this
  }

  /**
   * Assert board contains text
   */
  static assertBoardContains(text: string) {
    cy.get(this.selectors.board).should('contain.text', text)
    return this
  }
}

export default KanbanPOM
