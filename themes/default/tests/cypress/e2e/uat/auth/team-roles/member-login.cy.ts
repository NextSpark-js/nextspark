/// <reference types="cypress" />

/**
 * Member Team Role Login Tests
 *
 * Tests the Member team role login and specific restrictions:
 * - Read-only access to most entities
 * - Cannot create/update/delete (restricted)
 * - Limited navigation
 * - No settings or billing access
 * - Cannot access /dev or /superadmin (app roles only)
 *
 * Note: Basic login is tested in login-logout.cy.ts
 * This file focuses on Member-specific restrictions.
 *
 * Tags: @uat, @feat-auth, @team-role, @member
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultMember, DEFAULT_THEME_USERS } from '../../../../src/session-helpers'
import { DashboardPOM } from '../../../../src/features/DashboardPOM'
import { SettingsPOM } from '../../../../src/features/SettingsPOM'
import { SuperadminPOM } from '../../../../src/features/SuperadminPOM'
import { DevAreaPOM } from '../../../../src/features/DevAreaPOM'

describe('Authentication - Member Team Role Restrictions', {
  tags: ['@uat', '@feat-auth', '@team-role', '@member']
}, () => {
  const dashboard = DashboardPOM.create()
  const settings = SettingsPOM.create()
  const sector7 = SuperadminPOM.create()
  const devArea = DevAreaPOM.create()

  beforeEach(() => {
    allure.epic('Authentication')
    allure.feature('Team Roles')
    allure.story('Member Restrictions')
    loginAsDefaultMember()
  })

  describe('MEMBER-PERM-001: Member Dashboard Access', { tags: '@smoke' }, () => {
    it('should access dashboard with limited navigation', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit dashboard and wait for load
      dashboard.visitDashboard()
      dashboard.waitForDashboard()

      // 2. Validate dashboard is accessible
      dashboard.assertDashboardVisible()

      cy.log(`✅ Member dashboard access verified (${DEFAULT_THEME_USERS.MEMBER})`)
    })
  })

  describe('MEMBER-PERM-002: Member Read-Only Entity Access', { tags: '@smoke' }, () => {
    it('should have read-only access to customers', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Navigate to customers
      dashboard.visitEntity('customers')
      dashboard.waitForEntityPage('customers')

      // 2. Validate table is visible (Member can read)
      dashboard.assertEntityPageVisible('customers')

      // 3. Create button should NOT be visible for Member
      dashboard.assertEntityAddButtonNotVisible('customers')

      cy.log('✅ Member has read-only access to customers')
    })
  })

  describe('MEMBER-PERM-003: Member Create Permissions per Entity', () => {
    it('should have entity-specific create permissions', () => {
      allure.severity('high')

      // 1. Check customers page - Member CANNOT create customers
      // (customers.create roles: ['owner', 'admin'])
      dashboard.visitEntity('customers')
      dashboard.waitForEntityPage('customers')
      dashboard.assertEntityAddButtonNotVisible('customers')

      // 2. Check tasks page - Member CAN create tasks
      // (tasks.create roles: ['owner', 'admin', 'member'])
      dashboard.visitEntity('tasks')
      dashboard.waitForEntityPage('tasks')
      dashboard.assertEntityAddButtonVisible('tasks')

      cy.log('✅ Member has correct entity-specific create permissions')
    })
  })

  describe('MEMBER-PERM-004: Member Settings Restricted', () => {
    it('should have limited or no settings access', () => {
      allure.severity('high')

      // 1. Navigate to settings
      settings.visitSettings()

      // 2. Check access
      cy.url().then((url) => {
        if (url.includes('/settings')) {
          // If accessible, should only see profile
          settings.assertSettingsVisible()
          settings.assertNavItemVisible('profile')
          // Team nav should not be visible
          settings.assertNavItemNotVisible('team')
          cy.log('✅ Member has limited settings access (profile only)')
        } else {
          cy.log('✅ Member redirected from settings')
        }
      })
    })
  })

  describe('MEMBER-PERM-005: Member Billing Blocked', () => {
    it('should not have access to billing', () => {
      allure.severity('high')

      // 1. Navigate to billing
      cy.visit('/dashboard/settings/billing', { timeout: 60000, failOnStatusCode: false })

      // 2. Should be redirected or access denied
      cy.url().should('not.include', '/billing')

      cy.log('✅ Member correctly blocked from billing')
    })
  })

  describe('MEMBER-PERM-006: Member Cannot Access Superadmin', () => {
    it('should be redirected when trying to access /superadmin', () => {
      allure.severity('high')

      // 1. Attempt to visit Superadmin
      cy.visit('/superadmin', { timeout: 60000, failOnStatusCode: false })

      // 2. Should be redirected
      sector7.assertAccessDenied()

      cy.log('✅ Member correctly blocked from Superadmin')
    })
  })

  describe('MEMBER-PERM-007: Member Cannot Access Dev Zone', () => {
    it('should be redirected when trying to access /dev', () => {
      allure.severity('high')

      // 1. Attempt to visit Dev Zone
      devArea.attemptToVisitDev()

      // 2. Should be redirected
      devArea.assertRedirectedToDashboard()

      cy.log('✅ Member correctly blocked from Dev Zone')
    })
  })

  after(() => {
    cy.log('✅ Member team role tests completed')
  })
})
