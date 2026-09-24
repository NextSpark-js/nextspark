/// <reference types="cypress" />

/**
 * Leads CRUD - Member Role (Create + Read + Update, No Delete)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { LeadsPOM } from '../../../../src/entities/LeadsPOM'
import { loginAsCrmMember } from '../../../../src/session-helpers'

describe('Leads CRUD - Member Role (Create + Read + Update)', () => {
  const leads = new LeadsPOM()

  beforeEach(() => {
    loginAsCrmMember()
    cy.visit('/dashboard/leads')
    leads.list.validatePageVisible()
  })

  describe('READ - Member CAN view leads', () => {
    it('MEMBER_LEAD_READ_001: should view lead list', () => {
      leads.list.validatePageVisible()
      leads.list.validateTableVisible()
    })

    it('MEMBER_LEAD_READ_002: should view lead details', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/leads\/[a-z0-9-]+/)
        }
      })
    })

    it('MEMBER_LEAD_READ_003: should search and filter leads', () => {
      leads.list.search('test')
      cy.wait(500)
      leads.list.clearSearch()
    })
  })

  describe('UPDATE - Member CAN edit leads', () => {
    it('MEMBER_LEAD_UPDATE_001: should edit existing lead', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()
            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            // Verify fields are enabled (Member can edit)
            cy.get(leads.form.selectors.field('firstName')).within(() => {
              cy.get('input, textarea').should('not.be.disabled')
            })
          })
        }
      })
    })

    it('MEMBER_LEAD_UPDATE_002: should update lead status after contact', () => {
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

    it('MEMBER_LEAD_UPDATE_003: should add notes to lead', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()
            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            // Add notes if field exists
            cy.get('body').then($body => {
              if ($body.find(leads.form.selectors.field('notes')).length > 0) {
                const timestamp = new Date().toISOString()
                leads.form.typeInTextarea('notes', `Member follow-up: Called on ${timestamp}`)

                leads.submitForm()
                cy.url().should('include', '/dashboard/leads')
              }
            })
          })
        }
      })
    })
  })

  describe('CREATE - Member CAN create leads', () => {
    it('MEMBER_LEAD_CREATE_001: should show add button', () => {
      cy.get(leads.list.selectors.createButton).should('be.visible')
    })

    it('MEMBER_LEAD_CREATE_002: should create new lead successfully', () => {
      leads.list.clickCreate()
      leads.form.validateFormVisible()

      const timestamp = Date.now()

      leads.fillLeadForm({
        firstName: `MemberLead${timestamp}`,
        lastName: 'Test',
        email: `memberlead${timestamp}@test.com`,
        phone: '+34 600 123 456',
        source: 'website'
      })

      leads.submitForm()

      cy.url().should('include', '/dashboard/leads')
      cy.contains(`MemberLead${timestamp}`).should('be.visible')
    })

    it('MEMBER_LEAD_CREATE_003: should create lead with minimal required fields', () => {
      leads.list.clickCreate()
      leads.form.validateFormVisible()

      const timestamp = Date.now()
      leads.fillLeadForm({
        firstName: `MinimalMember${timestamp}`,
        email: `minimal${timestamp}@test.com`
      })

      leads.submitForm()
      cy.url().should('include', '/dashboard/leads')
    })
  })

  describe('DELETE - Member CANNOT delete leads', () => {
    it('MEMBER_LEAD_DELETE_001: delete buttons should be hidden', () => {
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_LEAD_DELETE_002: should not see delete action in list view', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get('[data-cy*="delete"]').should('not.exist')
        }
      })
    })

    it('MEMBER_LEAD_DELETE_003: should not see delete action in detail view', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/leads\/[a-z0-9-]+/)

          cy.get('[data-cy="lead-delete-btn"]').should('not.exist')
          cy.get('button:contains("Delete")').should('not.exist')
        }
      })
    })
  })

  describe('PERMISSIONS - Member role capabilities', () => {
    it('MEMBER_LEAD_PERM_001: should have create, read, and update permissions', () => {
      leads.list.validatePageVisible()

      // Verify create button exists (create permission)
      cy.get(leads.list.selectors.createButton).should('be.visible')

      // Verify no delete buttons (no delete permission)
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_LEAD_PERM_002: should be able to create and work with leads', () => {
      leads.list.validatePageVisible()

      // Member can create leads
      cy.get(leads.list.selectors.createButton).should('be.visible')
    })
  })
})
