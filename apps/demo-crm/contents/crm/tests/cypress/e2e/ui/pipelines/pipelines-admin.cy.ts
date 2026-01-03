/// <reference types="cypress" />

/**
 * Pipelines CRUD - Admin Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { PipelinesPOM } from '../../../src/entities/PipelinesPOM'
import { loginAsCrmAdmin } from '../../../src/session-helpers'

describe('Pipelines CRUD - Admin Role (Full Access)', () => {
  const pipelines = new PipelinesPOM()

  beforeEach(() => {
    loginAsCrmAdmin()
    cy.visit('/dashboard/pipelines')
    pipelines.list.validatePageVisible()
  })

  // ==================== CREATE ====================
  describe('CREATE Pipeline', () => {
    it('ADMIN_PIPE_CREATE_001: Should create new pipeline with required fields', () => {
      // Click create button
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      // Fill required fields using custom form
      pipelines.fillPipelineForm({
        name: 'Admin Sales Pipeline 2025'
      })

      // Submit form
      pipelines.submitPipelineForm()

      // Verify success - should navigate to detail or list
      cy.url().should('include', '/pipelines')
      pipelines.list.validatePageVisible()
    })

    it('ADMIN_PIPE_CREATE_002: Should create pipeline with multiple stages', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Admin Complex Pipeline'
      })

      // Validate stages repeater is visible
      pipelines.validateStagesRepeaterVisible()

      // Fill default stages (they should already exist)
      pipelines.fillStageByIndex(0, { name: 'Prospect', probability: 10 })
      pipelines.fillStageByIndex(1, { name: 'Contact Made', probability: 25 })

      // Add more stages
      pipelines.addStage()
      pipelines.fillStageByIndex(5, { name: 'Won', probability: 100 })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('ADMIN_PIPE_CREATE_003: Should create pipeline with optional fields', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Admin Default Pipeline',
        description: 'Pipeline created by admin user'
      })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('ADMIN_PIPE_CREATE_004: Should show validation error for empty name', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      // Submit without filling name
      pipelines.submitPipelineForm()

      // Should show validation error (form shouldn't submit)
      cy.url().should('include', '/create')
    })

    it('ADMIN_PIPE_CREATE_005: Should cancel pipeline creation', () => {
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Admin Cancel Test Pipeline'
      })

      // Cancel instead of submit
      pipelines.cancelPipelineForm()

      // Should return to list
      pipelines.list.validatePageVisible()
    })
  })

  // ==================== READ ====================
  describe('READ Pipeline', () => {
    it('ADMIN_PIPE_READ_001: Should display pipelines list', () => {
      // List should be visible from beforeEach
      pipelines.list.validatePageVisible()
      pipelines.list.validateTableVisible()
    })

    it('ADMIN_PIPE_READ_002: Should search and filter pipelines', () => {
      // Search for specific pipeline
      pipelines.list.search('Admin')

      // Wait for search results
      cy.wait(500)

      // Clear search
      pipelines.list.clearSearch()
    })

    it('ADMIN_PIPE_READ_003: Should view pipeline details (Kanban)', () => {
      // Click on first row to view Kanban
      pipelines.list.clickRowByIndex(0)

      // Should navigate to detail page showing Kanban
      cy.url().should('match', /\/pipelines\/[a-zA-Z0-9-]+$/)

      // Validate Kanban board is visible
      pipelines.validateKanbanVisible()
    })

    it('ADMIN_PIPE_READ_004: Should paginate through pipelines', () => {
      pipelines.list.validatePageVisible()

      // Check if pagination exists
      cy.get(pipelines.list.selectors.pagination).then($pagination => {
        if ($pagination.length > 0) {
          pipelines.list.nextPage()
        }
      })
    })

    it('ADMIN_PIPE_READ_005: Should view pipelines created by other users', () => {
      // Admin should see all pipelines
      pipelines.list.validateTableVisible()
    })
  })

  // ==================== UPDATE ====================
  describe('UPDATE Pipeline', () => {
    it('ADMIN_PIPE_UPDATE_001: Should update pipeline name', () => {
      // Navigate to edit page for first pipeline
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // Get pipeline ID from URL and navigate to edit
      cy.url().then(url => {
        const pipelineId = url.split('/').pop()
        pipelines.visitEdit(pipelineId!)
      })

      pipelines.validateFormVisible()

      // Update name
      cy.get(pipelines.formSelectors.nameInput).clear().type('Admin Sales Pipeline Updated')

      pipelines.submitPipelineForm()

      // Verify success
      cy.url().should('include', '/pipelines')
    })

    it('ADMIN_PIPE_UPDATE_002: Should update pipeline stages', () => {
      // Navigate to first pipeline edit
      pipelines.list.clickRowByIndex(0)

      cy.url().then(url => {
        const pipelineId = url.split('/').pop()
        pipelines.visitEdit(pipelineId!)
      })

      pipelines.validateFormVisible()
      pipelines.validateStagesRepeaterVisible()

      // Add a new stage
      pipelines.addStage()

      // Fill the new stage
      cy.get(pipelines.stagesSelectors.list)
        .find('[data-cy^="stages-repeater-item-"]')
        .last()
        .within(() => {
          cy.get('input[data-cy^="stages-repeater-name-"]').type('New Admin Stage')
          cy.get('input[data-cy^="stages-repeater-probability-"]').clear().type('50')
        })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')
    })

    it('ADMIN_PIPE_UPDATE_003: Should cancel update without saving', () => {
      pipelines.list.clickRowByIndex(0)

      cy.url().then(url => {
        const pipelineId = url.split('/').pop()
        pipelines.visitEdit(pipelineId!)
      })

      pipelines.validateFormVisible()

      // Make changes
      cy.get(pipelines.formSelectors.nameInput).clear().type('Admin Should Not Save')

      // Cancel instead of submit
      pipelines.cancelPipelineForm()

      // Should return to previous page
      cy.url().should('not.include', '/edit')
    })
  })

  // ==================== DELETE ====================
  describe('DELETE Pipeline', () => {
    it('ADMIN_PIPE_DELETE_001: Should delete pipeline from list', () => {
      // First create a pipeline to delete
      pipelines.list.clickCreate()
      pipelines.validateFormVisible()

      pipelines.fillPipelineForm({
        name: 'Admin Pipeline To Delete'
      })

      pipelines.submitPipelineForm()
      cy.url().should('include', '/pipelines')

      // Now try to delete from list
      pipelines.list.validatePageVisible()
      pipelines.list.search('Admin Pipeline To Delete')

      // Click delete action for the row
      cy.get(pipelines.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      // Confirm deletion
      pipelines.list.confirmDelete()

      // Verify deleted
      pipelines.list.search('Admin Pipeline To Delete')
      cy.get(pipelines.list.selectors.emptyState).should('be.visible')
    })

    it('ADMIN_PIPE_DELETE_002: Should cancel deletion', () => {
      pipelines.list.search('Admin')

      // Try to delete first item
      cy.get(pipelines.list.selectors.rowGeneric).first().then($row => {
        cy.wrap($row).within(() => {
          cy.get('[data-cy*="delete"]').click()
        })
      })

      // Cancel deletion
      pipelines.list.cancelDelete()

      // Verify still exists
      pipelines.list.validateTableVisible()
    })

    it('ADMIN_PIPE_DELETE_003: Should handle bulk delete', () => {
      // Select multiple items
      pipelines.list.selectAll()

      // Validate bulk actions visible
      pipelines.list.validateBulkActionsVisible()
    })
  })

  // ==================== KANBAN BOARD ====================
  describe('KANBAN Board', () => {
    it('ADMIN_PIPE_KANBAN_001: Should display Kanban board on pipeline detail', () => {
      pipelines.list.clickRowByIndex(0)

      pipelines.validateKanbanVisible()
      pipelines.validateStatsVisible()
    })

    it('ADMIN_PIPE_KANBAN_002: Should display pipeline header with name', () => {
      pipelines.list.clickRowByIndex(0)

      cy.get(pipelines.kanbanSelectors.header).should('be.visible')
    })

    it('ADMIN_PIPE_KANBAN_003: Should display stats cards', () => {
      pipelines.list.clickRowByIndex(0)

      pipelines.validateStatsVisible()
    })

    it('ADMIN_PIPE_KANBAN_004: Should display stage columns', () => {
      pipelines.list.clickRowByIndex(0)

      cy.get(pipelines.kanbanSelectors.boardContainer).should('be.visible')
      cy.get('[data-cy^="stage-column-"]').should('have.length.at.least', 1)
    })

    it('ADMIN_PIPE_KANBAN_005: Should click add deal button', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      pipelines.clickAddDeal()

      // Should navigate to opportunity create or open modal
      cy.url().should('include', 'opportunities')
    })
  })
})
