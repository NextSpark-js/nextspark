/// <reference types="cypress" />

/**
 * Leads CRUD - Owner Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { LeadsPOM } from '../../../../src/entities/LeadsPOM'
import { loginAsCrmOwner } from '../../../../src/session-helpers'

describe('Leads CRUD - Owner Role (Full Access)', () => {
  const leads = new LeadsPOM()

  beforeEach(() => {
    loginAsCrmOwner()
    cy.visit('/dashboard/leads')
    leads.list.validatePageVisible()
  })

  describe('CREATE - Owner can create leads', () => {
    it('OWNER_LEAD_CREATE_001: should create new lead with required fields', () => {
      const timestamp = Date.now()
      const firstName = `Test`
      const lastName = `Lead ${timestamp}`
      const email = `lead${timestamp}@example.com`

      leads.list.clickCreate()
      leads.form.validateFormVisible()

      leads.fillLeadForm({
        firstName,
        lastName,
        email,
        status: 'new'
      })

      leads.submitForm()

      cy.url().should('include', '/dashboard/leads')
      cy.contains(lastName).should('be.visible')
    })

    it('OWNER_LEAD_CREATE_002: should create lead with optional fields', () => {
      const timestamp = Date.now()
      const firstName = `Complete`
      const lastName = `Lead ${timestamp}`
      const email = `complete${timestamp}@example.com`

      leads.list.clickCreate()
      leads.form.validateFormVisible()

      leads.fillLeadForm({
        firstName,
        lastName,
        email,
        phone: '+1 555 123 4567',
        company: 'Test Company Inc',
        source: 'website',
        status: 'new'
      })

      leads.submitForm()

      cy.url().should('include', '/dashboard/leads')
      cy.contains(lastName).should('be.visible')
    })

    it('OWNER_LEAD_CREATE_003: should validate required fields', () => {
      leads.list.clickCreate()
      leads.form.validateFormVisible()

      // Try to submit without filling required fields
      leads.submitForm()

      // Form should still be visible (validation failed)
      leads.form.validateFormVisible()
    })
  })

  describe('READ - Owner can read leads', () => {
    it('OWNER_LEAD_READ_001: should view lead list', () => {
      leads.list.validatePageVisible()
      leads.list.validateTableVisible()
    })

    it('OWNER_LEAD_READ_002: should view lead details', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/leads\/[a-z0-9-]+/)
        }
      })
    })

    it('OWNER_LEAD_READ_003: should search and filter leads', () => {
      leads.list.search('test')
      cy.wait(500)
      leads.list.clearSearch()
    })
  })

  describe('UPDATE - Owner can update leads', () => {
    it('OWNER_LEAD_UPDATE_001: should edit lead basic information', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()
            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            const updatedLastName = `Updated Lead ${Date.now()}`
            leads.form.typeInField('lastName', updatedLastName)

            leads.submitForm()

            cy.url().should('include', '/dashboard/leads')
            cy.contains(updatedLastName).should('be.visible')
          })
        }
      })
    })

    it('OWNER_LEAD_UPDATE_002: should update lead status', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()
            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            leads.form.selectOption('status', 'contacted')

            leads.submitForm()
            cy.url().should('include', '/dashboard/leads')
          })
        }
      })
    })

    it('OWNER_LEAD_UPDATE_003: should cancel update without saving', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()
            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            leads.form.typeInField('lastName', 'ShouldNotSave')

            leads.form.cancel()
            cy.url().should('not.include', '/edit')
          })
        }
      })
    })
  })

  describe('DELETE - Owner can delete leads', () => {
    it('OWNER_LEAD_DELETE_001: should delete lead', () => {
      const timestamp = Date.now()
      const firstName = `Delete`
      const lastName = `Test ${timestamp}`
      const email = `delete${timestamp}@example.com`

      leads.list.clickCreate()
      leads.fillLeadForm({
        firstName,
        lastName,
        email,
        status: 'new'
      })
      leads.submitForm()

      cy.contains(lastName).should('be.visible')

      leads.list.search(lastName)

      cy.get(leads.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      leads.list.confirmDelete()

      cy.wait(1000)
      leads.list.search(lastName)
      cy.get(leads.list.selectors.emptyState).should('be.visible')
    })

    it('OWNER_LEAD_DELETE_002: should cancel deletion', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(leads.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').click()
          })

          leads.list.cancelDelete()
          leads.list.validateTableVisible()
        }
      })
    })
  })
})
