/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { DEFAULT_THEME_USERS } from '../../../../src/session-helpers'

/**
 * Registration Control Tests - Invitation-Only Mode
 *
 * Verifies registration mode enforcement when mode is 'invitation-only'.
 * Tests: signup redirect, login page visibility, API blocking, existing user login.
 *
 * These tests detect the current registration mode and skip if not 'invitation-only'.
 * Detection: invitation-only mode redirects /signup AND shows email login on /login
 * (unlike domain-restricted which hides email login).
 */
describe('Registration Control - Invitation-Only Mode', {
  tags: ['@uat', '@feat-auth', '@security', '@regression']
}, () => {
  const TEST_PASSWORD = Cypress.env('TEST_PASSWORD') || 'Test1234'

  before(() => {
    // Detect invitation-only mode:
    // 1. /signup redirects (shared with domain-restricted)
    // 2. /login shows email form (NOT shared with domain-restricted, which hides it)
    cy.request({
      url: '/signup',
      followRedirect: false,
      failOnStatusCode: false,
    }).then((signupResponse) => {
      if (signupResponse.status < 300 || signupResponse.status >= 400) {
        // /signup is accessible — this is 'open' mode, skip
        Cypress.runner.stop()
        return
      }

      // /signup redirects — could be domain-restricted or invitation-only
      // Check login page for email form to distinguish
      cy.visit('/login')
      cy.get('body').then(($body) => {
        // In domain-restricted mode, email login is hidden (no showEmail toggle, no form)
        // In invitation-only mode, email login IS shown
        const hasEmailForm = $body.find('[data-cy="auth.login.form"]').length > 0
        const hasShowEmail = $body.find('[data-cy="auth.login.showEmail"]').length > 0

        if (!hasEmailForm && !hasShowEmail) {
          // No email login at all — this is domain-restricted, not invitation-only
          Cypress.runner.stop()
        }
      })
    })
  })

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Registration Control')
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('REG_INV_001: Signup page redirects in invitation-only mode', () => {
    it('should redirect /signup to /login', () => {
      allure.story('Signup Redirect')
      allure.severity('critical')

      cy.log('1. Visit /signup')
      cy.visit('/signup', { failOnStatusCode: false })

      cy.log('2. Should redirect to /login')
      cy.url().should('include', '/login')
    })
  })

  describe('REG_INV_002: Login page shows email login but no signup link', () => {
    it('should show email login and hide signup link', () => {
      allure.story('Login Page Visibility')
      allure.severity('critical')

      cy.log('1. Visit /login')
      cy.visit('/login')

      cy.log('2. Email login should be available')
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="auth.login.showEmail"]').length) {
          cy.get('[data-cy="auth.login.showEmail"]').click()
        }
      })
      cy.get('[data-cy="auth.login.form"]').should('exist')

      cy.log('3. Signup link should NOT exist')
      cy.get('[data-cy="auth.login.signupLink"]').should('not.exist')
    })
  })

  describe('REG_INV_003: API blocks email signup in invitation-only mode', () => {
    it('should return 403 for email signup attempt', () => {
      allure.story('API Signup Blocking')
      allure.severity('critical')

      cy.log('1. POST /api/auth/sign-up/email with new user data')
      cy.request({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        body: {
          name: 'Test Uninvited User',
          email: 'uninvited@some-domain.com',
          password: 'TestPassword123',
        },
        failOnStatusCode: false,
      }).then((response) => {
        cy.log(`Response status: ${response.status}`)
        // Should be blocked — 403 or 500 (from SIGNUP_RESTRICTED error)
        expect(response.status).to.be.oneOf([403, 500])
      })
    })
  })

  describe('REG_INV_004: API blocks alternative signup endpoints', () => {
    it('should block signup via alternative endpoints', () => {
      allure.story('API Signup Blocking')
      allure.severity('normal')

      const signupPayload = {
        name: 'Test Uninvited User',
        email: 'uninvited@some-domain.com',
        password: 'TestPassword123',
      }

      const endpoints = [
        '/api/auth/sign-up/email',
        '/api/auth/sign-up/credentials',
      ]

      endpoints.forEach((endpoint) => {
        cy.log(`Testing: POST ${endpoint}`)
        cy.request({
          method: 'POST',
          url: endpoint,
          body: signupPayload,
          failOnStatusCode: false,
        }).then((response) => {
          cy.log(`${endpoint} → ${response.status}`)
          // Should be blocked (403/500 for blocked signup, 404 for non-existent)
          expect(response.status).to.be.oneOf([403, 404, 422, 500])
        })
      })
    })
  })

  describe('REG_INV_005: Existing user can still login with email+password', () => {
    it('should allow existing user to sign in via API', () => {
      allure.story('Existing User Login')
      allure.severity('critical')

      const existingUser = DEFAULT_THEME_USERS.OWNER

      cy.log(`1. POST /api/auth/sign-in/email with existing user: ${existingUser}`)
      cy.request({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        body: {
          email: existingUser,
          password: TEST_PASSWORD,
        },
        failOnStatusCode: false,
      }).then((response) => {
        cy.log(`Response status: ${response.status}`)
        expect(response.status).to.eq(200)
      })
    })
  })

  after(() => {
    cy.log('Registration control (invitation-only mode) tests completed')
  })
})
