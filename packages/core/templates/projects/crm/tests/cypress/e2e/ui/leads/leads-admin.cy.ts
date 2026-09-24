/// <reference types="cypress" />

/**
 * Leads CRUD - Admin Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { LeadsPOM } from '../../../../src/entities/LeadsPOM'
import { loginAsCrmAdmin } from '../../../../src/session-helpers'

describe('Leads CRUD - Admin Role (Full Access)', () => {
  const leads = new LeadsPOM()

  beforeEach(() => {
    loginAsCrmAdmin()
    cy.visit('/dashboard/leads')
    leads.list.validatePageVisible()
  })

  describe('CREATE - Admin can create leads', () => {
    it('ADMIN_LEAD_CREATE_001: should create new lead with required fields', () => {
      const timestamp = Date.now()
      const firstName = `Admin`
      const lastName = `Lead ${timestamp}`
      const email = `admin-lead${timestamp}@example.com`

      // Click create button
      leads.list.clickCreate()

      // Validate form is visible
      leads.form.validateFormVisible()

      // Fill required lead fields using POM
      leads.fillLeadForm({
        firstName,
        lastName,
        email,
        status: 'new'
      })

      // Submit form
      leads.submitForm()

      // Validate redirect to list
      cy.url().should('include', '/dashboard/leads')

      // Validate lead appears in list
      cy.contains(lastName).should('be.visible')
    })

    it('ADMIN_LEAD_CREATE_002: should create qualified lead', () => {
      const timestamp = Date.now()
      const firstName = `Qualified`
      const lastName = `Lead ${timestamp}`
      const email = `qualified${timestamp}@example.com`

      leads.list.clickCreate()
      leads.form.validateFormVisible()

      leads.fillLeadForm({
        firstName,
        lastName,
        email,
        status: 'qualified',
        company: 'Enterprise Corp'
      })

      leads.submitForm()

      cy.url().should('include', '/dashboard/leads')
      cy.contains(lastName).should('be.visible')
    })

    it('ADMIN_LEAD_CREATE_003: should validate email format', () => {
      const timestamp = Date.now()

      leads.list.clickCreate()
      leads.form.validateFormVisible()

      leads.fillLeadForm({
        firstName: 'Test',
        lastName: `Lead ${timestamp}`,
        email: 'invalid-email',
        status: 'new'
      })

      leads.submitForm()

      // Form should still be visible (validation failed)
      leads.form.validateFormVisible()
    })

    it('ADMIN_LEAD_CREATE_004: should cancel lead creation', () => {
      leads.list.clickCreate()
      leads.form.validateFormVisible()

      leads.fillLeadForm({
        firstName: 'Cancel',
        lastName: 'Test'
      })

      leads.form.cancel()

      // Should return to list
      leads.list.validatePageVisible()
    })
  })

  describe('READ - Admin can read leads', () => {
    it('ADMIN_LEAD_READ_001: should view lead list', () => {
      leads.list.validatePageVisible()
      leads.list.validateTableVisible()
    })

    it('ADMIN_LEAD_READ_002: should view lead details', () => {
      // Check if there are leads to view
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/leads\/[a-z0-9-]+/)
        }
      })
    })

    it('ADMIN_LEAD_READ_003: should search and filter leads', () => {
      leads.list.search('Admin')
      cy.wait(500)
      leads.list.clearSearch()
    })

    it('ADMIN_LEAD_READ_004: should paginate through leads', () => {
      leads.list.validatePageVisible()

      cy.get(leads.list.selectors.pagination).then($pagination => {
        if ($pagination.length > 0) {
          leads.list.nextPage()
        }
      })
    })
  })

  describe('UPDATE - Admin can update leads', () => {
    it('ADMIN_LEAD_UPDATE_001: should edit lead information', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          // Click on first row to view details
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()

            // Navigate to edit page
            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            // Update first name
            const updatedFirstName = `UpdatedAdmin`
            leads.form.typeInField('firstName', updatedFirstName)

            leads.submitForm()

            cy.url().should('include', '/dashboard/leads')
            cy.contains(updatedFirstName).should('be.visible')
          })
        }
      })
    })

    it('ADMIN_LEAD_UPDATE_002: should progress lead through sales pipeline', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()

            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            // Progress status
            leads.form.selectOption('status', 'contacted')

            leads.submitForm()
            cy.url().should('include', '/dashboard/leads')
          })
        }
      })
    })

    it('ADMIN_LEAD_UPDATE_003: should cancel update without saving', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          cy.url().then(url => {
            const leadId = url.split('/').pop()

            leads.form.visitEdit(leadId!)
            leads.form.validateFormVisible()

            leads.form.typeInField('firstName', 'ShouldNotSave')

            leads.form.cancel()
            cy.url().should('not.include', '/edit')
          })
        }
      })
    })
  })

  describe('DELETE - Admin can delete leads', () => {
    it('ADMIN_LEAD_DELETE_001: should delete lead', () => {
      // First, create a lead to delete
      const timestamp = Date.now()
      const firstName = `AdminDelete`
      const lastName = `Test ${timestamp}`
      const email = `admin-delete${timestamp}@example.com`

      leads.list.clickCreate()
      leads.fillLeadForm({
        firstName,
        lastName,
        email,
        status: 'new'
      })
      leads.submitForm()

      // Wait for lead to appear
      cy.contains(lastName).should('be.visible')

      // Search for the lead
      leads.list.search(lastName)

      // Delete it
      cy.get(leads.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      // Confirm deletion
      leads.list.confirmDelete()

      // Validate deletion
      leads.list.search(lastName)
      cy.get(leads.list.selectors.emptyState).should('be.visible')
    })

    it('ADMIN_LEAD_DELETE_002: should cancel deletion', () => {
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

    it('ADMIN_LEAD_DELETE_003: should handle bulk delete', () => {
      leads.list.selectAll()
      leads.list.validateBulkActionsVisible()
    })
  })

  describe('CONVERT - Admin can convert leads', () => {
    it('ADMIN_LEAD_CONVERT_001: should convert lead to contact', () => {
      cy.get(leads.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          leads.list.clickRowByIndex(0)

          // Check if convert button exists
          cy.get('[data-cy="lead-convert-btn"]').then($btn => {
            if ($btn.length > 0) {
              leads.convertToContact()
              // Should navigate to contact or show success
              cy.url().should('include', '/contacts')
            }
          })
        }
      })
    })
  })
})
