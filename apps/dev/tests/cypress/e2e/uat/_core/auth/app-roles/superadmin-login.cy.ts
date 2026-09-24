/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { loginAsDefaultSuperadmin, CORE_USERS } from '../../../../src/session-helpers'

/**
 * SuperAdmin Login Test
 *
 * Tests the complete SuperAdmin flow:
 * 1. Login via API (using session helper)
 * 2. Access Superadmin panel
 * 3. Navigate through Users and Teams management
 * 4. Logout
 *
 * Uses: loginAsDefaultSuperadmin() from session-helpers
 * User: superadmin@nextspark.dev (core system user with global superadmin role)
 */

describe('Authentication - SuperAdmin Flow', {
  tags: ['@uat', '@feat-auth', '@security', '@regression']
}, () => {
  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Authentication')
    allure.story('SuperAdmin Access')
    loginAsDefaultSuperadmin()
  })

  describe('SUPERADMIN_001: SuperAdmin Login and Panel Access', () => {
    it('should login as superadmin, access panel, view tables, and logout', () => {
      allure.severity('critical')

      // 1. Visit dashboard (session already established)
      cy.visit('/dashboard', { timeout: 60000 })
      cy.url().should('include', '/dashboard')
      cy.log(`✅ SuperAdmin login successful (${CORE_USERS.SUPERADMIN})`)

      // 2. Validate Superadmin icon is visible (superadmin only)
      cy.get('[data-cy="topnav-superadmin"]').should('be.visible')
      cy.log('✅ Superadmin icon visible in TopNavbar')

      // 3. Navigate to Superadmin panel
      cy.get('[data-cy="topnav-superadmin"]').click()
      cy.url().should('include', '/superadmin')
      cy.contains('Super Administrator Control Panel').should('be.visible')
      cy.log('✅ Navigated to Superadmin dashboard')

      // 4. Navigate to Users table and validate
      cy.get('[data-cy="superadmin-nav-users"]').click()
      cy.url().should('include', '/superadmin/users')
      cy.contains('User Management').should('be.visible')
      cy.get('table').should('be.visible')
      cy.log('✅ Users table loaded and visible')

      // 5. Navigate to Teams table and validate
      cy.get('[data-cy="superadmin-nav-teams"]').click()
      cy.url().should('include', '/superadmin/teams')
      cy.contains('Team Management').should('be.visible')
      cy.get('table').should('be.visible')
      cy.log('✅ Teams table loaded and visible')

      // 6. Exit Superadmin back to dashboard
      cy.get('[data-cy="superadmin-sidebar-exit-to-dashboard"]').click()
      cy.url().should('include', '/dashboard')
      cy.url().should('not.include', '/superadmin')
      cy.log('✅ Exited Superadmin')

      // 7. Logout from the main dashboard
      cy.get('[data-cy="topnav-user-menu-trigger"]').click()
      cy.get('[data-cy="topnav-menu-signOut"]').should('be.visible').click()

      // Verify redirected to login
      cy.url().should('include', '/login')
      cy.log('✅ Logout successful')

      cy.log('✅ SuperAdmin flow completed successfully')
    })
  })

  after(() => {
    cy.log('✅ SuperAdmin authentication tests completed')
  })
})
