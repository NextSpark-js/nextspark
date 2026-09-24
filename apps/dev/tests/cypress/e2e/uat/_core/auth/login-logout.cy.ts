/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { DevKeyringPOM } from '../../../../src/components/DevKeyringPOM'
import { DEFAULT_THEME_USERS } from '../../../../src/session-helpers'

describe('Authentication - DevKeyring Flow', {
  tags: ['@uat', '@feat-auth', '@smoke', '@regression']
}, () => {
  const devKeyring = DevKeyringPOM.create()
  const users = DEFAULT_THEME_USERS

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Authentication')
    allure.story('DevKeyring Login')
    // Clear cookies and localStorage to ensure fresh state
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('LOGIN_001: Owner Login via DevKeyring', { tags: '@smoke' }, () => {
    it('should login as Owner and access dashboard', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit login page
      cy.visit('/login')

      // 2. Validate DevKeyring is visible
      devKeyring.validateVisible()

      // 3. Login as Owner using email
      devKeyring.quickLoginByEmail(users.OWNER)

      // 4. Validate dashboard access
      cy.url().should('include', '/dashboard')
      cy.get('[data-cy="dashboard-container"]').should('be.visible')

      cy.log(`✅ Owner login successful (${users.OWNER})`)
    })
  })

  describe('LOGIN_002: Member Login via DevKeyring', { tags: '@smoke' }, () => {
    it('should login as Member and access dashboard', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit login page
      cy.visit('/login')

      // 2. Validate DevKeyring is visible
      devKeyring.validateVisible()

      // 3. Login as Member using email
      devKeyring.quickLoginByEmail(users.MEMBER)

      // 4. Validate dashboard access
      cy.url().should('include', '/dashboard')
      cy.get('[data-cy="dashboard-container"]').should('be.visible')

      cy.log(`✅ Member login successful (${users.MEMBER})`)
    })
  })

  describe('LOGIN_003: Admin Login via DevKeyring', () => {
    it('should login as Admin and access dashboard', () => {
      // 1. Visit login page
      cy.visit('/login')

      // 2. Validate DevKeyring is visible
      devKeyring.validateVisible()

      // 3. Login as Admin using email
      devKeyring.quickLoginByEmail(users.ADMIN)

      // 4. Validate dashboard access
      cy.url().should('include', '/dashboard')
      cy.get('[data-cy="dashboard-container"]').should('be.visible')

      cy.log(`✅ Admin login successful (${users.ADMIN})`)
    })
  })

  describe('LOGOUT_001: User Logout Flow', () => {
    it('should logout successfully and redirect to login', () => {
      // Set desktop viewport to show TopNavbar (requires lg: 1024px+)
      cy.viewport(1280, 800)

      // 1. Login first as Owner
      cy.visit('/login')
      devKeyring.quickLoginByEmail(users.OWNER)

      // Wait for dashboard to fully load
      cy.url().should('include', '/dashboard')
      cy.get('[data-cy="dashboard-container"]').should('be.visible')

      // Wait for user menu to be available (session loaded)
      // TopNavbar uses useAuth() which has loading state
      cy.get('[data-cy="topnav-user-menu-trigger"]', { timeout: 15000 }).should('be.visible')

      // 2. Logout via user menu
      cy.get('[data-cy="topnav-user-menu-trigger"]').click()
      cy.get('[data-cy="topnav-menu-signOut"]').should('be.visible').click()

      // 3. Validate redirected to login and DevKeyring is visible again
      cy.url().should('include', '/login')
      devKeyring.validateVisible()

      cy.log('✅ Logout successful')
    })
  })

  after(() => {
    cy.log('✅ Authentication tests completed')
  })
})
