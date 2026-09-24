/// <reference types="cypress" />

/**
 * Pipelines - Member Role (Read Only Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { PipelinesPOM } from '../../../src/entities/PipelinesPOM'
import { loginAsCrmMember } from '../../../src/session-helpers'

describe('Pipelines - Member Role (Read Only Access)', () => {
  const pipelines = new PipelinesPOM()

  beforeEach(() => {
    loginAsCrmMember()
    cy.visit('/dashboard/pipelines')
    pipelines.list.validatePageVisible()
  })

  // ==================== READ ONLY ====================
  describe('READ Pipeline (Allowed)', () => {
    it('MEMBER_PIPE_READ_001: Should display pipelines list', () => {
      pipelines.list.validatePageVisible()
      pipelines.list.validateTableVisible()
    })

    it('MEMBER_PIPE_READ_002: Should search and filter pipelines', () => {
      pipelines.list.search('Sales')
      cy.wait(500)
      pipelines.list.clearSearch()
    })

    it('MEMBER_PIPE_READ_003: Should view pipeline details (Kanban)', () => {
      pipelines.list.clickRowByIndex(0)
      cy.url().should('match', /\/pipelines\/[a-zA-Z0-9-]+$/)
      pipelines.validateKanbanVisible()
    })

    it('MEMBER_PIPE_READ_004: Should paginate through pipelines', () => {
      pipelines.list.validatePageVisible()

      cy.get(pipelines.list.selectors.pagination).then($pagination => {
        if ($pagination.length > 0) {
          pipelines.list.nextPage()
        }
      })
    })

    it('MEMBER_PIPE_READ_005: Should view pipelines created by other users', () => {
      // Member should see owner and admin created pipelines
      pipelines.list.validateTableVisible()
    })

    it('MEMBER_PIPE_READ_006: Should view pipeline stages in Kanban', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()
      cy.get('[data-cy^="stage-column-"]').should('have.length.at.least', 1)
    })
  })

  // ==================== CREATE NOT ALLOWED ====================
  describe('CREATE Pipeline (Denied)', () => {
    it('MEMBER_PIPE_CREATE_001: Should not see create button', () => {
      // Verify create button doesn't exist or is disabled
      cy.get(pipelines.list.selectors.createButton).should('not.exist')
    })

    it('MEMBER_PIPE_CREATE_002: Should not be able to navigate to create form via URL', () => {
      // Try to access create form directly
      cy.visit('/dashboard/pipelines/create', { failOnStatusCode: false })

      // Should redirect or show error
      cy.url().then(url => {
        if (url.includes('/create')) {
          // If on create page, should show permission error
          cy.contains(/unauthorized|access denied|permission denied|forbidden/i).should('exist')
        }
      })
    })

    it('MEMBER_PIPE_CREATE_003: Should show permission error on create attempt via API', () => {
      cy.request({
        method: 'POST',
        url: '/api/v1/pipelines',
        failOnStatusCode: false,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          name: 'Unauthorized Pipeline',
          stages: [{ id: '1', name: 'Test', order: 1, color: '#3b82f6' }]
        }
      }).then(response => {
        expect(response.status).to.be.oneOf([401, 403])
      })
    })
  })

  // ==================== UPDATE NOT ALLOWED ====================
  describe('UPDATE Pipeline (Denied)', () => {
    it('MEMBER_PIPE_UPDATE_001: Should not see edit button in list', () => {
      // Navigate to a pipeline
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // Check if edit button exists in Kanban header
      cy.get('[data-cy*="edit-btn"]').should('not.exist')
    })

    it('MEMBER_PIPE_UPDATE_002: Should not be able to navigate to edit form via URL', () => {
      // Get first pipeline ID
      pipelines.list.clickRowByIndex(0)

      cy.url().then(url => {
        const pipelineId = url.split('/').pop()

        // Try to access edit form directly
        cy.visit(`/dashboard/pipelines/${pipelineId}/edit`, { failOnStatusCode: false })

        cy.url().then(editUrl => {
          if (editUrl.includes('/edit')) {
            cy.contains(/unauthorized|access denied|permission denied|forbidden/i).should('exist')
          }
        })
      })
    })

    it('MEMBER_PIPE_UPDATE_003: Should show permission error on update attempt via API', () => {
      cy.request({
        method: 'PATCH',
        url: '/api/v1/pipelines/test-id',
        failOnStatusCode: false,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          name: 'Unauthorized Update'
        }
      }).then(response => {
        expect(response.status).to.be.oneOf([401, 403, 404])
      })
    })
  })

  // ==================== DELETE NOT ALLOWED ====================
  describe('DELETE Pipeline (Denied)', () => {
    it('MEMBER_PIPE_DELETE_001: Should not see delete button', () => {
      pipelines.list.validateTableVisible()

      // Verify delete actions don't exist in rows
      cy.get(pipelines.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').should('not.exist')
      })
    })

    it('MEMBER_PIPE_DELETE_002: Should not see bulk delete controls', () => {
      // Verify bulk select checkboxes don't allow deletion
      cy.get(pipelines.list.selectors.bulkActions).should('not.exist')
    })

    it('MEMBER_PIPE_DELETE_003: Should show permission error on delete attempt via API', () => {
      cy.request({
        method: 'DELETE',
        url: '/api/v1/pipelines/test-id',
        failOnStatusCode: false
      }).then(response => {
        expect(response.status).to.be.oneOf([401, 403, 404])
      })
    })
  })

  // ==================== PERMISSION BOUNDARIES ====================
  describe('Permission Boundaries', () => {
    it('MEMBER_PIPE_PERM_001: Should only have view access in Kanban', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // Should not see edit/delete buttons
      cy.get('[data-cy*="edit-btn"]').should('not.exist')
      cy.get('[data-cy*="delete-btn"]').should('not.exist')
    })

    it('MEMBER_PIPE_PERM_002: Should be able to view deals in Kanban', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // Should see deal cards (if any exist)
      cy.get(pipelines.kanbanSelectors.boardContainer).should('be.visible')
    })

    it('MEMBER_PIPE_PERM_003: Should not be able to add deals', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // Add deal button should not exist for members
      cy.get(pipelines.kanbanSelectors.addDealButton).should('not.exist')
    })

    it('MEMBER_PIPE_PERM_004: Should maintain read-only state during navigation', () => {
      // Check list page
      cy.get(pipelines.list.selectors.createButton).should('not.exist')

      // Navigate to Kanban
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // Navigate back
      cy.visit('/dashboard/pipelines')
      pipelines.list.validatePageVisible()

      // Still read-only
      cy.get(pipelines.list.selectors.createButton).should('not.exist')
    })
  })

  // ==================== KANBAN VIEW (Read Only) ====================
  describe('KANBAN View (Read Only)', () => {
    it('MEMBER_PIPE_KANBAN_001: Should display Kanban board', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()
    })

    it('MEMBER_PIPE_KANBAN_002: Should display stats cards', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateStatsVisible()
    })

    it('MEMBER_PIPE_KANBAN_003: Should display stage columns', () => {
      pipelines.list.clickRowByIndex(0)
      cy.get(pipelines.kanbanSelectors.boardContainer).should('be.visible')
      cy.get('[data-cy^="stage-column-"]').should('have.length.at.least', 1)
    })

    it('MEMBER_PIPE_KANBAN_004: Should not be able to drag deals', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // Deal cards should not be draggable for members
      cy.get('[data-cy^="deal-card-"]').first().then($card => {
        if ($card.length > 0) {
          // Try dragging - should not work or card should not have draggable attribute
          expect($card.attr('draggable')).to.not.equal('true')
        }
      })
    })

    it('MEMBER_PIPE_KANBAN_005: Should be able to click deal cards to view details', () => {
      pipelines.list.clickRowByIndex(0)
      pipelines.validateKanbanVisible()

      // If deal cards exist, clicking should navigate to deal detail
      cy.get('[data-cy^="deal-card-"]').then($cards => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).click()
          cy.url().should('include', '/opportunities/')
        }
      })
    })
  })
})
