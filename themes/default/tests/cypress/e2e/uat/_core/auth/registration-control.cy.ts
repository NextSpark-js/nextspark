/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { DEFAULT_THEME_USERS } from '../../../../src/session-helpers'

/**
 * Registration Control Tests
 *
 * Verifies registration mode enforcement in domain-restricted mode (default theme).
 * Tests: signup redirect, login page visibility, API blocking, existing user login.
 */
describe('Registration Control - Domain Restricted Mode', {
  tags: ['@uat', '@feat-auth', '@security', '@regression']
}, () => {
  const TEST_PASSWORD = Cypress.env('TEST_PASSWORD') || 'Test1234'

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Registration Control')
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('REG_001: Signup page redirects in domain-restricted mode', () => {
    it('should redirect /signup to /login', () => {
      allure.story('Signup Redirect')
      allure.severity('critical')

      cy.log('1. Visit /signup')
      cy.visit('/signup', { failOnStatusCode: false })

      cy.log('2. Should redirect to /login')
      cy.url().should('include', '/login')
    })
  })

  describe('REG_002: Login page hides email login in domain-restricted mode', () => {
    it('should show Google button but hide email login options', () => {
      allure.story('Login Page Visibility')
      allure.severity('critical')

      cy.log('1. Visit /login')
      cy.visit('/login')

      cy.log('2. Google sign-in button should be visible')
      cy.get('[data-cy="auth.login.googleSignin"]').should('be.visible')

      cy.log('3. "Show email" link should NOT exist')
      cy.get('[data-cy="auth.login.showEmail"]').should('not.exist')

      cy.log('4. Email form should NOT exist')
      cy.get('[data-cy="auth.login.form"]').should('not.exist')

      cy.log('5. Signup link should NOT exist')
      cy.get('[data-cy="auth.login.signupLink"]').should('not.exist')
    })
  })

  describe('REG_003: API blocks email signup in domain-restricted mode', () => {
    it('should return 403 for email signup attempt', () => {
      allure.story('API Signup Blocking')
      allure.severity('critical')

      cy.log('1. POST /api/auth/sign-up/email with new user data')
      cy.request({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        body: {
          name: 'Test New User',
          email: 'newuser@unauthorized-domain.com',
          password: 'TestPassword123',
        },
        failOnStatusCode: false,
      }).then((response) => {
        cy.log(`Response status: ${response.status}`)
        expect(response.status).to.eq(403)
      })
    })
  })

  describe('REG_004: API blocks alternative signup endpoints', () => {
    it('should block signup via alternative endpoints', () => {
      allure.story('API Signup Blocking')
      allure.severity('normal')

      const signupPayload = {
        name: 'Test New User',
        email: 'newuser@unauthorized-domain.com',
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
          // Should be blocked (403 or 404 for non-existent endpoints)
          expect(response.status).to.be.oneOf([403, 404, 422])
        })
      })
    })
  })

  describe('REG_005: Existing user can still login with email+password', () => {
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
    cy.log('Registration control tests completed')
  })
})
