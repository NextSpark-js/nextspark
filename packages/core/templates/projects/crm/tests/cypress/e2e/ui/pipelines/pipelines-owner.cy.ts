/// <reference types="cypress" />

/**
 * Pipelines CRUD - Owner Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { PipelinesPOM } from '../../../src/entities/PipelinesPOM'
import { loginAsCrmOwner } from '../../../src/session-helpers'

describe('Pipelines CRUD - Owner Role (Full Access)', () => {
  const pipelines = new PipelinesPOM()

  beforeEach(() => {
    loginAsCrmOwner()
    cy.visit('/dashboard/pipelines')
    pipelines.list.validatePageVisible()
  })

  // ==================== CREATE ====================
  describe('CREATE Pipeline', () => {
    it('OWNER_PIPE_CREATE_001: Should create new pipeline with required fields', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Sales Pipeline 2025'
      })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
      pipelines.list.validatePageVisible()
    })

    it('OWNER_PIPE_CREATE_002: Should create pipeline with multiple stages', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Complex Sales Pipeline'
      })

      pipelines.validateStagesRepeaterVisible()

      // Modify default stages
      pipelines.fillStageByIndex(0, { name: 'Lead', probability: 10 })
      pipelines.fillStageByIndex(1, { name: 'Qualified', probability: 25 })
      pipelines.fillStageByIndex(2, { name: 'Proposal', probability: 50 })
      pipelines.fillStageByIndex(3, { name: 'Negotiation', probability: 75 })
      pipelines.fillStageByIndex(4, { name: 'Closed Won', probability: 100 })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('OWNER_PIPE_CREATE_003: Should create pipeline with optional fields', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Default Support Pipeline',
        description: 'Pipeline for customer support tickets'
      })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('OWNER_PIPE_CREATE_004: Should show validation error for empty name', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      // Submit without filling name
      pipelines.submitPipelineForm()

      // Should stay on create page
      cy.url().should('include', '/create')
    })

    it('OWNER_PIPE_CREATE_005: Should cancel pipeline creation', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Cancel Test Pipeline'
      })

      pipelines.cancelPipelineForm()
      pipelines.list.validatePageVisible()
    })
  })

  // ==================== READ ====================
  describe('READ Pipeline', () => {
    it('OWNER_PIPE_READ_001: Should display pipelines list', () => {
      pipelines.list.validatePageVisible()
      pipelines.list.validateTableVisible()
    })

    it('OWNER_PIPE_READ_002: Should search and filter pipelines', () => {
      pipelines.list.search('Sales')
      cy.wait(500)
      pipelines.list.clearSearch()
    })

    it('OWNER_PIPE_READ_003: Should view pipeline details (Kanban)', () => {
      pipelines.list.clickRowByIndex(0)
      cy.url().should('match', /\/pipelines\/[a-zA-Z0-9-]+$/)
      pipelines.validateKanbanVisible()
    })

    it('OWNER_PIPE_READ_004: Should paginate through pipelines', () => {
      pipelines.list.validatePageVisible()

      cy.get(pipelines.list.selectors.pagination).then($pagination => {
        if ($pagination.length > 0) {
          pipelines.list.nextPage()
        }
      })
    })
  })

  // ==================== UPDATE ====================
  describe('UPDATE Pipeline', () => {
    it('OWNER_PIPE_UPDATE_001: Should update pipeline name', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      cy.url().then(url => {
        const pipelineId = url.split('/').pop()
        pipelines.visitEdit(pipelineId!)
      })

      pipelines.validateFormVisible()
      cy.get(pipelines.formSelectors.nameInput).clear().type('Sales Pipeline 2025 Updated')

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('OWNER_PIPE_UPDATE_002: Should update pipeline stages', () => {
      pipelines.list.clickRowByIndex(0)

      cy.url().then(url => {
        const pipelineId = url.split('/').pop()
        pipelines.visitEdit(pipelineId!)
      })

      pipelines.validateFormVisible()
      pipelines.validateStagesRepeaterVisible()

      // Add a new stage
      pipelines.addStage()

      cy.get(pipelines.stagesSelectors.list)
        .find('[data-cy^="stages-repeater-item-"]')
        .last()
        .within(() => {
          cy.get('input[data-cy^="stages-repeater-name-"]').type('Closed Lost')
          cy.get('input[data-cy^="stages-repeater-probability-"]').clear().type('0')
        })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('OWNER_PIPE_UPDATE_003: Should update optional fields', () => {
      pipelines.list.clickRowByIndex(0)

      cy.url().then(url => {
        const pipelineId = url.split('/').pop()
        pipelines.visitEdit(pipelineId!)
      })

      pipelines.validateFormVisible()

      cy.get(pipelines.formSelectors.descriptionInput)
        .clear()
        .type('Updated pipeline description')

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('OWNER_PIPE_UPDATE_004: Should cancel update without saving', () => {
      pipelines.list.clickRowByIndex(0)

      cy.url().then(url => {
        const pipelineId = url.split('/').pop()
        pipelines.visitEdit(pipelineId!)
      })

      pipelines.validateFormVisible()
      cy.get(pipelines.formSelectors.nameInput).clear().type('Should Not Be Saved')

      pipelines.cancelPipelineForm()
      cy.url().should('not.include', '/edit')
    })
  })

  // ==================== DELETE ====================
  describe('DELETE Pipeline', () => {
    it('OWNER_PIPE_DELETE_001: Should delete pipeline', () => {
      // Create a pipeline to delete
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Pipeline To Delete'
      })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')

      // Delete it
      pipelines.list.validatePageVisible()
      pipelines.list.search('Pipeline To Delete')

      cy.get(pipelines.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      pipelines.list.confirmDelete()

      // Verify deleted
      pipelines.list.search('Pipeline To Delete')
      cy.get(pipelines.list.selectors.emptyState).should('be.visible')
    })

    it('OWNER_PIPE_DELETE_002: Should cancel deletion', () => {
      pipelines.list.search('Sales')

      cy.get(pipelines.list.selectors.rowGeneric).first().then($row => {
        cy.wrap($row).within(() => {
          cy.get('[data-cy*="delete"]').click()
        })
      })

      pipelines.list.cancelDelete()
      pipelines.list.validateTableVisible()
    })

    it('OWNER_PIPE_DELETE_003: Should handle bulk delete', () => {
      pipelines.list.selectAll()
      pipelines.list.validateBulkActionsVisible()
    })
  })

  // ==================== KANBAN BOARD ====================
  describe('KANBAN Board', () => {
    it('OWNER_PIPE_KANBAN_001: Should display Kanban board on pipeline detail', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()
      pipelines.validateStatsVisible()
    })

    it('OWNER_PIPE_KANBAN_002: Should display pipeline header with name', () => {
      pipelines.list.clickRowByIndex(0)
      cy.get(pipelines.kanbanSelectors.header).should('be.visible')
    })

    it('OWNER_PIPE_KANBAN_003: Should display stats cards', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateStatsVisible()
    })

    it('OWNER_PIPE_KANBAN_004: Should display stage columns', () => {
      pipelines.list.clickRowByIndex(0)
      cy.get(pipelines.kanbanSelectors.boardContainer).should('be.visible')
      cy.get('[data-cy^="stage-column-"]').should('have.length.at.least', 1)
    })

    it('OWNER_PIPE_KANBAN_005: Should click add deal button', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()
      pipelines.clickAddDeal()
      cy.url().should('include', 'opportunities')
    })
  })
})
