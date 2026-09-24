/// <reference types="cypress" />

import * as allure from 'allure-cypress'

/**
 * Registration Control Tests - Open Mode
 *
 * Verifies registration mode enforcement when mode is 'open'.
 * Tests: signup accessibility, login page elements, API signup allowed.
 *
 * These tests detect the current registration mode and skip if not 'open'.
 */
describe('Registration Control - Open Mode', {
  tags: ['@uat', '@feat-auth', '@security', '@regression']
}, () => {
  const TEST_PASSWORD = Cypress.env('TEST_PASSWORD') || 'Test1234'

  before(() => {
    // Detect registration mode by checking if /signup is accessible (not redirected)
    cy.request({
      url: '/signup',
      followRedirect: false,
      failOnStatusCode: false,
    }).then((response) => {
      // In open mode, /signup returns 200 (not a redirect)
      // In domain-restricted or invitation-only (with existing team), it redirects (307/308)
      if (response.status >= 300 && response.status < 400) {
        // Not open mode — skip all tests in this suite
        Cypress.runner.stop()
      }
      // Additionally verify that the login page shows a signup link (confirms open mode)
    })
  })

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Registration Control')
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('REG_OPEN_001: Signup page is accessible in open mode', () => {
    it('should show the signup form without redirecting', () => {
      allure.story('Signup Accessibility')
      allure.severity('critical')

      cy.log('1. Visit /signup')
      cy.visit('/signup')

      cy.log('2. Should stay on /signup (no redirect)')
      cy.url().should('include', '/signup')

      cy.log('3. Signup form should be visible')
      cy.get('form').should('exist')
    })
  })

  describe('REG_OPEN_002: Login page shows email login and signup link', () => {
    it('should show email login form and signup link', () => {
      allure.story('Login Page Visibility')
      allure.severity('critical')

      cy.log('1. Visit /login')
      cy.visit('/login')

      cy.log('2. Email login should be available')
      // Either the form is visible directly, or a "show email" toggle exists
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="auth.login.showEmail"]').length) {
          cy.get('[data-cy="auth.login.showEmail"]').click()
        }
      })
      cy.get('[data-cy="auth.login.form"]').should('exist')

      cy.log('3. Signup link should be visible')
      cy.get('[data-cy="auth.login.signupLink"]').should('be.visible')
    })
  })

  describe('REG_OPEN_003: API allows email signup in open mode', () => {
    it('should allow new user registration via email', () => {
      allure.story('API Signup Allowed')
      allure.severity('critical')

      const uniqueEmail = `test-open-${Date.now()}@test-cypress.dev`

      cy.log(`1. POST /api/auth/sign-up/email with new user: ${uniqueEmail}`)
      cy.request({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        body: {
          name: 'Test Open Mode User',
          email: uniqueEmail,
          password: TEST_PASSWORD,
        },
        failOnStatusCode: false,
      }).then((response) => {
        cy.log(`Response status: ${response.status}`)
        // Open mode should allow signup (200) or require email verification (200 with token)
        // Should NOT be 403 (blocked)
        expect(response.status).to.not.eq(403)
        expect(response.status).to.be.oneOf([200, 201])
      })
    })
  })

  describe('REG_OPEN_004: Existing user can login with email+password', () => {
    it('should allow existing user to sign in via API', () => {
      allure.story('Existing User Login')
      allure.severity('critical')

      cy.log('1. POST /api/auth/sign-in/email with existing user')
      cy.request({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        body: {
          email: Cypress.env('OWNER_EMAIL') || 'carlos.mendoza@nextspark.dev',
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
    cy.log('Registration control (open mode) tests completed')
  })
})
