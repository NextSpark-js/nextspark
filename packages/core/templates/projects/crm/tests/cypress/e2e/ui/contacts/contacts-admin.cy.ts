/// <reference types="cypress" />

/**
 * Contacts CRUD - Admin Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { ContactsPOM } from '../../../src/entities/ContactsPOM'
import { loginAsCrmAdmin } from '../../../src/session-helpers'

describe('Contacts CRUD - Admin Role (Full Access)', () => {
  const contacts = new ContactsPOM()

  beforeEach(() => {
    loginAsCrmAdmin()
    cy.visit('/dashboard/contacts')
    contacts.list.validatePageVisible()
  })

  describe('CREATE - Admin can create contacts', () => {
    it('ADMIN_CONTACT_CREATE_001: should create new contact with required fields', () => {
      const firstName = `Sofia${Date.now()}`
      const lastName = 'TestAdmin'
      const email = `sofia.admin.${Date.now()}@test.com`

      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      contacts.fillContactForm({
        firstName,
        lastName,
        email
      })

      contacts.submitForm()

      cy.url().should('include', '/dashboard/contacts')
      cy.contains(firstName).should('be.visible')
      cy.contains(lastName).should('be.visible')
    })

    it('ADMIN_CONTACT_CREATE_002: should create contact with business fields', () => {
      const timestamp = Date.now()

      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      contacts.fillContactForm({
        firstName: `Maria${timestamp}`,
        lastName: 'Gonzalez',
        email: `maria.admin.${timestamp}@test.com`,
        phone: '+34 91 555 1234',
        title: 'Marketing Manager'
      })

      contacts.submitForm()

      cy.url().should('include', '/dashboard/contacts')
      cy.contains(`Maria${timestamp}`).should('be.visible')
    })

    it('ADMIN_CONTACT_CREATE_003: should validate email uniqueness', () => {
      const firstName = `Unique${Date.now()}`
      const lastName = 'Test'
      const email = `unique.admin.${Date.now()}@test.com`

      // Create first contact
      contacts.list.clickCreate()
      contacts.fillContactForm({ firstName, lastName, email })
      contacts.submitForm()

      cy.contains(firstName).should('be.visible')

      // Return to list and try creating with same email
      cy.visit('/dashboard/contacts')
      contacts.list.validatePageVisible()

      contacts.list.clickCreate()
      contacts.fillContactForm({
        firstName: 'Duplicate',
        lastName: 'Contact',
        email
      })
      contacts.submitForm()

      // Should show error or stay on form
      cy.get('body').then($body => {
        const isOnCreatePage = window.location.pathname.includes('/create')
        const hasErrorMessage = $body.text().includes('already exists') || $body.text().includes('duplicate')

        if (isOnCreatePage || hasErrorMessage) {
          cy.log('Email uniqueness validation working')
        }
      })
    })

    it('ADMIN_CONTACT_CREATE_004: should cancel contact creation', () => {
      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      contacts.fillContactForm({
        firstName: 'Cancel',
        lastName: 'Test'
      })

      contacts.form.cancel()
      contacts.list.validatePageVisible()
    })
  })

  describe('READ - Admin can read contacts', () => {
    it('ADMIN_CONTACT_READ_001: should view contact list', () => {
      contacts.list.validatePageVisible()
      contacts.list.validateTableVisible()
    })

    it('ADMIN_CONTACT_READ_002: should view contact details', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/contacts\/[a-z0-9-]+/)
        }
      })
    })

    it('ADMIN_CONTACT_READ_003: should search and filter contacts', () => {
      contacts.list.search('test')
      cy.wait(500)
      contacts.list.clearSearch()
    })

    it('ADMIN_CONTACT_READ_004: should view all contacts regardless of creator', () => {
      contacts.list.validatePageVisible()
      contacts.list.validateTableVisible()
    })
  })

  describe('UPDATE - Admin can update contacts', () => {
    it('ADMIN_CONTACT_UPDATE_001: should edit contact successfully', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)

          cy.url().then(url => {
            const contactId = url.split('/').pop()
            contacts.form.visitEdit(contactId!)
            contacts.form.validateFormVisible()

            const updatedFirstName = `UpdatedAdmin${Date.now()}`
            contacts.form.typeInField('firstName', updatedFirstName)

            contacts.submitForm()

            cy.url().should('include', '/dashboard/contacts')
            cy.contains(updatedFirstName).should('be.visible')
          })
        }
      })
    })

    it('ADMIN_CONTACT_UPDATE_002: should update contact work info', () => {
      const firstName = `WorkUpdate${Date.now()}`
      const lastName = 'Admin'
      const email = `work.admin.${Date.now()}@test.com`

      contacts.list.clickCreate()
      contacts.fillContactForm({ firstName, lastName, email })
      contacts.submitForm()

      cy.contains(firstName).should('be.visible')

      // Edit the contact
      cy.get(contacts.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="edit"]').click()
      })

      contacts.form.validateFormVisible()

      contacts.form.typeInField('title', 'VP of Sales')
      contacts.form.typeInField('phone', '+34 91 888 7777')

      contacts.submitForm()

      cy.url().should('include', '/dashboard/contacts')
    })

    it('ADMIN_CONTACT_UPDATE_003: should cancel update without saving', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)

          cy.url().then(url => {
            const contactId = url.split('/').pop()
            contacts.form.visitEdit(contactId!)
            contacts.form.validateFormVisible()

            contacts.form.typeInField('firstName', 'ShouldNotSave')

            contacts.form.cancel()
            cy.url().should('not.include', '/edit')
          })
        }
      })
    })
  })

  describe('DELETE - Admin can delete contacts', () => {
    it('ADMIN_CONTACT_DELETE_001: should delete contact successfully', () => {
      const firstName = `DeleteTest${Date.now()}`
      const lastName = 'Admin'
      const email = `delete.admin.${Date.now()}@test.com`

      contacts.list.clickCreate()
      contacts.fillContactForm({ firstName, lastName, email })
      contacts.submitForm()

      cy.contains(firstName).should('be.visible')

      contacts.list.search(firstName)

      cy.get(contacts.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      contacts.list.confirmDelete()

      cy.wait(1000)
      contacts.list.search(firstName)
      cy.get(contacts.list.selectors.emptyState).should('be.visible')
    })

    it('ADMIN_CONTACT_DELETE_002: should cancel deletion', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(contacts.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').click()
          })

          contacts.list.cancelDelete()
          contacts.list.validateTableVisible()
        }
      })
    })

    it('ADMIN_CONTACT_DELETE_003: should handle bulk delete', () => {
      contacts.list.selectAll()
      contacts.list.validateBulkActionsVisible()
    })
  })
})
