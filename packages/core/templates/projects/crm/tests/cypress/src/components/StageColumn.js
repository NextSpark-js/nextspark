/**
 * StageColumn - Page Object Model Class
 *
 * POM for individual stage columns in the pipeline kanban board.
 * Handles stage-specific interactions and validations.
 */
export class StageColumn {
  /**
   * Get selectors for a specific stage
   * @param {string} stageId - Stage ID
   */
  static getStageSelectors(stageId) {
    return {
      column: `[data-cy="pipeline-stage-${stageId}"]`,
      header: `[data-cy="stage-header-${stageId}"]`,
      title: `[data-cy="stage-title-${stageId}"]`,
      count: `[data-cy="stage-count-${stageId}"]`,
      value: `[data-cy="stage-value-${stageId}"]`,
      deals: `[data-cy="stage-deals-${stageId}"]`,
      emptyState: `[data-cy="stage-empty-${stageId}"]`,
      addDealBtn: `[data-cy="stage-add-deal-${stageId}"]`,
    }
  }

  /**
   * @param {string} stageId - The stage ID
   */
  constructor(stageId) {
    this.stageId = stageId
    this.selectors = StageColumn.getStageSelectors(stageId)
  }

  /**
   * Validate stage column is visible
   */
  validateVisible() {
    cy.get(this.selectors.column).should('be.visible')
    return this
  }

  /**
   * Validate stage header is visible
   */
  validateHeaderVisible() {
    cy.get(this.selectors.header).should('be.visible')
    return this
  }

  /**
   * Validate stage title
   * @param {string} title - Expected title
   */
  validateTitle(title) {
    cy.get(this.selectors.title).should('contain', title)
    return this
  }

  /**
   * Get the deal count in this stage
   */
  getDealCount() {
    return cy.get(this.selectors.column)
      .find('[data-cy^="deal-card-"]')
      .its('length')
  }

  /**
   * Validate number of deals in this stage
   * @param {number} count - Expected deal count
   */
  validateDealCount(count) {
    if (count === 0) {
      this.validateEmpty()
    } else {
      cy.get(this.selectors.column)
        .find('[data-cy^="deal-card-"]')
        .should('have.length', count)
    }
    return this
  }

  /**
   * Validate stage count badge
   * @param {number} count - Expected count
   */
  validateCountBadge(count) {
    cy.get(this.selectors.count).should('contain', count)
    return this
  }

  /**
   * Get the total value in this stage
   */
  getTotalValue() {
    return cy.get(this.selectors.value).invoke('text')
  }

  /**
   * Validate total value displayed
   * @param {string} value - Expected value (e.g., "$50,000")
   */
  validateTotalValue(value) {
    cy.get(this.selectors.value).should('contain', value)
    return this
  }

  /**
   * Validate stage is empty
   */
  isEmpty() {
    return cy.get(this.selectors.emptyState).should('exist')
  }

  /**
   * Validate empty state is visible
   */
  validateEmpty() {
    cy.get(this.selectors.emptyState).should('be.visible')
    return this
  }

  /**
   * Validate stage is not empty
   */
  validateNotEmpty() {
    cy.get(this.selectors.emptyState).should('not.exist')
    cy.get(this.selectors.column)
      .find('[data-cy^="deal-card-"]')
      .should('have.length.greaterThan', 0)
    return this
  }

  /**
   * Click add deal button in this stage
   */
  addDeal() {
    cy.get(this.selectors.addDealBtn).click()
    return this
  }

  /**
   * Validate add deal button is visible
   */
  validateAddDealVisible() {
    cy.get(this.selectors.addDealBtn).should('be.visible')
    return this
  }

  /**
   * Get all deals in this stage
   */
  getDeals() {
    return cy.get(this.selectors.column)
      .find('[data-cy^="deal-card-"]')
  }

  /**
   * Validate a specific deal exists in this stage
   * @param {string} dealId - Deal ID
   */
  validateDealExists(dealId) {
    cy.get(this.selectors.column)
      .find(`[data-cy="deal-card-${dealId}"]`)
      .should('exist')
    return this
  }

  /**
   * Validate a specific deal does not exist in this stage
   * @param {string} dealId - Deal ID
   */
  validateDealNotExists(dealId) {
    cy.get(this.selectors.column)
      .find(`[data-cy="deal-card-${dealId}"]`)
      .should('not.exist')
    return this
  }

  /**
   * Get a specific deal card in this stage
   * @param {string} dealId - Deal ID
   */
  getDealCard(dealId) {
    return cy.get(this.selectors.column)
      .find(`[data-cy="deal-card-${dealId}"]`)
  }

  /**
   * Click a specific deal card in this stage
   * @param {string} dealId - Deal ID
   */
  clickDeal(dealId) {
    this.getDealCard(dealId).click()
    return this
  }
}
