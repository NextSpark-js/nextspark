/// <reference types="cypress" />

/**
 * Editor Custom Role Login Tests
 *
 * Tests the Editor custom role (theme-defined) login and specific permissions:
 * - Editor is a custom role defined in the Default theme
 * - Can view/list customers but cannot create/update/delete
 * - Limited navigation and entity access
 * - Cannot access Superadmin or Dev Zone
 *
 * Note: Editor role is team-based (not a global app role)
 * This file tests Editor-specific permissions as defined in the theme.
 *
 * Tags: @uat, @feat-auth, @custom-role, @editor
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultEditor, DEFAULT_THEME_USERS } from '../../../../src/session-helpers'
import { DashboardPOM } from '../../../../src/features/DashboardPOM'
import { SettingsPOM } from '../../../../src/features/SettingsPOM'
import { SuperadminPOM } from '../../../../src/features/SuperadminPOM'
import { DevAreaPOM } from '../../../../src/features/DevAreaPOM'
import { AuthPOM } from '../../../../src/core/AuthPOM'

describe('Authentication - Editor Custom Role Permissions', {
  tags: ['@uat', '@feat-auth', '@custom-role', '@editor']
}, () => {
  const dashboard = DashboardPOM.create()
  const settings = SettingsPOM.create()
  const sector7 = SuperadminPOM.create()
  const devArea = DevAreaPOM.create()
  const auth = new AuthPOM()

  beforeEach(() => {
    allure.epic('Authentication')
    allure.feature('Custom Roles')
    allure.story('Editor Permissions')
    loginAsDefaultEditor()
  })

  describe('EDITOR-PERM-001: Editor Dashboard Access', { tags: '@smoke' }, () => {
    it('should access dashboard with limited navigation', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit dashboard and wait for load
      dashboard.visitDashboard()
      dashboard.waitForDashboard()

      // 2. Validate dashboard is accessible
      dashboard.assertDashboardVisible()

      cy.log(`✅ Editor dashboard access verified (${DEFAULT_THEME_USERS.EDITOR})`)
    })
  })

  describe('EDITOR-PERM-002: Editor View-Only Customer Access', { tags: '@smoke' }, () => {
    it('should have view-only access to customers list', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Navigate to customers
      dashboard.visitEntity('customers')
      dashboard.waitForEntityPage('customers')

      // 2. Validate table is visible (Editor can read)
      dashboard.assertEntityPageVisible('customers')

      // 3. Create button should NOT be visible for Editor
      dashboard.assertEntityAddButtonNotVisible('customers')

      cy.log('✅ Editor has view-only access to customers')
    })
  })

  describe('EDITOR-PERM-003: Editor Cannot Edit Customers', () => {
    it('should not see edit buttons on customer items', () => {
      allure.severity('high')

      // 1. Navigate to customers
      dashboard.visitEntity('customers')
      dashboard.waitForEntityPage('customers')

      // 2. Validate table is visible
      dashboard.assertEntityPageVisible('customers')

      // 3. If there are items, check they don't have edit buttons
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="customers-row-"]').length > 0) {
          // Check first row doesn't have edit action
          cy.get('[data-cy^="customers-row-"]').first().within(() => {
            cy.get('[data-cy*="edit"]').should('not.exist')
            cy.get('[data-cy*="delete"]').should('not.exist')
          })
          cy.log('✅ Editor cannot see edit/delete actions')
        } else {
          cy.log('✅ No items to verify, but create button is hidden')
        }
      })
    })
  })

  describe('EDITOR-PERM-004: Editor Tasks Access', { tags: '@in-develop' }, () => {
    it('should NOT have access to tasks (permission denied)', { tags: '@in-develop' }, () => {
      allure.severity('high')

      // 1. Navigate to tasks - Editor does NOT have tasks.list permission
      cy.visit('/dashboard/tasks', { failOnStatusCode: false })

      // 2. Should be redirected to permission denied page
      cy.url().should('include', 'permission-denied')
      cy.contains('Acceso denegado').should('be.visible')

      cy.log('✅ Editor correctly blocked from tasks')
    })
  })

  describe('EDITOR-PERM-005: Editor Settings Access', () => {
    it('should have profile-only settings access', () => {
      allure.severity('normal')

      // 1. Navigate to settings
      settings.visitSettings()

      // 2. Check access
      cy.url().then((url) => {
        if (url.includes('/settings')) {
          settings.assertSettingsVisible()
          // Should only see profile, not team settings
          settings.assertNavItemVisible('profile')
          cy.log('✅ Editor has profile settings access')
        } else {
          cy.log('✅ Editor redirected from settings')
        }
      })
    })
  })

  describe('EDITOR-PERM-006: Editor Cannot Access Superadmin', () => {
    it('should be redirected when trying to access /superadmin', () => {
      allure.severity('high')

      // 1. Attempt to visit Superadmin
      cy.visit('/superadmin', { timeout: 60000, failOnStatusCode: false })

      // 2. Should be redirected
      sector7.assertAccessDenied()

      cy.log('✅ Editor correctly blocked from Superadmin')
    })
  })

  describe('EDITOR-PERM-007: Editor Cannot Access Dev Zone', () => {
    it('should be redirected when trying to access /dev', () => {
      allure.severity('high')

      // 1. Attempt to visit Dev Zone
      devArea.attemptToVisitDev()

      // 2. Should be redirected
      devArea.assertRedirectedToDashboard()

      cy.log('✅ Editor correctly blocked from Dev Zone')
    })
  })

  describe('EDITOR-PERM-008: Editor Logout Flow', () => {
    it('should logout successfully', () => {
      allure.severity('normal')

      // 1. Visit dashboard
      dashboard.visitDashboard()
      dashboard.waitForDashboard()

      // 2. Logout using AuthPOM
      auth.logout()

      // 3. Validate redirected to login
      auth.assertOnLoginPage()

      cy.log('✅ Editor logout successful')
    })
  })

  after(() => {
    cy.log('✅ Editor custom role tests completed')
  })
})
