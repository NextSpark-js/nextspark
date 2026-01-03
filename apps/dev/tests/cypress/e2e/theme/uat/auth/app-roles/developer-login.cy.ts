/// <reference types="cypress" />

/**
 * Developer App Role Login Tests
 *
 * Tests the Developer app role login and specific access:
 * - Login as developer@nextspark.dev
 * - Access to /dev zone
 * - Access to /superadmin (inherited)
 * - No team context required (global role)
 *
 * Tags: @uat, @feat-auth, @app-role, @developer
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultDeveloper, CORE_USERS } from '../../../../src/session-helpers'

describe('Authentication - Developer App Role', {
  tags: ['@uat', '@feat-auth', '@app-role', '@developer']
}, () => {
  beforeEach(() => {
    allure.epic('Authentication')
    allure.feature('App Roles')
    allure.story('Developer Login')
  })

  describe('DEV-LOGIN-001: Developer Login and Dev Zone Access', { tags: '@smoke' }, () => {
    it('should login as developer and access /dev zone', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Login as Developer
      loginAsDefaultDeveloper()

      // 2. Visit Dev Zone
      cy.visit('/dev', { timeout: 60000 })

      // 3. Validate access to Dev Zone
      cy.url().should('include', '/dev')
      cy.get('[data-cy="dev-home-page"]').should('be.visible')

      cy.log(`✅ Developer login successful (${CORE_USERS.DEVELOPER})`)
      cy.log('✅ Dev Zone access granted')
    })
  })

  describe('DEV-LOGIN-002: Developer Access to Style Gallery', { tags: '@smoke' }, () => {
    it('should access /dev/style page', { tags: '@smoke' }, () => {
      allure.severity('normal')

      // 1. Login as Developer
      loginAsDefaultDeveloper()

      // 2. Visit Style Gallery
      cy.visit('/dev/style', { timeout: 60000 })

      // 3. Validate access
      cy.url().should('include', '/dev/style')
      cy.get('[data-cy="dev-style-page"]').should('be.visible')

      cy.log('✅ Style Gallery access granted')
    })
  })

  describe('DEV-LOGIN-003: Developer Access to Test Cases', { tags: '@smoke' }, () => {
    it('should access /dev/tests page', { tags: '@smoke' }, () => {
      allure.severity('normal')

      // 1. Login as Developer
      loginAsDefaultDeveloper()

      // 2. Visit Test Cases viewer
      cy.visit('/dev/tests', { timeout: 60000 })

      // 3. Validate access
      cy.url().should('include', '/dev/tests')
      cy.get('[data-cy="dev-tests-page"]').should('be.visible')

      cy.log('✅ Test Cases viewer access granted')
    })
  })

  describe('DEV-LOGIN-004: Developer Access to Config Viewer', { tags: '@smoke' }, () => {
    it('should access /dev/config page', { tags: '@smoke' }, () => {
      allure.severity('normal')

      // 1. Login as Developer
      loginAsDefaultDeveloper()

      // 2. Visit Config Viewer
      cy.visit('/dev/config', { timeout: 60000 })

      // 3. Validate access
      cy.url().should('include', '/dev/config')
      cy.get('[data-cy="dev-config-page"]').should('be.visible')

      cy.log('✅ Config Viewer access granted')
    })
  })

  describe('DEV-LOGIN-005: Developer Inherited Superadmin Access', () => {
    it('should have access to /superadmin (inherited from superadmin)', () => {
      allure.severity('high')

      // 1. Login as Developer
      loginAsDefaultDeveloper()

      // 2. Visit Superadmin
      cy.visit('/superadmin', { timeout: 60000 })

      // 3. Validate access to Superadmin
      cy.url().should('include', '/superadmin')
      cy.get('[data-cy="sector7-container"]').should('be.visible')

      cy.log('✅ Superadmin access granted (inherited privilege)')
    })
  })

  describe('DEV-LOGIN-006: Developer Logout Flow', () => {
    it('should logout successfully and redirect to login', () => {
      allure.severity('normal')

      // 1. Login as Developer
      loginAsDefaultDeveloper()

      // 2. Visit dashboard
      cy.visit('/dashboard', { timeout: 60000 })
      cy.url().should('include', '/dashboard')

      // 3. Logout via user menu
      cy.get('[data-cy="topnav-user-menu-trigger"]').click()
      cy.get('[data-cy="topnav-menu-signOut"]').should('be.visible').click()

      // 4. Validate redirected to login
      cy.url().should('include', '/login')

      cy.log('✅ Developer logout successful')
    })
  })

  after(() => {
    cy.log('✅ Developer app role tests completed')
  })
})
