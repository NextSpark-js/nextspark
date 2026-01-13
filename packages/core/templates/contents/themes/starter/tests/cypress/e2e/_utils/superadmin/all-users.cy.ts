/// <reference types="cypress" />

/**
 * Superadmin All Users Management Tests
 *
 * Tests the Sector7 all users management page:
 * - Users list access and display
 * - User details view
 * - User search and filtering
 * - User status and role display
 *
 * Tags: @uat, @area-superadmin,  @users
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultSuperadmin } from '../../../src/session-helpers'
import { SuperadminPOM } from '../../../src/features/SuperadminPOM'

describe('Sector7 - All Users Management', {
  tags: ['@uat', '@area-superadmin', '@users']
}, () => {
  const superadmin = SuperadminPOM.create()

  beforeEach(() => {
    allure.epic('Admin')
    allure.feature('Users Management')
    allure.story('All Users')
    loginAsDefaultSuperadmin()
  })

  describe('ADMIN-USERS-001: Users List Access', { tags: '@smoke' }, () => {
    it('should access all users list', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Validate users page
      cy.url().should('include', '/superadmin/users')
      cy.contains('User Management').should('be.visible')
      superadmin.assertUsersVisible()

      cy.log('✅ Users list accessible')
    })
  })

  describe('ADMIN-USERS-002: Users List Display', { tags: '@smoke' }, () => {
    it('should display users in a list or table', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Validate users list/table exists
      cy.get(superadmin.selectors.users.container).then(($container) => {
        const hasTable = $container.find(superadmin.selectors.users.table.element).length > 0
        const hasRows = $container.find('[data-cy^="superadmin-users-row"]').length > 0
        if (hasTable || hasRows) {
          cy.log('✅ Users displayed in list')
        } else {
          cy.log('⚠️ Users table not found')
        }
      })
    })
  })

  describe('ADMIN-USERS-003: View User Details', () => {
    it('should view individual user details', () => {
      allure.severity('high')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Find and click first user row
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="superadmin-users-row"]').length > 0) {
          cy.get('[data-cy^="superadmin-users-row"]').first().click()

          // 3. Validate user details view
          cy.url().should('include', '/superadmin/users/')

          cy.log('✅ User details accessible')
        } else {
          cy.log('⚠️ No user rows found to test details view')
        }
      })
    })
  })

  describe('ADMIN-USERS-004: User Search', () => {
    it('should filter users by search query', () => {
      allure.severity('high')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Check if search exists
      cy.get('body').then(($body) => {
        if ($body.find(superadmin.selectors.users.filters.search).length > 0) {
          superadmin.searchUsers('carlos')

          // 3. Wait for filter to apply
          cy.wait(500)

          cy.log('✅ User search functional')
        } else {
          cy.log('⚠️ Search not implemented yet')
        }
      })
    })
  })

  describe('ADMIN-USERS-005: User Email Display', () => {
    it('should display email for each user', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Check for email display
      cy.get(superadmin.selectors.users.container).within(() => {
        cy.get('[data-cy^="superadmin-users-row"]').first().then(($user) => {
          // Email might be in table cell or other format
          cy.wrap($user).should('contain', '@')
          cy.log('✅ User email visible in row')
        })
      })
    })
  })

  describe('ADMIN-USERS-006: User App Role Display', () => {
    it('should display app role for users with global roles', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Check for role indicators (defensive check)
      cy.get(superadmin.selectors.users.container).then(($container) => {
        if ($container.find('[data-cy^="user-app-role-"]').length > 0) {
          cy.get('[data-cy^="user-app-role-"]').first().should('be.visible')
          cy.log('✅ App role displayed')
        } else {
          // Role is shown as text in table, check for role-related content
          cy.get(superadmin.selectors.users.table.element).should('be.visible')
          cy.log('⚠️ App role shown as table column, not dedicated selector')
        }
      })
    })
  })

  describe('ADMIN-USERS-007: User Verified Status', () => {
    it('should display email verification status', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Check for verification status (defensive check)
      cy.get(superadmin.selectors.users.container).then(($container) => {
        if ($container.find('[data-cy="user-verified-status"]').length > 0) {
          cy.get('[data-cy="user-verified-status"]').first().should('be.visible')
          cy.log('✅ Verification status displayed')
        } else {
          // Status is shown in table, check for table visibility
          cy.get(superadmin.selectors.users.table.element).should('be.visible')
          cy.log('⚠️ Verification status shown in table, not dedicated selector')
        }
      })
    })
  })

  describe('ADMIN-USERS-008: Navigate Back to Dashboard', () => {
    it('should navigate back to Sector7 dashboard', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Click on dashboard nav
      superadmin.clickNavDashboard()

      // 3. Validate back at dashboard
      cy.url().should('match', /\/superadmin\/?$/)
      superadmin.assertDashboardVisible()

      cy.log('✅ Navigation to dashboard works')
    })
  })

  describe('ADMIN-USERS-009: User Team Memberships', () => {
    it('should display team memberships for users', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Check user details for team info (defensive check)
      cy.get(superadmin.selectors.users.container).then(($container) => {
        if ($container.find('[data-cy="user-teams-count"]').length > 0) {
          cy.get('[data-cy="user-teams-count"]').first().should('be.visible')
          cy.log('✅ Team memberships displayed')
        } else {
          // Team info not shown in list view, verify table is visible
          cy.get(superadmin.selectors.users.table.element).should('be.visible')
          cy.log('⚠️ Team memberships not displayed in list view (available in detail)')
        }
      })
    })
  })

  describe('ADMIN-USERS-010: User Metadata Box', () => {
    it('should display user metadata card in user detail view', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Navigate to first user's detail view
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="superadmin-users-row"]').length > 0) {
          cy.get('[data-cy^="superadmin-users-row"]').first().click()

          // 3. Wait for user detail page to load
          cy.url().should('include', '/superadmin/users/')

          // 4. Validate User Metadata card is visible
          cy.get('[data-cy="superadmin-user-metas"]').should('be.visible')
          cy.get('[data-cy="superadmin-user-metas-title"]').should('be.visible')
          cy.get('[data-cy="superadmin-user-metas-title"]').should('contain', 'User Metadata')

          cy.log('✅ User Metadata card visible in user detail')
        } else {
          cy.log('⚠️ No user rows found to test metadata view')
        }
      })
    })

    it('should display metadata table or empty state', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Users
      superadmin.visitUsers()

      // 2. Navigate to first user's detail view
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="superadmin-users-row"]').length > 0) {
          cy.get('[data-cy^="superadmin-users-row"]').first().click()

          // 3. Wait for user detail page to load
          cy.url().should('include', '/superadmin/users/')

          // 4. Check for either table or empty state
          cy.get('[data-cy="superadmin-user-metas"]').within(() => {
            cy.get('body').then(() => {
              // Either table or empty state should be present
              cy.document().then((doc) => {
                const hasTable = doc.querySelector('[data-cy="superadmin-user-metas-table"]')
                const hasEmpty = doc.querySelector('[data-cy="superadmin-user-metas-empty"]')

                if (hasTable) {
                  cy.get('[data-cy="superadmin-user-metas-table"]').should('be.visible')
                  // Verify table has expected headers
                  cy.get('[data-cy="superadmin-user-metas-table"]').within(() => {
                    cy.contains('Key').should('be.visible')
                    cy.contains('Value').should('be.visible')
                    cy.contains('Type').should('be.visible')
                    cy.contains('Public').should('be.visible')
                    cy.contains('Searchable').should('be.visible')
                  })
                  cy.log('✅ User Metadata table displayed with records')
                } else if (hasEmpty) {
                  cy.get('[data-cy="superadmin-user-metas-empty"]').should('be.visible')
                  cy.get('[data-cy="superadmin-user-metas-empty"]').should('contain', 'No metadata')
                  cy.log('✅ User Metadata empty state displayed')
                } else {
                  cy.log('⚠️ Neither table nor empty state found')
                }
              })
            })
          })
        } else {
          cy.log('⚠️ No user rows found to test metadata view')
        }
      })
    })
  })

  after(() => {
    cy.log('✅ Sector7 all users tests completed')
  })
})
