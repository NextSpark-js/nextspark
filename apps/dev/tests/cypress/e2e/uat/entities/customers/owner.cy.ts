/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { CustomersPOM } from '../../../../src/entities/CustomersPOM'
import { loginAsDefaultOwner } from '../../../../src/session-helpers'

describe('Customers CRUD - Owner Role (Full Access)', {
  tags: ['@uat', '@feat-customers', '@crud', '@role-owner', '@regression']
}, () => {
  const customers = CustomersPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Customers')
    allure.story('Owner Permissions')

    // Setup API intercepts BEFORE login and navigation
    customers.setupApiIntercepts()
    loginAsDefaultOwner()
    customers.visitList()
    customers.api.waitForList()
    customers.waitForList()
  })

  describe('CREATE - Owner can create customers', { tags: '@smoke' }, () => {
    it('CUST-001: should create new customer with all required fields', { tags: '@smoke' }, () => {
      allure.severity('critical')
      const timestamp = Date.now()
      const customerData = {
        name: `Test Customer ${timestamp}`,
        account: String(Math.floor(Math.random() * 900000) + 100000),
        office: 'Main Office'
      }

      // Use API-aware create flow
      customers.clickAdd()
      customers.waitForForm()
      customers.fillCustomerForm(customerData)
      customers.submitForm()

      // Wait for API response (deterministic)
      customers.api.waitForCreate()

      // Validate redirect and customer appears
      cy.url().should('include', `/dashboard/${customers.entitySlug}`)
      customers.assertCustomerInList(customerData.name)

      cy.log('✅ Owner created customer successfully')
    })
  })

  describe('READ - Owner can view customers', { tags: '@smoke' }, () => {
    it('CUST-002: should view customer list', { tags: '@smoke' }, () => {
      allure.severity('critical')

      cy.get(customers.selectors.page).should('be.visible')
      customers.assertTableVisible()

      cy.log('✅ Owner can view customer list')
    })

    it('CUST-003: should view customer details', () => {
      allure.severity('normal')

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Click first row to view details
          cy.get(customers.selectors.rowGeneric).first().click()
          customers.waitForDetail()

          cy.url().should('match', new RegExp(`/dashboard/${customers.entitySlug}/[a-z0-9-]+`))
          cy.log('✅ Owner can view customer details')
        } else {
          cy.log('⚠️ No customers available to view details')
        }
      })
    })
  })

  describe('UPDATE - Owner can update customers', () => {
    it('CUST-004: should edit existing customer', () => {
      allure.severity('normal')

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Navigate to detail page
          cy.get(customers.selectors.rowGeneric).first().click()
          customers.waitForDetail()

          // Edit flow with API wait
          customers.clickEdit()
          customers.waitForForm()

          // Wait for form to be fully loaded (fields enabled)
          cy.get(customers.selectors.field('name')).find('input').should('not.be.disabled')

          const updatedName = `Updated Customer ${Date.now()}`
          customers.fillTextField('name', updatedName)
          customers.submitForm()

          // Wait for API response (deterministic)
          customers.api.waitForUpdate()

          // Verify update by visiting list
          customers.visitList()
          customers.api.waitForList()
          customers.assertCustomerInList(updatedName)

          cy.log('✅ Owner updated customer successfully')
        } else {
          cy.log('⚠️ No customers available to edit')
        }
      })
    })
  })

  describe('DELETE - Owner can delete customers', () => {
    it('CUST-005: should delete customer', () => {
      allure.severity('normal')

      // Create a customer to delete (ensures test data exists)
      const timestamp = Date.now()
      const customerData = {
        name: `Delete Test ${timestamp}`,
        account: String(Math.floor(Math.random() * 900000) + 100000),
        office: 'Test Office'
      }

      // Create customer with API wait
      customers.clickAdd()
      customers.waitForForm()
      customers.fillCustomerForm(customerData)
      customers.submitForm()
      customers.api.waitForCreate()

      // Navigate to list and verify
      customers.visitList()
      customers.api.waitForList()
      customers.assertCustomerInList(customerData.name)

      // Delete flow with API wait
      customers.clickRowByText(customerData.name)
      customers.waitForDetail()
      customers.clickDelete()

      // First dialog (EntityDetailHeader) - click confirm
      cy.get(customers.selectors.deleteDialog, { timeout: 5000 }).should('be.visible')
      cy.get(customers.selectors.deleteConfirm).should('be.visible').and('not.be.disabled').click()

      // Second dialog (EntityDetailWrapper parent confirmation) - click confirm
      cy.get(customers.selectors.parentDeleteConfirm, { timeout: 5000 }).should('be.visible').and('not.be.disabled').click()

      // Wait for delete API response (deterministic)
      customers.api.waitForDelete()

      // Verify deletion
      customers.visitList()
      customers.api.waitForList()
      customers.assertCustomerNotInList(customerData.name)

      cy.log('✅ Owner deleted customer successfully')
    })
  })
})
