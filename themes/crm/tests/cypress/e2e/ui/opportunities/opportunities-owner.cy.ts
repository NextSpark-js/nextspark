/// <reference types="cypress" />

/**
 * Opportunities CRUD - Owner Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { OpportunitiesPOM } from '../../../src/entities/OpportunitiesPOM'
import { loginAsCrmOwner } from '../../../src/session-helpers'

describe('Opportunities CRUD - Owner Role (Full Access)', () => {
  const opportunities = new OpportunitiesPOM()

  beforeEach(() => {
    loginAsCrmOwner()
    cy.visit('/dashboard/opportunities')
    opportunities.list.validatePageVisible()
  })

  describe('CREATE - Owner can create opportunities', () => {
    it('OWNER_OPPO_CREATE_001: should create new opportunity with required fields', () => {
      const timestamp = Date.now()
      const opportunityName = `Test Opportunity ${timestamp}`

      opportunities.list.clickCreate()
      opportunities.form.validateFormVisible()

      opportunities.fillOpportunityForm({
        name: opportunityName,
        amount: '50000'
      })

      opportunities.submitForm()

      cy.url().should('include', '/dashboard/opportunities')
      cy.contains(opportunityName).should('be.visible')
    })

    it('OWNER_OPPO_CREATE_002: should create opportunity with all fields', () => {
      const timestamp = Date.now()
      const opportunityName = `Complete Opportunity ${timestamp}`

      opportunities.list.clickCreate()
      opportunities.form.validateFormVisible()

      opportunities.fillOpportunityForm({
        name: opportunityName,
        amount: '75000',
        probability: '60'
      })

      opportunities.submitForm()

      cy.url().should('include', '/dashboard/opportunities')
      cy.contains(opportunityName).should('be.visible')
    })

    it('OWNER_OPPO_CREATE_003: should validate required fields', () => {
      opportunities.list.clickCreate()
      opportunities.form.validateFormVisible()

      // Try to submit without filling required fields
      opportunities.submitForm()

      // Should remain on form page due to validation errors
      opportunities.form.validateFormVisible()
    })
  })

  describe('READ - Owner can read opportunities', () => {
    it('OWNER_OPPO_READ_001: should view opportunity list', () => {
      opportunities.list.validatePageVisible()
      opportunities.list.validateTableVisible()
    })

    it('OWNER_OPPO_READ_002: should view opportunity details', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/opportunities\/[a-z0-9-]+/)
        }
      })
    })

    it('OWNER_OPPO_READ_003: should search opportunities', () => {
      opportunities.list.search('test')
      cy.wait(500)
      opportunities.list.clearSearch()
    })
  })

  describe('UPDATE - Owner can update opportunities', () => {
    it('OWNER_OPPO_UPDATE_001: should edit opportunity name', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const opportunityId = url.split('/').pop()
            opportunities.form.visitEdit(opportunityId!)
            opportunities.form.validateFormVisible()

            const updatedName = `Updated Opportunity ${Date.now()}`
            opportunities.form.typeInField('name', updatedName)

            opportunities.submitForm()

            cy.url().should('include', '/dashboard/opportunities')
            cy.contains(updatedName).should('be.visible')
          })
        }
      })
    })

    it('OWNER_OPPO_UPDATE_002: should update opportunity value', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const opportunityId = url.split('/').pop()
            opportunities.form.visitEdit(opportunityId!)
            opportunities.form.validateFormVisible()

            opportunities.form.typeInField('amount', '100000')

            opportunities.submitForm()
            cy.url().should('include', '/dashboard/opportunities')
          })
        }
      })
    })

    it('OWNER_OPPO_UPDATE_003: should cancel update without saving', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const opportunityId = url.split('/').pop()
            opportunities.form.visitEdit(opportunityId!)
            opportunities.form.validateFormVisible()

            opportunities.form.typeInField('name', 'ShouldNotSave')

            opportunities.form.cancel()
            cy.url().should('not.include', '/edit')
          })
        }
      })
    })
  })

  describe('DELETE - Owner can delete opportunities', () => {
    it('OWNER_OPPO_DELETE_001: should delete opportunity successfully', () => {
      const timestamp = Date.now()
      const opportunityName = `Delete Test ${timestamp}`

      opportunities.list.clickCreate()
      opportunities.fillOpportunityForm({
        name: opportunityName,
        amount: '25000'
      })
      opportunities.submitForm()

      cy.contains(opportunityName).should('be.visible')

      opportunities.list.search(opportunityName)

      cy.get(opportunities.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      opportunities.list.confirmDelete()

      cy.wait(1000)
      opportunities.list.search(opportunityName)
      cy.get(opportunities.list.selectors.emptyState).should('be.visible')
    })

    it('OWNER_OPPO_DELETE_002: should cancel deletion', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(opportunities.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').click()
          })

          opportunities.list.cancelDelete()
          opportunities.list.validateTableVisible()
        }
      })
    })
  })
})
