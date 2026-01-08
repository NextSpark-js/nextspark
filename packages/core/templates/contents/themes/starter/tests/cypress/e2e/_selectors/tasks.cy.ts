/**
 * UI Selectors Validation: Tasks Entity
 *
 * This test validates that Tasks entity selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate TasksPOM selectors work correctly
 * - Ensure dynamic selector generation produces valid CSS selectors
 * - Catch missing data-cy attributes early
 *
 * Scope:
 * - Login and navigate to tasks pages
 * - Assert elements exist in DOM (no full CRUD operations)
 * - Fast execution (< 30 seconds)
 */

import { TasksPOM } from '../tasks/TasksPOM'

describe('Tasks Entity Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const tasks = TasksPOM.create()

  beforeEach(() => {
    // Login as owner before each test
    cy.loginAsOwner()
  })

  // ============================================
  // LIST PAGE SELECTORS
  // ============================================
  describe('List Page Selectors', () => {
    beforeEach(() => {
      tasks.visitList()
      tasks.waitForList()
    })

    it('should find table container element', () => {
      cy.get(tasks.selectors.tableContainer).should('exist')
    })

    it('should find add button', () => {
      cy.get(tasks.selectors.addButton).should('exist')
    })

    it('should find search input', () => {
      cy.get(tasks.selectors.search).should('exist')
    })

    it('should find search container', () => {
      cy.get(tasks.selectors.searchContainer).should('exist')
    })

    it('should find select all checkbox', () => {
      cy.get(tasks.selectors.selectAll).should('exist')
    })

    it('should find pagination container', () => {
      cy.get(tasks.selectors.pagination).should('exist')
    })

    it('should find pagination controls', () => {
      cy.get(tasks.selectors.pageFirst).should('exist')
      cy.get(tasks.selectors.pagePrev).should('exist')
      cy.get(tasks.selectors.pageNext).should('exist')
      cy.get(tasks.selectors.pageLast).should('exist')
    })

    it('should find page size selector', () => {
      cy.get(tasks.selectors.pageSize).should('exist')
    })

    it('should find page info', () => {
      cy.get(tasks.selectors.pageInfo).should('exist')
    })

    it('should find at least one row with dynamic selector', () => {
      cy.get(tasks.selectors.rowGeneric).should('have.length.at.least', 1)
    })
  })

  // ============================================
  // FILTER SELECTORS
  // ============================================
  describe('Filter Selectors', () => {
    beforeEach(() => {
      tasks.visitList()
      tasks.waitForList()
    })

    it('should find status filter trigger', () => {
      cy.get(tasks.selectors.filterTrigger('status')).should('exist')
    })

    it('should find priority filter trigger', () => {
      cy.get(tasks.selectors.filterTrigger('priority')).should('exist')
    })

    it('should find filter options when opened', () => {
      tasks.openFilter('status')
      cy.get(tasks.selectors.filterContent('status')).should('be.visible')
    })
  })

  // ============================================
  // ROW DYNAMIC SELECTORS
  // ============================================
  describe('Row Dynamic Selectors', () => {
    beforeEach(() => {
      tasks.visitList()
      tasks.waitForList()
    })

    it('should find row elements with dynamic ID', () => {
      // Get any row and extract its ID to test dynamic selectors
      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          // Extract ID from data-cy="tasks-row-{id}"
          const id = dataCy?.replace('tasks-row-', '') || ''
          expect(id).to.not.be.empty

          // Test dynamic selector functions work
          cy.get(tasks.selectors.row(id)).should('exist')
          cy.get(tasks.selectors.rowSelect(id)).should('exist')
          cy.get(tasks.selectors.rowMenu(id)).should('exist')
        })
    })
  })

  // ============================================
  // CREATE PAGE SELECTORS
  // ============================================
  describe('Create Page Selectors', () => {
    beforeEach(() => {
      tasks.visitCreate()
      tasks.waitForForm()
    })

    it('should find form container', () => {
      cy.get(tasks.selectors.form).should('exist')
    })

    it('should find submit button', () => {
      cy.get(tasks.selectors.submitButton).should('exist')
    })

    it('should find create header', () => {
      cy.get(tasks.selectors.createHeader).should('exist')
    })

    it('should find back button', () => {
      cy.get(tasks.selectors.backButton).should('exist')
    })

    it('should find title field', () => {
      cy.get(tasks.selectors.field('title')).should('exist')
    })

    it('should find description field', () => {
      cy.get(tasks.selectors.field('description')).should('exist')
    })

    it('should find status field', () => {
      cy.get(tasks.selectors.field('status')).should('exist')
    })

    it('should find priority field', () => {
      cy.get(tasks.selectors.field('priority')).should('exist')
    })
  })

  // ============================================
  // EDIT PAGE SELECTORS
  // ============================================
  describe('Edit Page Selectors', () => {
    let testTaskId: string

    beforeEach(() => {
      // Create a task to edit
      cy.createTask({
        title: `Edit Test ${Date.now()}`,
        status: 'todo',
        priority: 'medium'
      }).then((response) => {
        if (response.status === 201) {
          testTaskId = response.body.data.id
          tasks.visitEdit(testTaskId)
          tasks.waitForForm()
        }
      })
    })

    afterEach(() => {
      // Clean up
      if (testTaskId) {
        cy.window().then((win) => {
          const teamId = win.localStorage.getItem('activeTeamId')
          cy.request({
            method: 'DELETE',
            url: `/api/v1/tasks/${testTaskId}`,
            headers: { 'x-team-id': teamId || '' },
            failOnStatusCode: false
          })
        })
      }
    })

    it('should find form container', () => {
      cy.get(tasks.selectors.form).should('exist')
    })

    it('should find edit header', () => {
      cy.get(tasks.selectors.editHeader).should('exist')
    })

    it('should find submit button', () => {
      cy.get(tasks.selectors.submitButton).should('exist')
    })
  })

  // ============================================
  // DETAIL PAGE SELECTORS
  // ============================================
  describe('Detail Page Selectors', () => {
    let testTaskId: string

    beforeEach(() => {
      // Create a task to view
      cy.createTask({
        title: `Detail Test ${Date.now()}`,
        status: 'todo',
        priority: 'medium'
      }).then((response) => {
        if (response.status === 201) {
          testTaskId = response.body.data.id
          tasks.visitDetail(testTaskId)
          tasks.waitForDetail()
        }
      })
    })

    afterEach(() => {
      // Clean up
      if (testTaskId) {
        cy.window().then((win) => {
          const teamId = win.localStorage.getItem('activeTeamId')
          cy.request({
            method: 'DELETE',
            url: `/api/v1/tasks/${testTaskId}`,
            headers: { 'x-team-id': teamId || '' },
            failOnStatusCode: false
          })
        })
      }
    })

    it('should find detail container', () => {
      cy.get(tasks.selectors.detailContainer).should('exist')
    })

    it('should find detail header', () => {
      cy.get(tasks.selectors.detailHeader).should('exist')
    })

    it('should find edit button', () => {
      cy.get(tasks.selectors.editButton).should('exist')
    })

    it('should find delete button', () => {
      cy.get(tasks.selectors.deleteButton).should('exist')
    })
  })
})
