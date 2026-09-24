/**
 * PipelineKanban - Page Object Model Class
 *
 * POM for the CRM theme pipeline kanban board.
 * Handles kanban board interactions for pipeline/opportunity management.
 */
export class PipelineKanban {
  static selectors = {
    container: '[data-cy="pipeline-kanban"]',
    header: '[data-cy="pipeline-kanban-header"]',
    pipelineSelect: '[data-cy="pipeline-select"]',
    addDealBtn: '[data-cy="pipeline-add-deal"]',
    stats: '[data-cy="pipeline-stats"]',
    statsTotal: '[data-cy="pipeline-stats-total"]',
    statsValue: '[data-cy="pipeline-stats-value"]',
    statsAverage: '[data-cy="pipeline-stats-average"]',
    board: '[data-cy="pipeline-board"]',
    stage: '[data-cy^="pipeline-stage-"]',
    emptyBoard: '[data-cy="pipeline-empty"]',
  }

  /**
   * Validate kanban board is visible
   */
  validateVisible() {
    cy.get(PipelineKanban.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate header is visible
   */
  validateHeaderVisible() {
    cy.get(PipelineKanban.selectors.header).should('be.visible')
    return this
  }

  /**
   * Validate add deal button is visible
   */
  validateAddDealVisible() {
    cy.get(PipelineKanban.selectors.addDealBtn).should('be.visible')
    return this
  }

  /**
   * Click add deal button
   */
  addDeal() {
    cy.get(PipelineKanban.selectors.addDealBtn).click()
    return this
  }

  /**
   * Select a pipeline
   * @param {string} pipelineName - Pipeline name
   */
  selectPipeline(pipelineName) {
    cy.get(PipelineKanban.selectors.pipelineSelect).click()
    cy.contains(pipelineName).click()
    return this
  }

  /**
   * Validate board is visible
   */
  validateBoardVisible() {
    cy.get(PipelineKanban.selectors.board).should('be.visible')
    return this
  }

  /**
   * Validate empty board state
   */
  validateEmptyBoard() {
    cy.get(PipelineKanban.selectors.emptyBoard).should('be.visible')
    return this
  }

  /**
   * Get a specific stage
   * @param {string} stageId - Stage ID
   */
  getStage(stageId) {
    return cy.get(`[data-cy="pipeline-stage-${stageId}"]`)
  }

  /**
   * Validate stage exists
   * @param {string} stageId - Stage ID
   */
  validateStageExists(stageId) {
    this.getStage(stageId).should('exist')
    return this
  }

  /**
   * Get the count of stages
   */
  getStageCount() {
    return cy.get(PipelineKanban.selectors.stage).its('length')
  }

  /**
   * Validate number of stages
   * @param {number} count - Expected stage count
   */
  validateStageCount(count) {
    cy.get(PipelineKanban.selectors.stage).should('have.length', count)
    return this
  }

  /**
   * Get deals in a specific stage
   * @param {string} stageId - Stage ID
   */
  getDealsInStage(stageId) {
    return cy.get(`[data-cy="pipeline-stage-${stageId}"]`)
      .find('[data-cy^="deal-card-"]')
  }

  /**
   * Validate number of deals in a stage
   * @param {string} stageId - Stage ID
   * @param {number} count - Expected deal count
   */
  validateDealCountInStage(stageId, count) {
    this.getDealsInStage(stageId).should('have.length', count)
    return this
  }

  /**
   * Drag a deal to a different stage
   * @param {string} dealId - Deal ID
   * @param {string} toStageId - Target stage ID
   */
  dragDeal(dealId, toStageId) {
    const dealSelector = `[data-cy="deal-card-${dealId}"]`
    const targetSelector = `[data-cy="pipeline-stage-${toStageId}"]`

    cy.get(dealSelector)
      .trigger('dragstart')

    cy.get(targetSelector)
      .trigger('drop')

    cy.get(dealSelector)
      .trigger('dragend')

    return this
  }

  /**
   * Click a deal card
   * @param {string} dealId - Deal ID
   */
  clickDeal(dealId) {
    cy.get(`[data-cy="deal-card-${dealId}"]`).click()
    return this
  }

  /**
   * Validate stats are visible
   */
  validateStatsVisible() {
    cy.get(PipelineKanban.selectors.stats).should('be.visible')
    return this
  }

  /**
   * Validate total deals stat
   * @param {number} total - Expected total deals
   */
  validateTotalDeals(total) {
    cy.get(PipelineKanban.selectors.statsTotal).should('contain', total)
    return this
  }

  /**
   * Validate total value stat
   * @param {string} value - Expected total value (e.g., "$250,000")
   */
  validateTotalValue(value) {
    cy.get(PipelineKanban.selectors.statsValue).should('contain', value)
    return this
  }

  /**
   * Validate average deal value stat
   * @param {string} average - Expected average value (e.g., "$25,000")
   */
  validateAverageValue(average) {
    cy.get(PipelineKanban.selectors.statsAverage).should('contain', average)
    return this
  }

  /**
   * Validate pipeline select is visible
   */
  validatePipelineSelectVisible() {
    cy.get(PipelineKanban.selectors.pipelineSelect).should('be.visible')
    return this
  }
}
