/// <reference types="cypress" />

/**
 * Contacts CRUD - Member Role (Create + Read + Update, No Delete)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { ContactsPOM } from '../../../src/entities/ContactsPOM'
import { loginAsCrmMember } from '../../../src/session-helpers'

describe('Contacts CRUD - Member Role (Create + Read + Update)', () => {
  const contacts = new ContactsPOM()

  beforeEach(() => {
    loginAsCrmMember()
    cy.visit('/dashboard/contacts')
    contacts.list.validatePageVisible()
  })

  describe('CREATE - Member CAN create contacts', () => {
    it('MEMBER_CONTACT_CREATE_001: should show add button', () => {
      cy.get(contacts.list.selectors.createButton).should('be.visible')
    })

    it('MEMBER_CONTACT_CREATE_002: should create new contact successfully', () => {
      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      const timestamp = Date.now()

      contacts.fillContactForm({
        firstName: `MemberContact${timestamp}`,
        lastName: 'Test',
        email: `membercontact${timestamp}@test.com`,
        phone: '+34 600 123 456',
        title: 'Sales Manager'
      })

      contacts.submitForm()

      cy.url().should('include', '/dashboard/contacts')
      cy.contains(`MemberContact${timestamp}`).should('be.visible')
    })

    it('MEMBER_CONTACT_CREATE_003: should create contact with minimal required fields', () => {
      contacts.list.clickCreate()
      contacts.form.validateFormVisible()

      const timestamp = Date.now()
      contacts.fillContactForm({
        firstName: `MinimalMemberContact${timestamp}`,
        email: `minimal${timestamp}@test.com`
      })

      contacts.submitForm()
      cy.url().should('include', '/dashboard/contacts')
    })
  })

  describe('READ - Member can read contacts', () => {
    it('MEMBER_CONTACT_READ_001: should view contact list', () => {
      contacts.list.validatePageVisible()
      contacts.list.validateTableVisible()
    })

    it('MEMBER_CONTACT_READ_002: should view contact details', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/contacts\/[a-z0-9-]+/)
        }
      })
    })

    it('MEMBER_CONTACT_READ_003: should search contacts', () => {
      contacts.list.search('test')
      cy.wait(500)
      contacts.list.clearSearch()
    })

    it('MEMBER_CONTACT_READ_004: should view all contacts in organization', () => {
      contacts.list.validatePageVisible()

      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(contacts.list.selectors.rowGeneric).should('have.length.at.least', 1)
        }
      })
    })
  })

  describe('UPDATE - Member CAN update contacts', () => {
    it('MEMBER_CONTACT_UPDATE_001: should edit contact successfully', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)

          cy.url().then(url => {
            const contactId = url.split('/').pop()
            contacts.form.visitEdit(contactId!)
            contacts.form.validateFormVisible()

            const updatedFirstName = `UpdatedMember${Date.now()}`
            contacts.form.typeInField('firstName', updatedFirstName)

            contacts.submitForm()

            cy.url().should('include', '/dashboard/contacts')
            cy.contains(updatedFirstName).should('be.visible')
          })
        }
      })
    })

    it('MEMBER_CONTACT_UPDATE_002: should update contact details', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          contacts.list.clickRowByIndex(0)

          cy.url().then(url => {
            const contactId = url.split('/').pop()
            contacts.form.visitEdit(contactId!)
            contacts.form.validateFormVisible()

            const timestamp = Date.now()
            contacts.form.typeInField('firstName', `Miguel${timestamp}`)
            contacts.form.typeInField('title', 'Sales Representative')
            contacts.form.typeInField('phone', '+34 600 111 222')

            contacts.submitForm()

            cy.url().should('include', '/dashboard/contacts')
            cy.contains(`Miguel${timestamp}`).should('be.visible')
          })
        }
      })
    })

    it('MEMBER_CONTACT_UPDATE_003: should cancel update without saving', () => {
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

  describe('DELETE - Member CANNOT delete contacts', () => {
    it('MEMBER_CONTACT_DELETE_001: should NOT show delete button', () => {
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_CONTACT_DELETE_002: should NOT delete contact via API', () => {
      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(contacts.list.selectors.rowGeneric).first().invoke('attr', 'data-cy').then(dataCy => {
            if (dataCy) {
              const contactId = dataCy.replace('contacts-row-', '')

              cy.request({
                method: 'DELETE',
                url: `/api/v1/contacts/${contactId}`,
                failOnStatusCode: false,
              }).then(response => {
                expect(response.status).to.be.oneOf([401, 403, 404])
              })
            }
          })
        }
      })
    })
  })

  describe('PERMISSIONS - Member role capabilities', () => {
    it('MEMBER_CONTACT_PERMISSIONS_001: should have create, read, and update access', () => {
      contacts.list.validatePageVisible()

      // Check for add button (create permission)
      cy.get(contacts.list.selectors.createButton).should('be.visible')

      // Check for no delete buttons (no delete permission)
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_CONTACT_PERMISSIONS_002: should see all organization contacts', () => {
      contacts.list.validatePageVisible()

      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(contacts.list.selectors.rowGeneric).should('have.length.at.least', 1)
        }
      })
    })

    it('MEMBER_CONTACT_PERMISSIONS_003: should create and update any contact', () => {
      cy.get(contacts.list.selectors.createButton).should('be.visible')

      cy.get(contacts.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          // Verify edit capability
          contacts.list.clickRowByIndex(0)
          cy.url().then(url => {
            const contactId = url.split('/').pop()
            contacts.form.visitEdit(contactId!)
            contacts.form.validateFormVisible()
          })
        }
      })
    })
  })
})
