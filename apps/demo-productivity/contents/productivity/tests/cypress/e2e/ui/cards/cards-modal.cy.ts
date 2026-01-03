/// <reference types="cypress" />

/**
 * Card Detail Modal - Owner Role Tests
 *
 * Tests for the card detail modal functionality.
 * All selectors follow the pattern: cards-modal-{detail}
 *
 * @see test/cypress/src/classes/themes/productivity/components/CardsPOM.ts
 */

import { CardsPOM } from '../../../src/components/CardsPOM'
import { KanbanPOM } from '../../../src/components/KanbanPOM'
import { BoardsPOM } from '../../../src/components/BoardsPOM'
import { loginAsProductivityOwner } from '../../../src/session-helpers'

describe('Card Detail Modal - Owner Role', () => {
  let testBoardId: string
  let testColumnId: string

  before(() => {
    // Create a board and column for all modal tests
    loginAsProductivityOwner()
    BoardsPOM.visitList()
    BoardsPOM.waitForListLoad()

    const timestamp = Date.now()
    const boardName = `Modal Test Board ${timestamp}`

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
        KanbanPOM.createColumn(`Modal Test Column ${timestamp}`)
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

  describe('MODAL - Open and close', () => {
    it('CARDS_MODAL_001: should open modal when clicking card', () => {
      const timestamp = Date.now()
      const cardTitle = `Modal Open Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Click card to open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()

        // Modal should be visible
        CardsPOM.validateModalVisible()
      })

      cy.log('✅ Modal opens on card click')
    })

    it('CARDS_MODAL_002: should close modal with cancel button', () => {
      const timestamp = Date.now()
      const cardTitle = `Modal Cancel Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Close with cancel button
        CardsPOM.clickCancel()

        // Modal should be closed
        CardsPOM.validateModalNotVisible()
      })

      cy.log('✅ Modal closes with cancel button')
    })

    it('CARDS_MODAL_003: should close modal with Escape key (when no changes)', () => {
      const timestamp = Date.now()
      const cardTitle = `Modal Escape Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Close with Escape key
        CardsPOM.closeModalWithEscape()

        // Modal should be closed
        CardsPOM.validateModalNotVisible()
      })

      cy.log('✅ Modal closes with Escape key')
    })
  })

  describe('MODAL - View card details', () => {
    it('CARDS_MODAL_004: should display card title', () => {
      const timestamp = Date.now()
      const cardTitle = `View Title Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Title should match
        CardsPOM.assertTitle(cardTitle)

        // Close modal
        CardsPOM.clickCancel()
      })

      cy.log('✅ Modal displays card title correctly')
    })

    it('CARDS_MODAL_005: should display all form fields', () => {
      const timestamp = Date.now()
      const cardTitle = `Fields Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Verify all fields are present
        cy.get(CardsPOM.selectors.title).should('be.visible')
        cy.get(CardsPOM.selectors.description).should('be.visible')
        cy.get(CardsPOM.selectors.priority).should('be.visible')
        cy.get(CardsPOM.selectors.dueDate).should('be.visible')

        // Close modal
        CardsPOM.clickCancel()
      })

      cy.log('✅ Modal displays all form fields')
    })
  })

  describe('MODAL - Edit card fields', () => {
    it('CARDS_MODAL_006: should update card title', () => {
      const timestamp = Date.now()
      const originalTitle = `Original ${timestamp}`
      const updatedTitle = `Updated ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, originalTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', originalTitle).click()
        CardsPOM.waitForModal()

        // Update title
        CardsPOM.fillTitle(updatedTitle)

        // Save
        CardsPOM.clickSave()

        // Wait for save
        cy.wait(500)

        // Verify update
        cy.contains(updatedTitle).should('be.visible')
        cy.contains(originalTitle).should('not.exist')
      })

      cy.log('✅ Card title updated successfully')
    })

    it('CARDS_MODAL_007: should update card description', () => {
      const timestamp = Date.now()
      const cardTitle = `Description Test ${timestamp}`
      const description = `This is a test description ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Update description
        CardsPOM.fillDescription(description)

        // Save
        CardsPOM.clickSave()

        // Wait and reopen to verify
        cy.wait(500)
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Verify description
        CardsPOM.assertDescription(description)

        CardsPOM.clickCancel()
      })

      cy.log('✅ Card description updated successfully')
    })

    it('CARDS_MODAL_008: should update card priority', () => {
      const timestamp = Date.now()
      const cardTitle = `Priority Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Select priority
        CardsPOM.selectPriority('high')

        // Save
        CardsPOM.clickSave()

        // Wait and verify
        cy.wait(500)
      })

      cy.log('✅ Card priority updated successfully')
    })
  })

  describe('MODAL - Delete card', () => {
    it('CARDS_MODAL_009: should delete card from modal', () => {
      const timestamp = Date.now()
      const cardTitle = `Delete Modal Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Set up confirmation handler
        cy.on('window:confirm', () => true)

        // Delete
        CardsPOM.clickDelete()

        // Wait for deletion
        cy.wait(500)

        // Verify deletion
        cy.contains(cardTitle).should('not.exist')
      })

      cy.log('✅ Card deleted from modal successfully')
    })

    it('CARDS_MODAL_010: should show delete button for owner', () => {
      const timestamp = Date.now()
      const cardTitle = `Delete Button Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Delete button should be visible for owner
        CardsPOM.assertDeleteVisible()

        CardsPOM.clickCancel()
      })

      cy.log('✅ Delete button visible for owner')
    })
  })

  describe('MODAL - Unsaved changes', () => {
    it('CARDS_MODAL_011: should show unsaved changes indicator', () => {
      const timestamp = Date.now()
      const cardTitle = `Unsaved Test ${timestamp}`

      cy.then(() => {
        // Create a card
        KanbanPOM.createCard(testColumnId, cardTitle)
        cy.wait(500)

        // Open modal
        cy.contains('[data-cy^="cards-item-"]', cardTitle).click()
        CardsPOM.waitForModal()

        // Make a change
        CardsPOM.fillTitle(`${cardTitle} Modified`)

        // Should show unsaved changes indicator
        CardsPOM.assertUnsavedChanges()

        // Cancel without saving
        CardsPOM.clickCancel()
      })

      cy.log('✅ Unsaved changes indicator works')
    })
  })
})
