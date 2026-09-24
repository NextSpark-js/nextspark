/**
 * DealCard - Page Object Model Class
 *
 * POM for individual deal cards in the pipeline kanban board.
 * Handles deal card-specific interactions and validations.
 */
export class DealCard {
  /**
   * Get selectors for a specific deal card
   * @param {string} dealId - Deal ID
   */
  static getDealSelectors(dealId) {
    return {
      card: `[data-cy="deal-card-${dealId}"]`,
      name: `[data-cy="deal-name-${dealId}"]`,
      company: `[data-cy="deal-company-${dealId}"]`,
      amount: `[data-cy="deal-amount-${dealId}"]`,
      probability: `[data-cy="deal-probability-${dealId}"]`,
      owner: `[data-cy="deal-owner-${dealId}"]`,
      dueDate: `[data-cy="deal-due-date-${dealId}"]`,
      rottenBadge: `[data-cy="deal-rotten-${dealId}"]`,
      priorityBadge: `[data-cy="deal-priority-${dealId}"]`,
    }
  }

  /**
   * @param {string} dealId - The deal ID
   */
  constructor(dealId) {
    this.dealId = dealId
    this.selectors = DealCard.getDealSelectors(dealId)
  }

  /**
   * Validate deal card is visible
   */
  validateVisible() {
    cy.get(this.selectors.card).should('be.visible')
    return this
  }

  /**
   * Validate deal card does not exist
   */
  validateNotExists() {
    cy.get(this.selectors.card).should('not.exist')
    return this
  }

  /**
   * Click the deal card
   */
  click() {
    cy.get(this.selectors.card).click()
    return this
  }

  /**
   * Validate deal name
   * @param {string} name - Expected name
   */
  validateName(name) {
    cy.get(this.selectors.name).should('contain', name)
    return this
  }

  /**
   * Validate deal company
   * @param {string} company - Expected company name
   */
  validateCompany(company) {
    cy.get(this.selectors.company).should('contain', company)
    return this
  }

  /**
   * Get the deal amount
   */
  getAmount() {
    return cy.get(this.selectors.amount).invoke('text')
  }

  /**
   * Validate deal amount
   * @param {string} amount - Expected amount (e.g., "$25,000")
   */
  validateAmount(amount) {
    cy.get(this.selectors.amount).should('contain', amount)
    return this
  }

  /**
   * Get the deal probability
   */
  getProbability() {
    return cy.get(this.selectors.probability).invoke('text')
  }

  /**
   * Validate deal probability
   * @param {string} probability - Expected probability (e.g., "75%")
   */
  validateProbability(probability) {
    cy.get(this.selectors.probability).should('contain', probability)
    return this
  }

  /**
   * Validate deal owner
   * @param {string} owner - Expected owner name
   */
  validateOwner(owner) {
    cy.get(this.selectors.owner).should('contain', owner)
    return this
  }

  /**
   * Validate due date
   * @param {string} date - Expected due date
   */
  validateDueDate(date) {
    cy.get(this.selectors.dueDate).should('contain', date)
    return this
  }

  /**
   * Validate deal is marked as rotten
   */
  isRotten() {
    return cy.get(this.selectors.rottenBadge).should('exist')
  }

  /**
   * Validate rotten badge is visible
   */
  validateRottenBadge() {
    cy.get(this.selectors.rottenBadge).should('be.visible')
    return this
  }

  /**
   * Validate deal is not marked as rotten
   */
  validateNotRotten() {
    cy.get(this.selectors.rottenBadge).should('not.exist')
    return this
  }

  /**
   * Validate priority badge
   * @param {string} priority - Expected priority (e.g., "High", "Medium", "Low")
   */
  validatePriority(priority) {
    cy.get(this.selectors.priorityBadge).should('contain', priority)
    return this
  }

  /**
   * Validate priority badge is visible
   */
  validatePriorityBadgeVisible() {
    cy.get(this.selectors.priorityBadge).should('be.visible')
    return this
  }

  /**
   * Validate priority badge is not visible
   */
  validateNoPriorityBadge() {
    cy.get(this.selectors.priorityBadge).should('not.exist')
    return this
  }

  /**
   * Hover over the deal card
   */
  hover() {
    cy.get(this.selectors.card).trigger('mouseenter')
    return this
  }

  /**
   * Trigger drag start on the deal card
   */
  dragStart() {
    cy.get(this.selectors.card).trigger('dragstart')
    return this
  }

  /**
   * Trigger drag end on the deal card
   */
  dragEnd() {
    cy.get(this.selectors.card).trigger('dragend')
    return this
  }
}
