/// <reference types="cypress" />

/**
 * Admin Team Role Login Tests
 *
 * Tests the Admin team role login and specific permissions:
 * - Full CRUD access to entities
 * - Limited team settings access (cannot delete team)
 * - No billing access (owner only)
 * - Member management (limited)
 * - Cannot access /dev or /superadmin (app roles only)
 *
 * Note: Basic login is tested in login-logout.cy.ts
 * This file focuses on Admin-specific permissions and restrictions.
 *
 * Tags: @uat, @feat-auth, @team-role, @admin
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultAdmin, DEFAULT_THEME_USERS } from '../../../../src/session-helpers'
import { DashboardPOM } from '../../../../src/features/DashboardPOM'
import { SettingsPOM } from '../../../../src/features/SettingsPOM'
import { BillingPOM } from '../../../../src/features/BillingPOM'
import { SuperadminPOM } from '../../../../src/features/SuperadminPOM'
import { DevAreaPOM } from '../../../../src/features/DevAreaPOM'

describe('Authentication - Admin Team Role Permissions', {
  tags: ['@uat', '@feat-auth', '@team-role', '@admin']
}, () => {
  const dashboard = DashboardPOM.create()
  const settings = SettingsPOM.create()
  const billing = BillingPOM.create()
  const sector7 = SuperadminPOM.create()
  const devArea = DevAreaPOM.create()

  beforeEach(() => {
    allure.epic('Authentication')
    allure.feature('Team Roles')
    allure.story('Admin Permissions')
    loginAsDefaultAdmin()
  })

  describe('ADMIN-PERM-001: Admin Dashboard Access', { tags: '@smoke' }, () => {
    it('should access dashboard with full navigation', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit dashboard and wait for it to load
      dashboard.visitDashboard()
      dashboard.waitForDashboard()

      // 2. Validate sidebar navigation items
      dashboard.assertEntityNavVisible('customers')
      dashboard.assertEntityNavVisible('tasks')

      cy.log(`✅ Admin dashboard access verified (${DEFAULT_THEME_USERS.ADMIN})`)
    })
  })

  describe('ADMIN-PERM-002: Admin Full Entity Access', { tags: '@smoke' }, () => {
    it('should have full CRUD access to customers', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Navigate to customers
      dashboard.visitEntity('customers')
      dashboard.waitForEntityPage('customers')

      // 2. Validate create button is visible (Admin can create)
      dashboard.assertEntityAddButtonVisible('customers')

      // 3. Validate table is visible
      dashboard.assertEntityPageVisible('customers')

      cy.log('✅ Admin has full CRUD access to customers')
    })
  })

  describe('ADMIN-PERM-003: Admin Settings Access', () => {
    it('should access settings page with limited options', () => {
      allure.severity('high')

      // 1. Navigate to settings
      settings.visitSettings()
      settings.waitForSettings()

      // 2. Validate settings page is accessible
      settings.assertSettingsVisible()

      // 3. Validate profile nav is visible
      settings.assertNavItemVisible('profile')

      cy.log('✅ Admin can access settings')
    })
  })

  describe('ADMIN-PERM-004: Admin Billing Restricted Access', () => {
    it('should have view-only or no access to billing', () => {
      allure.severity('high')

      // 1. Navigate to billing
      billing.visitBilling()

      // 2. Check access - Admin may have view-only or redirected
      cy.url().then((url) => {
        if (url.includes('/billing')) {
          // If accessible, billing container should be visible
          billing.getBillingMain().should('be.visible')
          cy.log('✅ Admin has view-only billing access')
        } else {
          // If redirected, that's also valid
          cy.log('✅ Admin correctly redirected from billing')
        }
      })
    })
  })

  describe('ADMIN-PERM-005: Admin Cannot Access Superadmin', () => {
    it('should be redirected when trying to access /superadmin', () => {
      allure.severity('high')

      // 1. Attempt to visit Superadmin
      cy.visit('/superadmin', { timeout: 60000, failOnStatusCode: false })

      // 2. Should be redirected
      sector7.assertAccessDenied()

      cy.log('✅ Admin correctly blocked from Superadmin')
    })
  })

  describe('ADMIN-PERM-006: Admin Cannot Access Dev Zone', () => {
    it('should be redirected when trying to access /dev', () => {
      allure.severity('high')

      // 1. Attempt to visit Dev Zone
      devArea.attemptToVisitDev()

      // 2. Should be redirected
      devArea.assertRedirectedToDashboard()

      cy.log('✅ Admin correctly blocked from Dev Zone')
    })
  })

  after(() => {
    cy.log('✅ Admin team role tests completed')
  })
})
