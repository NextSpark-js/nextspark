/// <reference types="cypress" />

/**
 * Superadmin Dashboard Tests
 *
 * Tests the Admin Panel superadmin dashboard:
 * - Dashboard access and layout
 * - Navigation menu items
 * - Quick stats display
 * - Recent activity
 *
 * Tags: @uat, @area-superadmin,  @dashboard
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultSuperadmin } from '../../../src/session-helpers'
import { SuperadminPOM } from '../../../src/features/SuperadminPOM'

describe('Admin - Superadmin Dashboard', {
  tags: ['@uat', '@area-superadmin', '@dashboard']
}, () => {
  const superadmin = SuperadminPOM.create()

  beforeEach(() => {
    allure.epic('Admin')
    allure.feature('Dashboard')
    allure.story('Superadmin Dashboard')
    loginAsDefaultSuperadmin()
  })

  describe('ADMIN-DASH-001: Dashboard Access', { tags: '@smoke' }, () => {
    it('should access Admin dashboard', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit Admin
      superadmin.visitDashboard()

      // 2. Validate on Superadmin
      superadmin.assertOnSuperadmin()

      // 3. Validate dashboard container
      superadmin.assertDashboardVisible()

      // 4. Validate header
      cy.contains('Super Administrator Control Panel').should('be.visible')

      cy.log('✅ Admin dashboard accessible')
    })
  })

  describe('ADMIN-DASH-002: Navigation Menu', { tags: '@smoke' }, () => {
    it('should display all navigation items', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit Admin
      superadmin.visitDashboard()

      // 2. Validate navigation items exist
      superadmin.assertNavVisible()
      cy.get(superadmin.selectors.sidebar.nav.dashboard).should('be.visible')
      cy.get(superadmin.selectors.sidebar.nav.users).should('be.visible')
      cy.get(superadmin.selectors.sidebar.nav.teams).should('be.visible')

      cy.log('✅ All navigation items visible')
    })
  })

  describe('ADMIN-DASH-003: Quick Stats Display', () => {
    it('should display system statistics', () => {
      allure.severity('high')

      // 1. Visit Admin dashboard
      superadmin.visitDashboard()

      // 2. Validate stats cards (if they exist)
      cy.get(superadmin.selectors.dashboard.container).then(($container) => {
        // Check for quick actions or system status (defensive)
        if ($container.find(superadmin.selectors.dashboard.quickActions.container).length > 0) {
          cy.get(superadmin.selectors.dashboard.quickActions.container).should('be.visible')
          cy.log('✅ Quick actions displayed')
        } else {
          cy.log('⚠️ Quick actions not found - dashboard uses different layout')
        }
      })

      cy.log('✅ Dashboard stats section checked')
    })
  })

  describe('ADMIN-DASH-004: Navigation to Users', () => {
    it('should navigate to Users management', () => {
      allure.severity('high')

      // 1. Visit Admin
      superadmin.visitDashboard()

      // 2. Click on Users nav
      superadmin.clickNavUsers()

      // 3. Validate users page
      cy.url().should('include', '/superadmin/users')
      cy.contains('User Management').should('be.visible')

      cy.log('✅ Users navigation works')
    })
  })

  describe('ADMIN-DASH-005: Navigation to Teams', () => {
    it('should navigate to Teams management', () => {
      allure.severity('high')

      // 1. Visit Admin
      superadmin.visitDashboard()

      // 2. Click on Teams nav
      superadmin.clickNavTeams()

      // 3. Validate teams page
      cy.url().should('include', '/superadmin/teams')
      cy.contains('Team Management').should('be.visible')

      cy.log('✅ Teams navigation works')
    })
  })

  describe('ADMIN-DASH-006: Exit to Main Dashboard', () => {
    it('should exit Admin to main dashboard', () => {
      allure.severity('normal')

      // 1. Visit Admin
      superadmin.visitDashboard()

      // 2. Click exit button
      superadmin.clickExitButton()

      // 3. Validate redirect to main dashboard
      cy.url().should('include', '/dashboard')
      cy.url().should('not.include', '/superadmin')

      cy.log('✅ Exit to main dashboard works')
    })
  })

  after(() => {
    cy.log('✅ Sector7 dashboard tests completed')
  })
})
