/**
 * Pipelines Page Object Model for CRM Theme
 *
 * Entity-specific POM for Pipelines with Kanban board support.
 * Extends generic patterns with pipeline-specific functionality.
 *
 * Usage:
 *   const pipelines = new PipelinesPOM()
 *   pipelines.kanban.validateBoardVisible()
 *   pipelines.form.fillStages([{ name: 'Lead', probability: 10 }])
 */

import { EntityList } from '../components/EntityList'
import { EntityForm } from '../components/EntityForm'
import { EntityDetail } from '../components/EntityDetail'

export interface StageInput {
  name: string
  probability: number
  color?: string
}

export class PipelinesPOM {
  /** Generic list POM for pipelines */
  readonly list: EntityList

  /** Generic form POM for pipelines */
  readonly form: EntityForm

  /** Generic detail POM for pipelines */
  readonly detail: EntityDetail

  /** Pipeline entity slug */
  readonly slug = 'pipelines'

  constructor() {
    this.list = EntityList.for('pipelines')
    this.form = EntityForm.for('pipelines')
    this.detail = new EntityDetail('pipelines', 'pipeline', ['stages'])
  }

  // ============================================
  // PIPELINE FORM SELECTORS (Custom)
  // ============================================

  /**
   * Pipeline-specific form selectors
   */
  get formSelectors() {
    return {
      form: '[data-cy="pipeline-form"]',
      nameInput: '[data-cy="pipeline-form-name"]',
      descriptionInput: '[data-cy="pipeline-form-description"]',
      cancelButton: '[data-cy="pipeline-form-cancel"]',
      submitButton: '[data-cy="pipeline-form-submit"]',
    }
  }

  /**
   * Stages repeater selectors
   */
  get stagesSelectors() {
    return {
      repeater: '[data-cy="stages-repeater"]',
      list: '[data-cy="stages-repeater-list"]',
      count: '[data-cy="stages-repeater-count"]',
      addButton: '[data-cy="stages-repeater-add-btn"]',
      item: (stageId: string) => `[data-cy="stages-repeater-item-${stageId}"]`,
      nameInput: (stageId: string) => `[data-cy="stages-repeater-name-${stageId}"]`,
      probabilityInput: (stageId: string) => `[data-cy="stages-repeater-probability-${stageId}"]`,
      deleteButton: (stageId: string) => `[data-cy="stages-repeater-delete-${stageId}"]`,
    }
  }

  // ============================================
  // KANBAN BOARD SELECTORS
  // ============================================

  /**
   * Kanban board selectors
   */
  get kanbanSelectors() {
    return {
      board: '[data-cy="pipeline-kanban"]',
      header: '[data-cy="pipeline-kanban-header"]',
      stats: '[data-cy="pipeline-kanban-stats"]',
      boardContainer: '[data-cy="pipeline-kanban-board"]',
      addDealButton: '[data-cy="pipeline-kanban-add-deal-btn"]',
      // Stage columns
      stageColumn: (stageId: string) => `[data-cy="stage-column-${stageId}"]`,
      stageHeader: (stageId: string) => `[data-cy="stage-column-header-${stageId}"]`,
      stageDeals: (stageId: string) => `[data-cy="stage-column-deals-${stageId}"]`,
      stageEmpty: (stageId: string) => `[data-cy="stage-column-empty-${stageId}"]`,
      stageAddDeal: (stageId: string) => `[data-cy="stage-column-add-deal-${stageId}"]`,
      // Deal cards
      dealCard: (dealId: string) => `[data-cy="deal-card-${dealId}"]`,
      dealCardName: (dealId: string) => `[data-cy="deal-card-name-${dealId}"]`,
      dealCardCompany: (dealId: string) => `[data-cy="deal-card-company-${dealId}"]`,
      dealCardAmount: (dealId: string) => `[data-cy="deal-card-amount-${dealId}"]`,
    }
  }

  // ============================================
  // PIPELINE FORM METHODS
  // ============================================

  /**
   * Fill the pipeline form with basic info
   */
  fillPipelineForm(data: { name: string; description?: string }) {
    cy.get(this.formSelectors.nameInput).clear().type(data.name)
    if (data.description) {
      cy.get(this.formSelectors.descriptionInput).clear().type(data.description)
    }
    return this
  }

  /**
   * Add a new stage to the pipeline
   */
  addStage() {
    cy.get(this.stagesSelectors.addButton).click()
    return this
  }

  /**
   * Fill stage data by index
   */
  fillStageByIndex(index: number, data: { name: string; probability: number }) {
    cy.get(this.stagesSelectors.list)
      .find('[data-cy^="stages-repeater-item-"]')
      .eq(index)
      .within(() => {
        cy.get('input[data-cy^="stages-repeater-name-"]').clear().type(data.name)
        cy.get('input[data-cy^="stages-repeater-probability-"]').clear().type(data.probability.toString())
      })
    return this
  }

  /**
   * Delete stage by index
   */
  deleteStageByIndex(index: number) {
    cy.get(this.stagesSelectors.list)
      .find('[data-cy^="stages-repeater-item-"]')
      .eq(index)
      .find('[data-cy^="stages-repeater-delete-"]')
      .click()
    return this
  }

  /**
   * Submit the pipeline form
   */
  submitPipelineForm() {
    cy.get(this.formSelectors.submitButton).click()
    return this
  }

  /**
   * Cancel the pipeline form
   */
  cancelPipelineForm() {
    cy.get(this.formSelectors.cancelButton).click()
    return this
  }

  // ============================================
  // KANBAN BOARD METHODS
  // ============================================

  /**
   * Validate the kanban board is visible
   */
  validateKanbanVisible() {
    cy.get(this.kanbanSelectors.board).should('be.visible')
    return this
  }

  /**
   * Validate kanban header is visible with pipeline name
   */
  validateKanbanHeader(pipelineName: string) {
    cy.get(this.kanbanSelectors.header)
      .should('be.visible')
      .and('contain.text', pipelineName)
    return this
  }

  /**
   * Validate stats cards are visible
   */
  validateStatsVisible() {
    cy.get(this.kanbanSelectors.stats).should('be.visible')
    return this
  }

  /**
   * Validate a stage column exists
   */
  validateStageColumnVisible(stageId: string) {
    cy.get(this.kanbanSelectors.stageColumn(stageId)).should('be.visible')
    return this
  }

  /**
   * Validate stage column is empty
   */
  validateStageEmpty(stageId: string) {
    cy.get(this.kanbanSelectors.stageEmpty(stageId)).should('be.visible')
    return this
  }

  /**
   * Validate deal card exists in stage
   */
  validateDealInStage(dealId: string, stageId: string) {
    cy.get(this.kanbanSelectors.stageDeals(stageId))
      .find(this.kanbanSelectors.dealCard(dealId))
      .should('exist')
    return this
  }

  /**
   * Click on a deal card
   */
  clickDealCard(dealId: string) {
    cy.get(this.kanbanSelectors.dealCard(dealId)).click()
    return this
  }

  /**
   * Click add deal button in header
   */
  clickAddDeal() {
    cy.get(this.kanbanSelectors.addDealButton).click()
    return this
  }

  /**
   * Click add deal in specific stage
   */
  clickAddDealInStage(stageId: string) {
    cy.get(this.kanbanSelectors.stageAddDeal(stageId)).click()
    return this
  }

  /**
   * Drag deal from one stage to another
   * Note: Uses HTML5 drag and drop simulation
   */
  dragDealToStage(dealId: string, targetStageId: string) {
    const dealCard = this.kanbanSelectors.dealCard(dealId)
    const targetColumn = this.kanbanSelectors.stageDeals(targetStageId)

    cy.get(dealCard).trigger('dragstart', { dataTransfer: new DataTransfer() })
    cy.get(targetColumn).trigger('dragover')
    cy.get(targetColumn).trigger('drop')
    cy.get(dealCard).trigger('dragend')

    return this
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Visit the pipelines list page
   */
  visitList() {
    cy.visit('/dashboard/pipelines')
    this.list.waitForPageLoad()
    return this
  }

  /**
   * Visit a specific pipeline's kanban view
   */
  visitKanban(pipelineId: string) {
    cy.visit(`/dashboard/pipelines/${pipelineId}`)
    this.validateKanbanVisible()
    return this
  }

  /**
   * Visit the create pipeline page
   */
  visitCreate() {
    cy.visit('/dashboard/pipelines/create')
    cy.get(this.formSelectors.form).should('be.visible')
    return this
  }

  /**
   * Visit the edit pipeline page
   */
  visitEdit(pipelineId: string) {
    cy.visit(`/dashboard/pipelines/${pipelineId}/edit`)
    cy.get(this.formSelectors.form).should('be.visible')
    return this
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate pipeline form is visible
   */
  validateFormVisible() {
    cy.get(this.formSelectors.form).should('be.visible')
    return this
  }

  /**
   * Validate stages repeater is visible
   */
  validateStagesRepeaterVisible() {
    cy.get(this.stagesSelectors.repeater).should('be.visible')
    return this
  }

  /**
   * Validate stages count
   */
  validateStagesCount(count: number) {
    cy.get(this.stagesSelectors.count).should('contain.text', `${count} stage`)
    return this
  }

  /**
   * Validate deal card displays correct amount
   */
  validateDealAmount(dealId: string, amount: string) {
    cy.get(this.kanbanSelectors.dealCardAmount(dealId)).should('contain.text', amount)
    return this
  }
}

export default PipelinesPOM
