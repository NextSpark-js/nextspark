/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { CustomersPOM } from '../../../../src/entities/CustomersPOM'
import { loginAsDefaultMember } from '../../../../src/session-helpers'

describe('Customers CRUD - Member Role (Restricted: View Only)', {
  tags: ['@uat', '@feat-customers', '@crud', '@role-member', '@regression']
}, () => {
  const customers = CustomersPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Customers')
    allure.story('Member Permissions')

    // Setup API intercepts BEFORE login and navigation
    customers.setupApiIntercepts()
    loginAsDefaultMember()
    customers.visitList()
    customers.api.waitForList()
    customers.waitForList()
  })

  describe('READ - Member CAN view customers', { tags: '@smoke' }, () => {
    it('CUST-MEMBER-001: should view customer list', { tags: '@smoke' }, () => {
      allure.severity('critical')

      cy.get(customers.selectors.page).should('be.visible')
      customers.assertTableVisible()

      cy.log('✅ Member can view customer list')
    })

    it('CUST-MEMBER-002: should view customer details', () => {
      allure.severity('normal')

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          cy.get(customers.selectors.rowGeneric).first().click()

          // Wait for detail page URL (not using waitForDetail because edit button may not be visible for Member)
          cy.url().should('match', new RegExp(`/dashboard/${customers.entitySlug}/[a-z0-9-]+`))
          cy.get(customers.selectors.viewHeader, { timeout: 15000 }).should('be.visible')

          cy.log('✅ Member can view customer details')
        } else {
          cy.log('⚠️ No customers available to view')
        }
      })
    })
  })

  describe('UPDATE - Member CANNOT edit customers', () => {
    it('CUST-MEMBER-003: edit button should be hidden', () => {
      allure.severity('normal')

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Navigate to detail page
          cy.get(customers.selectors.rowGeneric).first().click()
          cy.url().should('match', new RegExp(`/dashboard/${customers.entitySlug}/[a-z0-9-]+`))
          cy.get(customers.selectors.viewHeader, { timeout: 15000 }).should('be.visible')

          // Verify edit button does NOT exist for Member (Members cannot edit customers)
          cy.get(customers.selectors.editButton).should('not.exist')

          cy.log('✅ Edit button correctly hidden for Member')
        } else {
          cy.log('⚠️ No customers available to check edit button')
        }
      })
    })
  })

  describe('CREATE - Member CANNOT create customers', () => {
    it('CUST-MEMBER-004: create button should be hidden', { tags: '@smoke' }, () => {
      allure.severity('critical')

      cy.get(customers.selectors.addButton).should('not.exist')
      cy.log('✅ Create button correctly hidden for Member')
    })

    it('CUST-MEMBER-005: should not access create form via UI', () => {
      allure.severity('normal')

      cy.get(customers.selectors.addButton).should('not.exist')
      cy.log('✅ No UI access to create form for Member')
    })
  })

  describe('DELETE - Member CANNOT delete customers', () => {
    it('CUST-MEMBER-006: delete buttons should be hidden', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // Delete action buttons should not exist for Member
      cy.get(customers.selectors.rowActionDeleteGeneric).should('not.exist')
      cy.log('✅ Delete buttons correctly hidden for Member')
    })

    it('CUST-MEMBER-007: should not see delete action in detail view', () => {
      allure.severity('normal')

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          cy.get(customers.selectors.rowGeneric).first().click()

          // Wait for detail page (without checking for edit button)
          cy.url().should('match', new RegExp(`/dashboard/${customers.entitySlug}/[a-z0-9-]+`))
          cy.get(customers.selectors.viewHeader, { timeout: 15000 }).should('be.visible')

          // Delete button should not exist on detail page for Member
          cy.get(customers.selectors.deleteButton).should('not.exist')
          cy.log('✅ No delete action visible in detail view for Member')
        } else {
          cy.log('⚠️ No customers available to check delete action')
        }
      })
    })
  })
})
