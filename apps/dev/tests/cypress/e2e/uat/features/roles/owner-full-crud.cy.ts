/// <reference types="cypress" />

/**
 * Owner Role - Full CRUD Permissions
 *
 * Tests to verify that Owner role maintains full CRUD access to customers.
 * This validates that extensible roles don't break existing owner capabilities.
 *
 * Test user: Carlos Mendoza (carlos.mendoza@nextspark.dev) - Everpoint Labs
 */

import * as allure from 'allure-cypress'

import { CustomersPOM } from '../../../../src/entities/CustomersPOM'
import { loginAsDefaultOwner } from '../../../../src/session-helpers'

describe('Owner Role - Full CRUD Permissions', {
  tags: ['@uat', '@feat-teams', '@security', '@role-owner', '@regression']
}, () => {
  const customers = CustomersPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Permissions')
    allure.story('Owner Full CRUD')
    customers.setupApiIntercepts()
    loginAsDefaultOwner()
  })

  describe('UI Access - All Buttons Visible', { tags: '@smoke' }, () => {
    it('OWNER_CRUD_001: Owner sees Add button on customers list', { tags: '@smoke' }, () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      // Owner should see the Add button
      cy.get(customers.selectors.addButton).should('be.visible')

      cy.log('✅ Owner can see Add button')
    })

    it('OWNER_CRUD_002: Owner sees row actions menu on customer rows', { tags: '@smoke' }, () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Row actions menu trigger should be visible (Owner has edit/delete permissions)
          cy.get(`[data-cy^="${customers.entitySlug}-menu-"]`).first().should('be.visible')

          cy.log('✅ Owner can see row actions menu on rows')
        } else {
          cy.log('⚠️ No customers to check row actions')
        }
      })
    })

    it('OWNER_CRUD_003: Owner sees Edit and Delete options in row menu', () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Open the first row's menu
          cy.get(`[data-cy^="${customers.entitySlug}-menu-"]`).first().click()

          // Edit and Delete options should be visible in the dropdown
          cy.get('[role="menuitem"]').contains('Edit').should('be.visible')
          cy.get('[role="menuitem"]').contains('Delete').should('be.visible')

          // Close dropdown by pressing escape
          cy.get('body').type('{esc}')

          cy.log('✅ Owner can see Edit and Delete in row menu')
        } else {
          cy.log('⚠️ No customers to check row menu')
        }
      })
    })
  })

  describe('CRUD Operations - Full Access', () => {
    it('OWNER_CRUD_004: Owner can access customer create form', () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()

      // Click Add button
      cy.get(customers.selectors.addButton).click()

      // Should navigate to create form
      cy.url().should('include', '/create')
      customers.waitForForm()

      cy.log('✅ Owner can access customer create form')
    })

    it('OWNER_CRUD_005: Owner can access create form and see submit button', () => {
      allure.severity('critical')

      customers.visitCreate()
      customers.waitForForm()

      // Owner should see the form fields
      cy.get(`[data-cy="${customers.entitySlug}-field-name"]`).should('be.visible')
      cy.get(`[data-cy="${customers.entitySlug}-field-account"]`).should('be.visible')

      // Owner should see the submit button
      cy.get(`[data-cy="${customers.entitySlug}-form-submit"]`).should('be.visible')

      cy.log('✅ Owner can access create form with submit capability')
    })

    it('OWNER_CRUD_006: Owner can access customer edit form', () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Open the first row's menu and click Edit
          cy.get(`[data-cy^="${customers.entitySlug}-menu-"]`).first().click()
          cy.get('[role="menuitem"]').contains('Edit').click()

          // Should navigate to edit form
          cy.url().should('include', '/edit')
          customers.waitForForm()

          cy.log('✅ Owner can access customer edit form')
        } else {
          cy.log('⚠️ No customers to test edit access')
        }
      })
    })

    it('OWNER_CRUD_007: Owner can access edit form with submit capability', () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Open the first row's menu and click Edit
          cy.get(`[data-cy^="${customers.entitySlug}-menu-"]`).first().click()
          cy.get('[role="menuitem"]').contains('Edit').click()
          customers.waitForForm()

          // Owner should see the form fields
          cy.get(`[data-cy="${customers.entitySlug}-field-name"]`).should('be.visible')

          // Owner should see the submit button
          cy.get(`[data-cy="${customers.entitySlug}-form-submit"]`).should('be.visible')

          cy.log('✅ Owner can access edit form with submit capability')
        } else {
          cy.log('⚠️ No customers to test edit access')
        }
      })
    })

    it('OWNER_CRUD_008: Owner can see Delete option in row menu', () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Open the first row's menu
          cy.get(`[data-cy^="${customers.entitySlug}-menu-"]`).first().click()

          // Owner should see the Delete option (this verifies delete permission)
          cy.get('[role="menuitem"]').contains('Delete').should('be.visible')

          // Close dropdown
          cy.get('body').type('{esc}')

          cy.log('✅ Owner can see Delete option in row menu')
        } else {
          cy.log('⚠️ No customers to test delete capability')
        }
      })
    })
  })

  describe('Direct URL Access - Full Access', () => {
    it('OWNER_CRUD_009: Owner can access /customers/create via URL', () => {
      cy.visit(`/dashboard/${customers.entitySlug}/create`)

      // Should NOT show permission denied
      cy.get('[data-cy="permission-denied"]').should('not.exist')

      // Should show form
      customers.waitForForm()

      cy.log('✅ Owner can access create via direct URL')
    })

    it('OWNER_CRUD_010: Owner can access /customers/[id]/edit via URL', () => {
      customers.visitList()
      customers.api.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Extract customer ID
          cy.get(customers.selectors.rowGeneric).first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const customerId = dataCy?.replace(`${customers.entitySlug}-row-`, '')

              if (customerId) {
                cy.visit(`/dashboard/${customers.entitySlug}/${customerId}/edit`)

                // Should NOT show permission denied
                cy.get('[data-cy="permission-denied"]').should('not.exist')

                // Should show form
                customers.waitForForm()

                cy.log('✅ Owner can access edit via direct URL')
              }
            })
        } else {
          cy.log('⚠️ No customers to test direct URL edit')
        }
      })
    })
  })

  after(() => {
    cy.log('✅ Owner CRUD permission tests completed')
  })
})
