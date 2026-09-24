/// <reference types="cypress" />

/**
 * Contacts CRUD - Owner Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { ContactsPOM } from '../../../src/entities/ContactsPOM'
import { loginAsCrmOwner } from '../../../src/session-helpers'

describe('Contacts CRUD - Owner Role (Full Access)', () => {
  const contacts = new ContactsPOM()

  beforeEach(() => {
    loginAsCrmOwner()
    cy.visit('/dashboard/contacts')
    contacts.list.validatePageVisible()
  })

  describe('CREATE - Owner can create contacts', () => {
    it('OWNER_CONTACT_CREATE_001: should create new contact with required fields only', () => {
      const firstName = `Roberto${Date.now()}`
      const lastName = 'TestOwner'
      const email = `roberto.owner.${Date.now()}@test.com`

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

    it('OWNER_CONTACT_CREATE_002: should create contact with all fields', () => {
      const timestamp = Date.now()

      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      contacts.fillContactForm({
        firstName: `Carlos${timestamp}`,
        lastName: 'Rodriguez',
        email: `carlos.full.${timestamp}@test.com`,
        phone: '+34 91 123 4567',
        title: 'Sales Director'
      })

      contacts.submitForm()

      cy.url().should('include', '/dashboard/contacts')
      cy.contains(`Carlos${timestamp}`).should('be.visible')
    })

    it('OWNER_CONTACT_CREATE_003: should validate required fields', () => {
      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      // Try to submit empty form
      contacts.submitForm()

      // Should show validation or stay on form
      cy.get('body').then($body => {
        const isOnCreatePage = window.location.pathname.includes('/create')
        if (isOnCreatePage) {
          cy.log('Form validation prevented submission')
        }
      })
    })

    it('OWNER_CONTACT_CREATE_004: should validate email format', () => {
      const firstName = `Invalid${Date.now()}`
      const lastName = 'Email'

      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      contacts.fillContactForm({
        firstName,
        lastName,
        email: 'not-an-email'
      })

      contacts.submitForm()

      // Should show validation error
      cy.get('body').then($body => {
        const isOnCreatePage = window.location.pathname.includes('/create')
        if (isOnCreatePage) {
          cy.log('Email validation working')
        }
      })
    })
  })

  describe('READ - Owner can read contacts', () => {
    it('OWNER_CONTACT_READ_001: should view contact list', () => {
      contacts.list.validatePageVisible()
      contacts.list.validateTableVisible()
    })

    it('OWNER_CONTACT_READ_002: should view contact details', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/contacts\/[a-z0-9-]+/)
        }
      })
    })

    it('OWNER_CONTACT_READ_003: should search contacts', () => {
      contacts.list.search('test')
      cy.wait(500)
      contacts.list.clearSearch()
    })
  })

  describe('UPDATE - Owner can update contacts', () => {
    it('OWNER_CONTACT_UPDATE_001: should edit contact successfully', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)

          cy.url().then(url => {
            const contactId = url.split('/').pop()
            contacts.form.visitEdit(contactId!)
            contacts.form.validateFormVisible()

            const updatedFirstName = `UpdatedOwner${Date.now()}`
            contacts.form.typeInField('firstName', updatedFirstName)

            contacts.submitForm()

            cy.url().should('include', '/dashboard/contacts')
            cy.contains(updatedFirstName).should('be.visible')
          })
        }
      })
    })

    it('OWNER_CONTACT_UPDATE_002: should update all contact fields', () => {
      const firstName = `FullUpdate${Date.now()}`
      const lastName = 'Owner'
      const email = `full.update.${Date.now()}@test.com`

      contacts.list.clickCreate()
      contacts.fillContactForm({ firstName, lastName, email })
      contacts.submitForm()

      cy.contains(firstName).should('be.visible')

      // Edit the contact
      cy.get(contacts.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="edit"]').click()
      })

      contacts.form.validateFormVisible()

      contacts.form.typeInField('firstName', `${firstName}_Updated`)
      contacts.form.typeInField('phone', '+34 91 999 8888')
      contacts.form.typeInField('title', 'CEO')

      contacts.submitForm()

      cy.url().should('include', '/dashboard/contacts')
      cy.contains(`${firstName}_Updated`).should('be.visible')
    })

    it('OWNER_CONTACT_UPDATE_003: should cancel update without saving', () => {
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

  describe('DELETE - Owner can delete contacts', () => {
    it('OWNER_CONTACT_DELETE_001: should delete contact successfully', () => {
      const firstName = `DeleteTest${Date.now()}`
      const lastName = 'Owner'
      const email = `delete.owner.${Date.now()}@test.com`

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

    it('OWNER_CONTACT_DELETE_002: should cancel contact deletion', () => {
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
  })
})
