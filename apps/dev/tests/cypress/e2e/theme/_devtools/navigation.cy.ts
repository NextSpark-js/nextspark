/// <reference types="cypress" />

import * as allure from 'allure-cypress'
import { DevtoolsPOM } from '../../src/features/DevtoolsPOM'
import { loginAsDefaultDeveloper } from '../../src/session-helpers'

/**
 * DevTools Navigation Tests
 *
 * Tests the navigation functionality within the /devtools area:
 * - Sidebar navigation items work correctly
 * - All nav links are clickable and navigate to correct pages
 * - Exit links (Dashboard, Admin) work
 * - URL changes reflect navigation
 *
 * Test User:
 * - Developer: developer@nextspark.dev (via loginAsDefaultDeveloper)
 */

describe('DevTools - Navigation', {
  tags: ['@uat', '@feat-devtools', '@regression']
}, () => {
  const devtools = DevtoolsPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('DevTools')
    allure.story('Navigation')

    // Login as developer before each test
    loginAsDefaultDeveloper()
  })

  describe('NAV-001: Sidebar navigation works', () => {
    it('should display all sidebar navigation items', () => {
      allure.severity('high')

      // 1. Visit /devtools home
      devtools.visitHome()

      // 2. Verify all navigation items are visible
      devtools.assertSidebarNavigationVisible()

      // 3. Verify exit links are visible
      devtools.assertExitLinksVisible()

      cy.log(`✅ Sidebar navigation displayed correctly`)
    })
  })

  describe('NAV-002: All nav links are clickable', () => {
    it('should navigate to Style Gallery via sidebar', () => {
      allure.severity('high')

      // 1. Start at /devtools home
      devtools.visitHome()

      // 2. Click Style Gallery nav item
      devtools.clickNavStyleGallery()

      // 3. Verify navigation to /devtools/style
      devtools.assertOnStyleGallery()
      devtools.assertStylePageVisible()

      cy.log(`✅ Style Gallery navigation works`)
    })

    it('should navigate to Test Cases via sidebar', () => {
      allure.severity('high')

      // 1. Start at /devtools home
      devtools.visitHome()

      // 2. Click Test Cases nav item
      devtools.clickNavTestCases()

      // 3. Verify navigation to /devtools/tests
      devtools.assertOnTestCases()
      devtools.assertTestsPageVisible()

      cy.log(`✅ Test Cases navigation works`)
    })

    it('should navigate to Config Viewer via sidebar', () => {
      allure.severity('high')

      // 1. Start at /devtools home
      devtools.visitHome()

      // 2. Click Config nav item
      devtools.clickNavConfig()

      // 3. Verify navigation to /devtools/config
      devtools.assertOnConfig()
      devtools.assertConfigPageVisible()

      cy.log(`✅ Config Viewer navigation works`)
    })

    it('should navigate back to Home via sidebar', () => {
      allure.severity('high')

      // 1. Start at /devtools/style
      devtools.visitStyleGallery()

      // 2. Click Home nav item
      devtools.clickNavHome()

      // 3. Verify navigation to /devtools
      devtools.assertOnDevtoolsHome()
      devtools.assertHomePageVisible()

      cy.log(`✅ Home navigation works`)
    })
  })

  describe('NAV-003: Back to Dashboard link works', () => {
    it('should navigate to Dashboard when clicking exit link', () => {
      allure.severity('high')

      // 1. Start at /devtools home
      devtools.visitHome()

      // 2. Click "Exit to Dashboard" link
      devtools.clickExitToDashboard()

      // 3. Verify navigation to /dashboard
      cy.url().should('include', '/dashboard')
      cy.url().should('not.include', '/devtools')
      cy.get('[data-cy="dashboard-container"]').should('be.visible')

      cy.log(`✅ Exit to Dashboard works`)
    })
  })

  describe('NAV-004: Go to Admin link works', () => {
    it('should navigate to Admin when clicking exit link', () => {
      allure.severity('high')

      // 1. Start at /devtools home
      devtools.visitHome()

      // 2. Click "Go to Admin" link
      devtools.clickGoToAdmin()

      // 3. Verify navigation to /admin
      devtools.assertOnAdmin()
      cy.get('[data-cy="admin-container"]').should('be.visible')

      cy.log(`✅ Go to Admin works`)
    })
  })

  after(() => {
    cy.log('✅ DevTools navigation tests completed')
  })
})
