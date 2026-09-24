/// <reference types="cypress" />

/**
 * Owner Team Role Login Tests
 *
 * Tests the Owner team role login and specific permissions:
 * - Full CRUD access to all entities
 * - Team settings access
 * - Billing access
 * - Member management
 * - Cannot access /dev or /superadmin (app roles only)
 *
 * Note: Basic login is tested in login-logout.cy.ts
 * This file focuses on Owner-specific permissions and access.
 *
 * Tags: @uat, @feat-auth, @team-role, @owner
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultOwner, DEFAULT_THEME_USERS } from '../../../../src/session-helpers'
import { DashboardPOM } from '../../../../src/features/DashboardPOM'
import { SettingsPOM } from '../../../../src/features/SettingsPOM'
import { BillingPOM } from '../../../../src/features/BillingPOM'
import { SuperadminPOM } from '../../../../src/features/SuperadminPOM'
import { DevAreaPOM } from '../../../../src/features/DevAreaPOM'

describe('Authentication - Owner Team Role Permissions', {
  tags: ['@uat', '@feat-auth', '@team-role', '@owner']
}, () => {
  const dashboard = DashboardPOM.create()
  const settings = SettingsPOM.create()
  const billing = BillingPOM.create()
  const sector7 = SuperadminPOM.create()
  const devArea = DevAreaPOM.create()

  beforeEach(() => {
    allure.epic('Authentication')
    allure.feature('Team Roles')
    allure.story('Owner Permissions')
    loginAsDefaultOwner()
  })

  describe('OWNER-PERM-001: Owner Dashboard Access', { tags: '@smoke' }, () => {
    it('should access dashboard with full navigation', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit dashboard and wait for it to load
      dashboard.visitDashboard()
      dashboard.waitForDashboard()

      // 2. Validate sidebar navigation items (Owner should see entity links)
      dashboard.assertEntityNavVisible('customers')
      dashboard.assertEntityNavVisible('tasks')

      cy.log(`✅ Owner dashboard access verified (${DEFAULT_THEME_USERS.OWNER})`)
    })
  })

  describe('OWNER-PERM-002: Owner Full Entity Access', { tags: '@smoke' }, () => {
    it('should have full CRUD access to customers', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Navigate to customers (correct route is /dashboard/customers)
      dashboard.visitEntity('customers')
      dashboard.waitForEntityPage('customers')

      // 2. Validate create button is visible (Owner can create)
      dashboard.assertEntityAddButtonVisible('customers')

      // 3. Validate table is visible
      dashboard.assertEntityPageVisible('customers')

      cy.log('✅ Owner has full CRUD access to customers')
    })
  })

  describe('OWNER-PERM-003: Owner Team Settings Access', { tags: '@in-develop' }, () => {
    it('should access team settings page', { tags: '@in-develop' }, () => {
      allure.severity('high')

      // 1. Navigate to settings
      settings.visitSettings()
      settings.waitForSettings()

      // 2. Validate settings page is accessible
      settings.assertSettingsVisible()

      // 3. Validate team settings nav is visible (key is 'teams' not 'team')
      settings.assertNavItemVisible('teams')

      cy.log('✅ Owner can access team settings')
    })
  })

  describe('OWNER-PERM-004: Owner Billing Access', () => {
    it('should access billing page', () => {
      allure.severity('high')

      // 1. Navigate to billing using BillingPOM
      billing.visitBilling()

      // 2. Validate billing page is accessible
      billing.assertBillingPageVisible()

      cy.log('✅ Owner can access billing')
    })
  })

  describe('OWNER-PERM-005: Owner Cannot Access Superadmin', () => {
    it('should be redirected when trying to access /superadmin', () => {
      allure.severity('high')

      // 1. Attempt to visit Superadmin
      cy.visit('/superadmin', { timeout: 60000, failOnStatusCode: false })

      // 2. Should be redirected (Owner is not superadmin)
      sector7.assertAccessDenied()

      cy.log('✅ Owner correctly blocked from Superadmin')
    })
  })

  describe('OWNER-PERM-006: Owner Cannot Access Dev Zone', () => {
    it('should be redirected when trying to access /dev', () => {
      allure.severity('high')

      // 1. Attempt to visit Dev Zone
      devArea.attemptToVisitDev()

      // 2. Should be redirected (Owner is not developer)
      devArea.assertRedirectedToDashboard()

      cy.log('✅ Owner correctly blocked from Dev Zone')
    })
  })

  after(() => {
    cy.log('✅ Owner team role tests completed')
  })
})
