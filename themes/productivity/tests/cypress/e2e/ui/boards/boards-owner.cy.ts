/// <reference types="cypress" />

/**
 * Boards CRUD - Owner Role (Full Access)
 *
 * Tests for the productivity theme boards using the Entity Testing Convention.
 * All selectors follow the pattern: {slug}-{component}-{detail}
 *
 * @see test/cypress/src/classes/themes/productivity/components/BoardsPOM.ts
 */

import { BoardsPOM } from '../../../src/components/BoardsPOM'
import { loginAsProductivityOwner } from '../../../src/session-helpers'

describe('Boards CRUD - Owner Role (Full Access)', () => {
  beforeEach(() => {
    loginAsProductivityOwner()
    BoardsPOM.visitList()
    BoardsPOM.waitForListLoad()
  })

  describe('CREATE - Owner can create boards', () => {
    it('OWNER_BOARDS_CREATE_001: should create new board with required fields', () => {
      const timestamp = Date.now()
      const name = `Test Board ${timestamp}`
      const description = `Test description for board ${timestamp}`

      // Click create button
      BoardsPOM.clickCreate()

      // Validate form is visible
      BoardsPOM.waitForFormLoad()
      BoardsPOM.validateFormVisible()

      // Fill required board fields
      BoardsPOM.fillBoardForm({
        name,
        description,
      })

      // Submit form
      BoardsPOM.submitForm()

      // Should redirect to the new board's kanban view
      cy.url().should('match', /\/dashboard\/boards\/[a-z0-9_-]+$/)

      cy.log('✅ Owner created board successfully')
    })

    it('OWNER_BOARDS_CREATE_002: should create board with color', () => {
      const timestamp = Date.now()
      const name = `Colored Board ${timestamp}`

      // Click create button
      BoardsPOM.clickCreate()
      BoardsPOM.waitForFormLoad()

      // Fill fields with color selection
      BoardsPOM.fillBoardForm({
        name,
        color: 'purple',
      })

      // Submit form
      BoardsPOM.submitForm()

      // Should redirect to board
      cy.url().should('match', /\/dashboard\/boards\/[a-z0-9_-]+$/)

      cy.log('✅ Owner created board with color successfully')
    })

    it('OWNER_BOARDS_CREATE_003: should validate required fields', () => {
      // Click create button
      BoardsPOM.clickCreate()
      BoardsPOM.waitForFormLoad()

      // Try to submit without filling required fields
      BoardsPOM.submitForm()

      // Form should still be visible (validation failed)
      BoardsPOM.validateFormVisible()

      cy.log('✅ Form validation working correctly')
    })

    it('OWNER_BOARDS_CREATE_004: should cancel board creation', () => {
      const timestamp = Date.now()
      const name = `Cancelled Board ${timestamp}`

      // Click create button
      BoardsPOM.clickCreate()
      BoardsPOM.waitForFormLoad()

      // Fill some fields
      BoardsPOM.fillName(name)

      // Cancel form
      BoardsPOM.cancelForm()

      // Should return to list
      BoardsPOM.assertOnListPage()

      // Board should not exist
      BoardsPOM.assertBoardNotInList(name)

      cy.log('✅ Board creation cancelled successfully')
    })
  })

  describe('READ - Owner can view boards', () => {
    it('OWNER_BOARDS_READ_001: should view boards list page', () => {
      // Validate list page is visible
      BoardsPOM.validateListPageVisible()

      cy.log('✅ Owner can view boards list')
    })

    it('OWNER_BOARDS_READ_002: should see create button', () => {
      // Create button should be visible for owner
      cy.get(BoardsPOM.selectors.createBtn).should('be.visible')

      cy.log('✅ Create button is visible for owner')
    })

    it('OWNER_BOARDS_READ_003: should click on board to open it', () => {
      // Check if there are boards
      cy.get('body').then(($body) => {
        const boardCards = $body.find('[data-cy^="boards-card-"]')
        if (boardCards.length > 0) {
          // Click on first board card
          cy.get('[data-cy^="boards-card-"]').first().find('a').first().click()

          // Should navigate to board view
          cy.url().should('match', /\/dashboard\/boards\/[a-z0-9_-]+$/)

          cy.log('✅ Owner can open board')
        } else {
          cy.log('⚠️ No boards available to click')
        }
      })
    })
  })

  describe('UPDATE - Owner can update boards', () => {
    let testBoardId: string

    beforeEach(() => {
      // Create a board for update tests
      const timestamp = Date.now()
      const name = `Update Test ${timestamp}`

      BoardsPOM.clickCreate()
      BoardsPOM.waitForFormLoad()
      BoardsPOM.fillName(name)
      BoardsPOM.submitForm()

      // Get board ID from URL
      cy.url().then((url) => {
        const match = url.match(/\/boards\/([a-z0-9_-]+)/)
        if (match) {
          testBoardId = match[1]
        }
      })
    })

    it('OWNER_BOARDS_UPDATE_001: should edit board name', () => {
      const updatedName = `Updated Board ${Date.now()}`

      // Visit edit page
      cy.url().then((url) => {
        const match = url.match(/\/boards\/([a-z0-9_-]+)/)
        if (match) {
          const boardId = match[1]
          BoardsPOM.visitEdit(boardId)
          BoardsPOM.waitForFormLoad()

          // Update name
          BoardsPOM.fillName(updatedName)

          // Submit form
          BoardsPOM.submitForm()

          // Should redirect to board
          cy.url().should('include', `/dashboard/boards/${boardId}`)

          cy.log('✅ Owner updated board name successfully')
        }
      })
    })

    it('OWNER_BOARDS_UPDATE_002: should update board description', () => {
      const updatedDescription = `Updated description ${Date.now()}`

      cy.url().then((url) => {
        const match = url.match(/\/boards\/([a-z0-9_-]+)/)
        if (match) {
          const boardId = match[1]
          BoardsPOM.visitEdit(boardId)
          BoardsPOM.waitForFormLoad()

          // Update description
          BoardsPOM.fillDescription(updatedDescription)

          // Submit form
          BoardsPOM.submitForm()

          // Should redirect to board
          cy.url().should('include', `/dashboard/boards/${boardId}`)

          cy.log('✅ Owner updated board description successfully')
        }
      })
    })
  })

  describe('DELETE - Owner can delete boards', () => {
    it('OWNER_BOARDS_DELETE_001: should delete board from edit page', () => {
      // Create a board to delete
      const timestamp = Date.now()
      const name = `Delete Test ${timestamp}`

      BoardsPOM.clickCreate()
      BoardsPOM.waitForFormLoad()
      BoardsPOM.fillName(name)
      BoardsPOM.submitForm()

      // Get board ID and go to edit page
      cy.url().then((url) => {
        const match = url.match(/\/boards\/([a-z0-9_-]+)/)
        if (match) {
          const boardId = match[1]
          BoardsPOM.visitEdit(boardId)
          BoardsPOM.waitForFormLoad()

          // Confirm deletion
          BoardsPOM.confirmDelete()

          // Click delete button
          BoardsPOM.deleteFromEdit()

          // Should redirect to list
          BoardsPOM.waitForListLoad()
          BoardsPOM.assertOnListPage()

          // Board should not exist
          BoardsPOM.assertBoardNotInList(name)

          cy.log('✅ Owner deleted board successfully')
        }
      })
    })

    it('OWNER_BOARDS_DELETE_002: should delete board from list page menu', () => {
      // Create a board to delete
      const timestamp = Date.now()
      const name = `Delete Menu Test ${timestamp}`

      BoardsPOM.clickCreate()
      BoardsPOM.waitForFormLoad()
      BoardsPOM.fillName(name)
      BoardsPOM.submitForm()

      // Go back to list
      BoardsPOM.visitList()
      BoardsPOM.waitForListLoad()

      // Find the board and open its menu
      cy.get('body').then(($body) => {
        // Find the board card containing our name
        cy.contains('[data-cy^="boards-card-"]', name).then(($card) => {
          // Extract ID from data-cy attribute
          const dataCy = $card.attr('data-cy')
          if (dataCy) {
            const boardId = dataCy.replace('boards-card-', '')

            // Confirm deletion
            BoardsPOM.confirmDelete()

            // Click delete from menu
            BoardsPOM.clickCardDelete(boardId)

            // Board should no longer exist
            cy.contains('[data-cy^="boards-card-"]', name).should('not.exist')

            cy.log('✅ Owner deleted board from list menu')
          }
        })
      })
    })
  })

  describe('INTEGRATION - Complete board lifecycle', () => {
    it('OWNER_BOARDS_LIFECYCLE_001: should perform full CRUD lifecycle', () => {
      const timestamp = Date.now()
      const name = `Lifecycle Board ${timestamp}`
      const description = `Lifecycle test description ${timestamp}`
      const updatedName = `Updated Lifecycle ${timestamp}`

      // CREATE
      cy.log('🔄 Step 1: Create board')
      BoardsPOM.clickCreate()
      BoardsPOM.waitForFormLoad()
      BoardsPOM.fillBoardForm({ name, description })
      BoardsPOM.submitForm()

      // Get board ID
      cy.url().then((url) => {
        const match = url.match(/\/boards\/([a-z0-9_-]+)/)
        expect(match).to.not.be.null

        if (match) {
          const boardId = match[1]

          // READ
          cy.log('🔄 Step 2: Verify board was created')
          BoardsPOM.visitList()
          BoardsPOM.waitForListLoad()
          BoardsPOM.assertBoardInList(name)

          // UPDATE
          cy.log('🔄 Step 3: Update board')
          BoardsPOM.visitEdit(boardId)
          BoardsPOM.waitForFormLoad()
          BoardsPOM.fillName(updatedName)
          BoardsPOM.submitForm()

          // Verify update
          BoardsPOM.visitList()
          BoardsPOM.waitForListLoad()
          BoardsPOM.assertBoardInList(updatedName)

          // DELETE
          cy.log('🔄 Step 4: Delete board')
          BoardsPOM.visitEdit(boardId)
          BoardsPOM.waitForFormLoad()
          BoardsPOM.confirmDelete()
          BoardsPOM.deleteFromEdit()

          // Verify deletion
          BoardsPOM.waitForListLoad()
          BoardsPOM.assertBoardNotInList(updatedName)

          cy.log('✅ Full board lifecycle completed successfully')
        }
      })
    })
  })
})
