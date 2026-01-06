/// <reference types="cypress" />

/**
 * Kanban Columns (Lists) - Owner Role Tests
 *
 * Tests for managing columns/lists on the Kanban board.
 * All selectors follow the pattern: lists-{component}-{detail}
 *
 * @see test/cypress/src/classes/themes/productivity/components/KanbanPOM.ts
 */

import { KanbanPOM } from '../../../src/components/KanbanPOM'
import { BoardsPOM } from '../../../src/components/BoardsPOM'
import { loginAsProductivityOwner } from '../../../src/session-helpers'

describe('Kanban Columns (Lists) - Owner Role', () => {
  let testBoardId: string

  before(() => {
    // Create a board for all kanban tests
    loginAsProductivityOwner()
    BoardsPOM.visitList()
    BoardsPOM.waitForListLoad()

    const timestamp = Date.now()
    const boardName = `Kanban Test Board ${timestamp}`

    BoardsPOM.clickCreate()
    BoardsPOM.waitForFormLoad()
    BoardsPOM.fillName(boardName)
    BoardsPOM.submitForm()

    // Extract board ID from URL
    cy.url().then((url) => {
      const match = url.match(/\/boards\/([a-z0-9_-]+)/)
      if (match) {
        testBoardId = match[1]
      }
    })
  })

  beforeEach(() => {
    loginAsProductivityOwner()
    cy.then(() => {
      KanbanPOM.visitBoard(testBoardId)
      KanbanPOM.waitForBoardLoad()
    })
  })

  after(() => {
    // Cleanup: Delete the test board
    loginAsProductivityOwner()
    cy.then(() => {
      if (testBoardId) {
        BoardsPOM.visitEdit(testBoardId)
        BoardsPOM.waitForFormLoad()
        BoardsPOM.confirmDelete()
        BoardsPOM.deleteFromEdit()
      }
    })
  })

  describe('CREATE - Add new columns', () => {
    it('KANBAN_COLUMNS_CREATE_001: should add a new column with name', () => {
      const timestamp = Date.now()
      const columnName = `New Column ${timestamp}`

      // Click add column button
      KanbanPOM.clickAddColumn()

      // Fill column name
      KanbanPOM.fillColumnName(columnName)

      // Submit
      KanbanPOM.submitAddColumn()

      // Verify column was created
      KanbanPOM.assertBoardContains(columnName)

      cy.log('✅ Created new column successfully')
    })

    it('KANBAN_COLUMNS_CREATE_002: should create multiple columns', () => {
      const timestamp = Date.now()
      const columns = ['To Do', 'In Progress', 'Done'].map((name) => `${name} ${timestamp}`)

      // Create each column
      columns.forEach((columnName) => {
        KanbanPOM.clickAddColumn()
        KanbanPOM.fillColumnName(columnName)
        KanbanPOM.submitAddColumn()
        cy.wait(500) // Wait for creation to complete
      })

      // Verify all columns exist
      columns.forEach((columnName) => {
        KanbanPOM.assertBoardContains(columnName)
      })

      cy.log('✅ Created multiple columns successfully')
    })

    it('KANBAN_COLUMNS_CREATE_003: should cancel column creation', () => {
      const timestamp = Date.now()
      const columnName = `Cancelled Column ${timestamp}`

      // Click add column button
      KanbanPOM.clickAddColumn()

      // Fill column name
      KanbanPOM.fillColumnName(columnName)

      // Press Escape to cancel
      cy.get(KanbanPOM.selectors.columnFieldName).type('{esc}')

      // Wait a moment
      cy.wait(500)

      // Column should not exist
      cy.contains(columnName).should('not.exist')

      cy.log('✅ Column creation cancelled successfully')
    })
  })

  describe('READ - View columns', () => {
    it('KANBAN_COLUMNS_READ_001: should display all columns', () => {
      // Board should be visible
      KanbanPOM.validateBoardVisible()

      // Should have at least the add column button
      cy.get(KanbanPOM.selectors.addColumn).should('be.visible')

      cy.log('✅ Kanban board displays correctly')
    })

    it('KANBAN_COLUMNS_READ_002: should show column card count', () => {
      // Check if columns have card counts displayed
      cy.get('[data-cy^="lists-column-"]').first().then(($column) => {
        // The column header should show count
        cy.wrap($column).find('.text-xs').should('exist')
      })

      cy.log('✅ Column card counts are visible')
    })
  })

  describe('UPDATE - Rename columns', () => {
    let testColumnId: string

    beforeEach(() => {
      // Create a column to update
      const timestamp = Date.now()
      const columnName = `Update Test ${timestamp}`

      KanbanPOM.createColumn(columnName)
      cy.wait(500)

      // Get the column ID
      cy.contains('[data-cy^="lists-column-"]', columnName).then(($column) => {
        const dataCy = $column.attr('data-cy')
        if (dataCy) {
          testColumnId = dataCy.replace('lists-column-', '')
        }
      })
    })

    it('KANBAN_COLUMNS_UPDATE_001: should rename column by clicking title', () => {
      const updatedName = `Renamed Column ${Date.now()}`

      cy.then(() => {
        // Click on column title to edit
        KanbanPOM.clickColumnTitle(testColumnId)

        // Wait for input to appear
        cy.wait(300)

        // Type new name and submit
        cy.get('input').last().clear().type(`${updatedName}{enter}`)

        // Verify name changed
        cy.wait(500)
        cy.contains(updatedName).should('be.visible')
      })

      cy.log('✅ Column renamed successfully')
    })

    it('KANBAN_COLUMNS_UPDATE_002: should rename column via menu', () => {
      const updatedName = `Menu Renamed ${Date.now()}`

      cy.then(() => {
        // Open column menu
        KanbanPOM.openColumnMenu(testColumnId)

        // Click rename option
        cy.get('[role="menuitem"]').contains('Rename').click()

        // Wait for input to appear
        cy.wait(300)

        // Type new name and submit
        cy.get('input').last().clear().type(`${updatedName}{enter}`)

        // Verify name changed
        cy.wait(500)
        cy.contains(updatedName).should('be.visible')
      })

      cy.log('✅ Column renamed via menu successfully')
    })
  })

  describe('DELETE - Remove columns', () => {
    it('KANBAN_COLUMNS_DELETE_001: should delete column via menu', () => {
      // Create a column to delete
      const timestamp = Date.now()
      const columnName = `Delete Test ${timestamp}`

      KanbanPOM.createColumn(columnName)
      cy.wait(500)

      // Get the column ID
      cy.contains('[data-cy^="lists-column-"]', columnName).then(($column) => {
        const dataCy = $column.attr('data-cy')
        if (dataCy) {
          const columnId = dataCy.replace('lists-column-', '')

          // Delete the column
          KanbanPOM.clickColumnDelete(columnId)

          // Wait for deletion
          cy.wait(500)

          // Verify column is gone
          cy.contains(columnName).should('not.exist')
        }
      })

      cy.log('✅ Column deleted successfully')
    })
  })
})
