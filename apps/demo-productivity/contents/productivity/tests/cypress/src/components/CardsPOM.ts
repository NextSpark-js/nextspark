/**
 * Cards Modal Page Object Model - Entity Testing Convention
 *
 * POM for the card detail modal in the productivity theme.
 * Follows the pattern: {slug}-{component}-{detail}
 *
 * Convention: cards-modal-{detail}
 * Examples:
 *   - cards-modal (modal container)
 *   - cards-modal-title (title input)
 *   - cards-modal-description (description textarea)
 *   - cards-modal-priority (priority select)
 *   - cards-modal-due-date (due date picker)
 *   - cards-modal-save (save button)
 *   - cards-modal-delete (delete button)
 *
 * @see test/cypress/fixtures/themes/productivity/entities.json
 */

import entitiesConfig from '../../fixtures/entities.json'

// Get cards entity config from JSON
const cardsEntity = entitiesConfig.entities.cards
const slug = cardsEntity.slug

/**
 * Cards Modal Page Object Model
 *
 * Handles interactions with the card detail modal.
 */
export class CardsPOM {
  // ============================================
  // ENTITY METADATA
  // ============================================

  static get entityConfig() {
    return cardsEntity
  }

  static get slug() {
    return slug
  }

  static get fields() {
    return cardsEntity.fields
  }

  // ============================================
  // SELECTORS
  // ============================================

  static get selectors() {
    return {
      // Modal
      modal: '[data-cy="cards-modal"]',

      // Form Fields
      title: '[data-cy="cards-modal-title"]',
      description: '[data-cy="cards-modal-description"]',
      priority: '[data-cy="cards-modal-priority"]',
      dueDate: '[data-cy="cards-modal-due-date"]',

      // Actions
      save: '[data-cy="cards-modal-save"]',
      delete: '[data-cy="cards-modal-delete"]',
      cancel: '[data-cy="cards-modal-cancel"]',

      // Priority options in dropdown
      priorityOption: (value: string) => `[data-value="${value}"]`,
    }
  }

  // ============================================
  // MODAL ACTIONS
  // ============================================

  /**
   * Wait for modal to open
   */
  static waitForModal() {
    cy.get(this.selectors.modal, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Validate modal is visible
   */
  static validateModalVisible() {
    cy.get(this.selectors.modal).should('be.visible')
    return this
  }

  /**
   * Validate modal is not visible
   */
  static validateModalNotVisible() {
    cy.get(this.selectors.modal).should('not.exist')
    return this
  }

  /**
   * Close modal via cancel button
   */
  static closeModal() {
    cy.get(this.selectors.cancel).click()
    return this
  }

  /**
   * Close modal via Escape key
   */
  static closeModalWithEscape() {
    cy.get('body').type('{esc}')
    return this
  }

  // ============================================
  // FORM FIELD ACTIONS
  // ============================================

  /**
   * Get title input
   */
  static getTitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.title)
  }

  /**
   * Fill title field
   */
  static fillTitle(title: string) {
    cy.get(this.selectors.title).clear().type(title)
    return this
  }

  /**
   * Clear title field
   */
  static clearTitle() {
    cy.get(this.selectors.title).clear()
    return this
  }

  /**
   * Get description textarea
   */
  static getDescription(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.description)
  }

  /**
   * Fill description field
   */
  static fillDescription(description: string) {
    cy.get(this.selectors.description).clear().type(description)
    return this
  }

  /**
   * Clear description field
   */
  static clearDescription() {
    cy.get(this.selectors.description).clear()
    return this
  }

  /**
   * Open priority dropdown
   */
  static openPriorityDropdown() {
    cy.get(this.selectors.priority).click()
    return this
  }

  /**
   * Select priority
   */
  static selectPriority(priority: 'none' | 'low' | 'medium' | 'high' | 'urgent') {
    this.openPriorityDropdown()
    cy.get(this.selectors.priorityOption(priority)).click()
    return this
  }

  /**
   * Open due date picker
   */
  static openDueDatePicker() {
    cy.get(this.selectors.dueDate).click()
    return this
  }

  /**
   * Select a date (relative: days from today)
   * Note: This clicks on the date picker and selects a day
   */
  static selectDueDate(daysFromToday: number) {
    this.openDueDatePicker()

    // Calculate target date
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysFromToday)
    const day = targetDate.getDate()

    // Click on the day in the calendar
    cy.get('[role="gridcell"]').contains(new RegExp(`^${day}$`)).click()
    return this
  }

  /**
   * Clear due date
   */
  static clearDueDate() {
    this.openDueDatePicker()
    cy.get('button').contains('Clear date').click()
    return this
  }

  // ============================================
  // ACTION BUTTONS
  // ============================================

  /**
   * Click save button
   */
  static clickSave() {
    cy.get(this.selectors.save).click()
    return this
  }

  /**
   * Click delete button
   */
  static clickDelete() {
    cy.get(this.selectors.delete).click()
    return this
  }

  /**
   * Click cancel button
   */
  static clickCancel() {
    cy.get(this.selectors.cancel).click()
    return this
  }

  /**
   * Save with keyboard shortcut (Cmd+Enter)
   */
  static saveWithKeyboard() {
    cy.get(this.selectors.modal).type('{cmd}{enter}')
    return this
  }

  // ============================================
  // COMPLETE FORM OPERATIONS
  // ============================================

  /**
   * Fill card form with data
   */
  static fillCardForm(data: {
    title?: string
    description?: string
    priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
    dueDateDaysFromToday?: number
  }) {
    if (data.title !== undefined) {
      this.fillTitle(data.title)
    }
    if (data.description !== undefined) {
      this.fillDescription(data.description)
    }
    if (data.priority !== undefined) {
      this.selectPriority(data.priority)
    }
    if (data.dueDateDaysFromToday !== undefined) {
      this.selectDueDate(data.dueDateDaysFromToday)
    }
    return this
  }

  /**
   * Update card and save
   */
  static updateCard(data: {
    title?: string
    description?: string
    priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
    dueDateDaysFromToday?: number
  }) {
    this.fillCardForm(data)
    this.clickSave()
    return this
  }

  /**
   * Delete card with confirmation
   */
  static deleteCard() {
    // Set up confirmation handler before clicking delete
    cy.on('window:confirm', () => true)
    this.clickDelete()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert title has value
   */
  static assertTitle(expectedTitle: string) {
    cy.get(this.selectors.title).should('have.value', expectedTitle)
    return this
  }

  /**
   * Assert description has value
   */
  static assertDescription(expectedDescription: string) {
    cy.get(this.selectors.description).should('have.value', expectedDescription)
    return this
  }

  /**
   * Assert priority is selected
   */
  static assertPriority(expectedPriority: string) {
    cy.get(this.selectors.priority).should('contain.text', expectedPriority)
    return this
  }

  /**
   * Assert save button is enabled
   */
  static assertSaveEnabled() {
    cy.get(this.selectors.save).should('not.be.disabled')
    return this
  }

  /**
   * Assert save button is disabled
   */
  static assertSaveDisabled() {
    cy.get(this.selectors.save).should('be.disabled')
    return this
  }

  /**
   * Assert delete button is visible
   */
  static assertDeleteVisible() {
    cy.get(this.selectors.delete).should('be.visible')
    return this
  }

  /**
   * Assert delete button is not visible
   */
  static assertDeleteNotVisible() {
    cy.get(this.selectors.delete).should('not.exist')
    return this
  }

  /**
   * Assert unsaved changes indicator is visible
   */
  static assertUnsavedChanges() {
    cy.get(this.selectors.modal).should('contain.text', 'Unsaved changes')
    return this
  }

  /**
   * Assert modal contains text
   */
  static assertModalContains(text: string) {
    cy.get(this.selectors.modal).should('contain.text', text)
    return this
  }
}

export default CardsPOM
