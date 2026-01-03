/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { CustomersPOM } from '../../../src/entities/CustomersPOM'
import { TasksPOM } from '../../../src/entities/TasksPOM'
import { loginAsDefaultMember } from '../../../src/session-helpers'

describe('Member Role - Permission Restrictions', {
  tags: ['@uat', '@feat-teams', '@security', '@role-member', '@regression']
}, () => {
  const customers = CustomersPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Permissions')
    allure.story('Member Restrictions')
    customers.setupApiIntercepts()
    loginAsDefaultMember()
  })

  describe('UI Restrictions - Buttons Hidden/Disabled', { tags: '@smoke' }, () => {
    it('PERM_UI_001: Create Customer button not visible for Member', { tags: '@smoke' }, () => {
      allure.severity('critical')

      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      // Create button should not exist for Member (no create permission)
      cy.get(customers.selectors.addButton).should('not.exist')

      cy.log('✅ Create button correctly hidden for Member')
    })

    it('PERM_UI_002: Delete Customer buttons not visible for Member', () => {
      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Delete action buttons should NOT exist for Member
          cy.get(customers.selectors.rowActionDeleteGeneric).should('not.exist')
          cy.log('✅ Delete buttons correctly hidden for Member')
        } else {
          cy.log('⚠️ No customers to check delete permission')
        }
      })
    })

    it('PERM_UI_003: Edit Customer buttons not visible for Member', () => {
      // NOTE: Based on real system behavior, Member CANNOT edit customers
      customers.visitList()
      customers.api.waitForList()
      customers.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Edit action buttons should NOT exist for Member (no edit permission)
          cy.get(customers.selectors.rowActionEditGeneric).should('not.exist')
          cy.log('✅ Edit buttons correctly hidden for Member')
        } else {
          cy.log('⚠️ No customers to check edit permission')
        }
      })
    })
  })

  describe('URL Access Restrictions - Permission Denied Component', () => {
    it('PERM_URL_001: Direct URL to /customers/create shows Permission Denied', () => {
      // Direct access to create route should show permission denied
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

    it('PERM_URL_002: Delete button not visible on customer detail for Member', () => {
      // NOTE: /delete URL route doesn't exist - delete is done from detail page
      // We verify that the delete button is not visible on the detail page
      customers.visitList()
      customers.api.waitForList()

      cy.get('body').then($body => {
        if ($body.find(customers.selectors.rowGeneric).length > 0) {
          // Click on first customer to go to detail
          cy.get(customers.selectors.rowGeneric).first().click()

          // Wait for detail page (without waiting for edit button since Member can't edit)
          cy.url().should('match', new RegExp(`/dashboard/${customers.entitySlug}/[a-z0-9-]+`))

          // Delete button should NOT exist for Member
          cy.get(customers.selectors.deleteButton).should('not.exist')

          cy.log('✅ Delete button correctly hidden on detail page for Member')
        } else {
          cy.log('⚠️ No customers to test delete restriction')
        }
      })
    })

    it('PERM_URL_003: Direct URL to /customers/[id]/edit shows Permission Denied for Member', () => {
      // NOTE: Based on real system behavior, Member CANNOT edit customers
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
                    // App might redirect to permission-denied page or detail view
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

    it('PERM_URL_004: Direct URL to /tasks routes is ALLOWED for Member', () => {
      // Member has full access to tasks
      const tasks = TasksPOM.create()
      tasks.setupApiIntercepts()

      cy.visit(`/dashboard/${tasks.entitySlug}/create`)

      // Should NOT show permission denied
      cy.get('[data-cy="permission-denied"]').should('not.exist')

      // Should show task form
      tasks.waitForForm()

      cy.log('✅ Tasks routes correctly accessible for Member')
    })
  })

  describe('Permission Messages - User Feedback', () => {
    it('PERM_MSG_001: Permission denied message is user-friendly', () => {
      cy.visit(`/dashboard/${customers.entitySlug}/create`)

      cy.get('body').then($body => {
        if ($body.find('[data-cy="permission-denied"]').length > 0) {
          // Check for user-friendly message
          cy.get('[data-cy="permission-denied"]').within(() => {
            cy.contains(/permission|access|not allowed/i).should('be.visible')
          })

          cy.log('✅ User-friendly permission message shown')
        } else {
          // Redirected to permission-denied page
          cy.url().should('include', 'permission-denied')
          cy.log('⚠️ Redirected to permission denied page (check message there)')
        }
      })
    })
  })

  after(() => {
    cy.log('✅ Permission restriction tests completed')
  })
})
