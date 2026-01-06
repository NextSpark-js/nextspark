/// <reference types="cypress" />

/**
 * Kanban Cards - Owner Role Tests
 *
 * Tests for managing cards within Kanban columns.
 * All selectors follow the pattern: cards-{component}-{detail}
 *
 * @see test/cypress/src/classes/themes/productivity/components/KanbanPOM.ts
 */

import { KanbanPOM } from '../../../src/components/KanbanPOM'
import { BoardsPOM } from '../../../src/components/BoardsPOM'
import { loginAsProductivityOwner } from '../../../src/session-helpers'

describe('Kanban Cards - Owner Role', () => {
  let testBoardId: string
  let testColumnId: string

  before(() => {
    // Create a board and column for all card tests
    loginAsProductivityOwner()
    BoardsPOM.visitList()
    BoardsPOM.waitForListLoad()

    const timestamp = Date.now()
    const boardName = `Cards Test Board ${timestamp}`

    BoardsPOM.clickCreate()
    BoardsPOM.waitForFormLoad()
    BoardsPOM.fillName(boardName)
    BoardsPOM.submitForm()

    // Extract board ID from URL
    cy.url().then((url) => {
      const match = url.match(/\/boards\/([a-z0-9_-]+)/)
      if (match) {
        testBoardId = match[1]

        // Create a test column
        KanbanPOM.waitForBoardLoad()
        KanbanPOM.createColumn(`Test Column ${timestamp}`)
        cy.wait(500)

        // Get column ID
        cy.get('[data-cy^="lists-column-"]').first().then(($column) => {
          const dataCy = $column.attr('data-cy')
          if (dataCy) {
            testColumnId = dataCy.replace('lists-column-', '')
          }
        })
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

  describe('CREATE - Add new cards', () => {
    it('KANBAN_CARDS_CREATE_001: should add a new card to column', () => {
      const timestamp = Date.now()
      const cardTitle = `New Card ${timestamp}`

      cy.then(() => {
        // Click add card button in the column
        KanbanPOM.clickAddCard(testColumnId)

        // Fill card title
        KanbanPOM.fillCardTitle(testColumnId, cardTitle)

        // Submit
        KanbanPOM.submitAddCard(testColumnId)

        // Wait for card creation
        cy.wait(500)

        // Verify card was created
        cy.contains(cardTitle).should('be.visible')
      })

      cy.log('✅ Created new card successfully')
    })

    it('KANBAN_CARDS_CREATE_002: should create multiple cards in a column', () => {
      const timestamp = Date.now()
      const cards = ['Task 1', 'Task 2', 'Task 3'].map((name) => `${name} ${timestamp}`)

      cy.then(() => {
        // Create each card
        cards.forEach((cardTitle) => {
          KanbanPOM.clickAddCard(testColumnId)
          KanbanPOM.fillCardTitle(testColumnId, cardTitle)
          KanbanPOM.submitAddCard(testColumnId)
          cy.wait(500)
        })

        // Verify all cards exist
        cards.forEach((cardTitle) => {
          cy.contains(cardTitle).should('be.visible')
        })
      })

      cy.log('✅ Created multiple cards successfully')
    })

    it('KANBAN_CARDS_CREATE_003: should cancel card creation with Escape', () => {
      const timestamp = Date.now()
      const cardTitle = `Cancelled Card ${timestamp}`

      cy.then(() => {
        // Click add card button
        KanbanPOM.clickAddCard(testColumnId)

        // Fill card title
        KanbanPOM.fillCardTitle(testColumnId, cardTitle)

        // Press Escape to cancel
        cy.get(KanbanPOM.selectors.cardFieldTitle(testColumnId)).type('{esc}')

        // Wait a moment
        cy.wait(500)

        // Card should not exist
        cy.contains(cardTitle).should('not.exist')
      })

      cy.log('✅ Card creation cancelled successfully')
    })

    it('KANBAN_CARDS_CREATE_004: should create card with Enter key', () => {
      const timestamp = Date.now()
      const cardTitle = `Enter Card ${timestamp}`

      cy.then(() => {
        // Click add card button
        KanbanPOM.clickAddCard(testColumnId)

        // Fill card title and press Enter
        cy.get(KanbanPOM.selectors.cardFieldTitle(testColumnId)).type(`${cardTitle}{enter}`)

        // Wait for card creation
        cy.wait(500)

        // Verify card was created
        cy.contains(cardTitle).should('be.visible')
      })

      cy.log('✅ Created card with Enter key successfully')
    })
  })

  describe('READ - View cards', () => {
    it('KANBAN_CARDS_READ_001: should display cards in column', () => {
      // Create a test card first
      const timestamp = Date.now()
      const cardTitle = `Read Test Card ${timestamp}`

      cy.then(() => {
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Verify card is visible
        cy.contains(cardTitle).should('be.visible')

        // Verify card has proper data-cy attribute
        cy.get('[data-cy^="cards-item-"]').should('have.length.at.least', 1)
      })

      cy.log('✅ Cards display correctly in column')
    })

    it('KANBAN_CARDS_READ_002: should click card to open modal', () => {
      // Create a test card first
      const timestamp = Date.now()
      const cardTitle = `Click Test Card ${timestamp}`

      cy.then(() => {
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Get the card and click it
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()

        // Modal should open
        cy.get('[data-cy="cards-modal"]').should('be.visible')

        // Close modal
        cy.get('[data-cy="cards-modal-cancel"]').click()
      })

      cy.log('✅ Card click opens modal')
    })
  })

  describe('UPDATE - Modify cards via modal', () => {
    it('KANBAN_CARDS_UPDATE_001: should update card title', () => {
      const timestamp = Date.now()
      const originalTitle = `Original Title ${timestamp}`
      const updatedTitle = `Updated Title ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, originalTitle)
        cy.wait(500)

        // Click card to open modal
        cy.contains('[data-cy^="cards-item-"]', originalTitle).click()

        // Wait for modal
        cy.get('[data-cy="cards-modal"]').should('be.visible')

        // Update title
        cy.get('[data-cy="cards-modal-title"]').clear().type(updatedTitle)

        // Save
        cy.get('[data-cy="cards-modal-save"]').click()

        // Wait for save
        cy.wait(500)

        // Verify title updated
        cy.contains(updatedTitle).should('be.visible')
        cy.contains(originalTitle).should('not.exist')
      })

      cy.log('✅ Card title updated successfully')
    })
  })

  describe('DELETE - Remove cards', () => {
    it('KANBAN_CARDS_DELETE_001: should delete card from modal', () => {
      const timestamp = Date.now()
      const cardTitle = `Delete Test Card ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Click card to open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()

        // Wait for modal
        cy.get('[data-cy="cards-modal"]').should('be.visible')

        // Set up confirmation handler
        cy.on('window:confirm', () => true)

        // Click delete
        cy.get('[data-cy="cards-modal-delete"]').click()

        // Wait for deletion
        cy.wait(500)

        // Verify card is gone
        cy.contains(cardTitle).should('not.exist')
      })

      cy.log('✅ Card deleted successfully')
    })
  })
})
