/// <reference types="cypress" />

/**
 * Editor Role - Permission Restrictions
 *
 * Tests for the custom "editor" role (hierarchy level 5).
 * Editor has limited permissions:
 * - customers: list, read only (no create/update/delete)
 * - Cannot access Superadmin (superadmin only)
 * - Cannot access Dev Zone (restricted zone)
 *
 * Test user: Diego Ramírez (diego.ramirez@nextspark.dev) - Everpoint Labs
 */

import * as allure from 'allure-cypress'

import { CustomersPOM } from '../../../../src/entities/CustomersPOM'
import { loginAsDefaultEditor } from '../../../../src/session-helpers'

describe('Editor Role - Permission Restrictions', {
  tags: ['@uat', '@feat-teams', '@security', '@role-editor', '@regression']
}, () => {
  const customers = CustomersPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Permissions')
    allure.story('Editor Role Restrictions')
    customers.setupApiIntercepts()
    loginAsDefaultEditor()
  })

  describe('UI Restrictions - Buttons Hidden', { tags: '@smoke' }, () => {
    it('EDIT_ROLE_001: Editor can view customers list', { tags: '@smoke' }, () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      // Editor should see the customers table
      cy.get(customers.selectors.table).should('be.visible')

      cy.log('✅ Editor can view customers list')
    })

    it('EDIT_ROLE_002: Create Customer button not visible for Editor', { tags: '@smoke' }, () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      // Create button should NOT exist for Editor (no create permission)
      cy.get(customers.selectors.addButton).should('not.exist')

      cy.log('✅ Create button correctly hidden for Editor')
    })

    it('EDIT_ROLE_003: Edit/Delete buttons not visible for Editor', () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Edit action buttons should NOT exist for Editor
          cy.get(customers.selectors.rowActionEditGeneric).should('not.exist')

          // Delete action buttons should NOT exist for Editor
          cy.get(customers.selectors.rowActionDeleteGeneric).should('not.exist')

          cy.log('✅ Edit/Delete buttons correctly hidden for Editor')
        } else {
          cy.log('⚠️ No customers to check edit/delete permissions')
        }
      })
    })

    it('EDIT_ROLE_004: Editor has no row actions menu (no edit/delete permissions)', () => {
      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Row actions menu should NOT exist for Editor
          // EntityList only shows actions menu if user has canUpdate or canDelete
          // Editor has neither, so the menu trigger should not exist
          cy.get('[data-cy^="customers-actions-"]').should('not.exist')

          cy.log('✅ Row actions menu correctly hidden for Editor (no edit/delete permissions)')
        } else {
          cy.log('⚠️ No customers to check row actions')
        }
      })
    })
  })

  describe('URL Access Restrictions - Permission Denied', () => {
    it('EDIT_ROLE_005: Direct URL to /customers/create shows Permission Denied', () => {
      allure.severity('critical')

      cy.visit(`/dashboard/${customers.entitySlug}/create`)

      // Check for permission denied component OR redirect
      cy.get('body').then($body => {
        if ($body.find('[data-cy="permission-denied"]').length > 0) {
          cy.get('[data-cy="permission-denied"]').should('be.visible')
          cy.log('✅ Permission Denied component shown for /create')
        } else {
          // App redirects to permission-denied page
          cy.url().should('include', 'permission-denied')
          cy.log('✅ Redirected to permission denied page')
        }
      })
    })

    it('EDIT_ROLE_006: Direct URL to /customers/[id]/edit shows Permission Denied', () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Extract customer ID from first row
          cy.get(customers.selectors.rowGeneric).first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const customerId = dataCy?.replace(`${customers.entitySlug}-row-`, '')

              if (customerId) {
                // Try to access edit URL directly
                cy.visit(`/dashboard/${customers.entitySlug}/${customerId}/edit`)

                // Should show permission denied or redirect
                cy.get('body').then($body2 => {
                  if ($body2.find('[data-cy="permission-denied"]').length > 0) {
                    cy.get('[data-cy="permission-denied"]').should('be.visible')
                    cy.log('✅ Permission Denied shown for /edit')
                  } else {
                    cy.url().should('not.include', '/edit')
                    cy.log('✅ Redirected away from /edit (no permission)')
                  }
                })
              }
            })
        } else {
          cy.log('⚠️ No customers to test edit URL restriction')
        }
      })
    })
  })

  describe('Restricted Zones - Access Denied', () => {
    it('EDIT_ROLE_007: Editor cannot access Superadmin', () => {
      allure.severity('blocker')

      cy.visit('/superadmin', { failOnStatusCode: false })

      // Should be redirected to dashboard with access_denied error
      cy.url().should('include', '/dashboard')
      cy.url().should('include', 'error=access_denied')

      cy.log('✅ Editor correctly blocked from Superadmin')
    })

    it('EDIT_ROLE_008: Editor cannot access Dev Zone', () => {
      allure.severity('blocker')

      cy.visit('/devtools', { failOnStatusCode: false })

      // Should be redirected to dashboard with access_denied error
      cy.url().should('include', '/dashboard')
      cy.url().should('include', 'error=access_denied')

      cy.log('✅ Editor correctly blocked from Dev Zone')
    })

    it('EDIT_ROLE_009: Editor UI does not show Superadmin button', () => {
      allure.severity('critical')

      cy.visit('/dashboard')

      // Superadmin button should NOT exist in toolbar/header for Editor
      cy.get('[data-cy="sector7-button"]').should('not.exist')
      cy.get('[data-cy="admin-toolbar"]').should('not.exist')

      cy.log('✅ Superadmin button not visible for Editor')
    })

    it('EDIT_ROLE_010: Editor UI does not show Dev Zone button', () => {
      allure.severity('critical')

      cy.visit('/dashboard')

      // Dev Zone button should NOT exist for Editor
      cy.get('[data-cy="dev-zone-button"]').should('not.exist')

      cy.log('✅ Dev Zone button not visible for Editor')
    })
  })

  after(() => {
    cy.log('✅ Editor role restriction tests completed')
  })
})
