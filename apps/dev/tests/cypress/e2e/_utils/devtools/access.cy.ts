/// <reference types="cypress" />

import * as allure from 'allure-cypress'
import { DevtoolsPOM } from '../../../src/features/DevtoolsPOM'
import {
  loginAsDefaultDeveloper,
  loginAsDefaultSuperadmin,
  loginAsDefaultMember,
  CORE_USERS
} from '../../../src/session-helpers'

/**
 * DevTools Access Control Tests
 *
 * Tests the role-based access control for the /devtools area:
 * - Developer users can access all /devtools routes
 * - Developer users can access /admin (inherited privileges)
 * - Superadmin users are BLOCKED from /devtools
 * - Member users are BLOCKED from /devtools
 *
 * Test Users (from session-helpers):
 * - Developer: developer@nextspark.dev (CORE_USERS.DEVELOPER)
 * - Superadmin: superadmin@nextspark.dev (CORE_USERS.SUPERADMIN)
 * - Member: emily.johnson@nextspark.dev (DEFAULT_THEME_USERS.MEMBER)
 */

describe('DevTools - Access Control', {
  tags: ['@uat', '@area-devtools', '@smoke', '@regression']
}, () => {
  const devtools = DevtoolsPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('DevTools')
    allure.story('Access Control')
  })

  describe('ACCESS-001: Developer can access /devtools', { tags: '@smoke' }, () => {
    it('should allow developer to access /devtools home page', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Login as developer
      loginAsDefaultDeveloper()

      // 2. Visit /devtools
      devtools.visitHome()

      // 3. Verify access granted
      devtools.assertOnDevtoolsHome()
      devtools.assertHomePageVisible()

      cy.log(`✅ Developer (${CORE_USERS.DEVELOPER}) can access /devtools home page`)
    })
  })

  describe('ACCESS-002: Developer can access /devtools/style', { tags: '@smoke' }, () => {
    it('should allow developer to access Style Gallery', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Login as developer
      loginAsDefaultDeveloper()

      // 2. Visit /devtools/style
      devtools.visitStyleGallery()

      // 3. Verify access granted
      devtools.assertOnStyleGallery()
      devtools.assertStylePageVisible()

      cy.log(`✅ Developer can access /devtools/style`)
    })
  })

  describe('ACCESS-003: Developer can access /devtools/tests', { tags: '@smoke' }, () => {
    it('should allow developer to access Test Cases viewer', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Login as developer
      loginAsDefaultDeveloper()

      // 2. Visit /devtools/tests
      devtools.visitTestCases()

      // 3. Verify access granted
      devtools.assertOnTestCases()
      devtools.assertTestsPageVisible()

      cy.log(`✅ Developer can access /devtools/tests`)
    })
  })

  describe('ACCESS-004: Developer can access /devtools/config', { tags: '@smoke' }, () => {
    it('should allow developer to access Config Viewer', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Login as developer
      loginAsDefaultDeveloper()

      // 2. Visit /devtools/config
      devtools.visitConfig()

      // 3. Verify access granted
      devtools.assertOnConfig()
      devtools.assertConfigPageVisible()

      cy.log(`✅ Developer can access /devtools/config`)
    })
  })

  describe('ACCESS-005: Developer can access /superadmin (inherited)', () => {
    it('should allow developer to access Superadmin area', () => {
      allure.severity('high')

      // 1. Login as developer
      loginAsDefaultDeveloper()

      // 2. Visit /superadmin
      cy.visit('/superadmin')

      // 3. Verify access granted (developer inherits superadmin privileges)
      devtools.assertOnSuperadmin()
      cy.get('[data-cy="superadmin-container"]').should('be.visible')

      cy.log(`✅ Developer can access /superadmin (inherited superadmin privileges)`)
    })
  })

  describe('ACCESS-006: Superadmin is BLOCKED from /devtools', { tags: '@smoke' }, () => {
    it('should redirect superadmin to /dashboard when attempting to access /devtools', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Login as superadmin
      loginAsDefaultSuperadmin()

      // 2. Attempt to visit /devtools (should be blocked)
      cy.visit('/devtools', { failOnStatusCode: false })

      // 3. Verify redirected to /dashboard (access denied)
      devtools.assertRedirectedToDashboard()

      // 4. Should show access_denied error in URL
      cy.url().should('include', 'error=access_denied')

      cy.log(`✅ Superadmin (${CORE_USERS.SUPERADMIN}) correctly blocked from /devtools`)
    })
  })

  describe('ACCESS-007: Member is BLOCKED from /devtools', { tags: '@smoke' }, () => {
    it('should redirect member to /dashboard when attempting to access /devtools', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Login as member
      loginAsDefaultMember()

      // 2. Attempt to visit /devtools (should be blocked)
      cy.visit('/devtools', { failOnStatusCode: false })

      // 3. Verify redirected to /dashboard (access denied)
      devtools.assertRedirectedToDashboard()

      // 4. Should show access_denied error in URL
      cy.url().should('include', 'error=access_denied')

      cy.log(`✅ Member correctly blocked from /devtools`)
    })
  })

  after(() => {
    cy.log('✅ DevTools access control tests completed')
  })
})
