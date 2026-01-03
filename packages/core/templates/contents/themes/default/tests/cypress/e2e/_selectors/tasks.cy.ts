/**
 * POC Test: Tasks Entity Selectors Validation
 *
 * This test validates that the new POM architecture with dynamic selectors
 * works correctly for entity CRUD operations.
 *
 * Purpose:
 * - Validate selectors from DashboardEntityPOM work correctly
 * - Ensure dynamic selector generation produces valid CSS selectors
 * - Test before migrating existing tests to new architecture
 *
 * Scope:
 * - Only login and navigate
 * - Assert elements exist in DOM (no full CRUD operations)
 */

import { TasksPOM } from '../../src/entities/TasksPOM'
import { loginAsDefaultOwner } from '../../src/session-helpers'

describe('Tasks Entity Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const tasks = TasksPOM.create()

  beforeEach(() => {
    loginAsDefaultOwner()
  })

  describe('List Page Selectors', () => {
    beforeEach(() => {
      tasks.visitList()
      tasks.waitForList()
    })

    it('should find table container element', () => {
      cy.get(tasks.selectors.tableContainer).should('exist')
    })

    // NOTE: entities.table.element selector not implemented in EntityTable component
    // The component uses {slug}-table-container on wrapper, not {slug}-table on <table>
    // Test removed as redundant with tableContainer test above

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

  describe('Detail Page Selectors', () => {
    it('should find detail page elements after navigating to a task', () => {
      // First get a task ID from the list
      tasks.visitList()
      tasks.waitForList()

      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('tasks-row-', '') || ''

          // Navigate to detail page
          tasks.visitDetail(id)
          tasks.waitForDetail()

          // Validate detail page selectors
          cy.get(tasks.selectors.viewHeader).should('exist')
          cy.get(tasks.selectors.editButton).should('exist')
          cy.get(tasks.selectors.deleteButton).should('exist')
          cy.get(tasks.selectors.backButton).should('exist')
        })
    })
  })

  describe('Bulk Actions Selectors', () => {
    beforeEach(() => {
      tasks.visitList()
      tasks.waitForList()
    })

    it('should show bulk bar after selecting rows', () => {
      // Select first row
      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('tasks-row-', '') || ''
          cy.get(tasks.selectors.rowSelect(id)).click()

          // Bulk bar should appear
          cy.get(tasks.selectors.bulkBar).should('be.visible')
          cy.get(tasks.selectors.bulkCount).should('exist')
          cy.get(tasks.selectors.bulkDelete).should('exist')
          cy.get(tasks.selectors.bulkClear).should('exist')
          // Note: bulkStatus not tested - enableChangeStatus not enabled in EntityListWrapper
        })
    })
  })

  describe('Delete Dialog Selectors', () => {
    it('should find delete dialog elements', () => {
      // Navigate to a task detail
      tasks.visitList()
      tasks.waitForList()

      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('tasks-row-', '') || ''

          tasks.visitDetail(id)
          tasks.waitForDetail()

          // Click delete to open dialog
          tasks.clickDelete()

          // Validate dialog selectors
          cy.get(tasks.selectors.deleteDialog).should('be.visible')
          cy.get(tasks.selectors.deleteConfirm).should('exist')
          cy.get(tasks.selectors.deleteCancel).should('exist')

          // Close without deleting
          tasks.cancelDelete()
        })
    })
  })
})
