/// <reference types="cypress" />

/**
 * Users API - Security Tests
 *
 * Tests for access control and authentication on the /api/v1/users endpoint.
 * Verifies that only superadmins can access user management endpoints.
 *
 * Uses DevKeyring for session-based authentication tests (login without password).
 *
 * @endpoint /api/v1/users
 * @see users-security.md for documentation
 */

import * as allure from 'allure-cypress'

import { DevKeyringPOM as DevKeyring } from '../../../src/components/DevKeyringPOM'
import { getThemeUsers } from '../../../src/session-helpers'

describe('Users API - Security & Access Control', {
  tags: ['@api', '@feat-users', '@security', '@regression']
}, () => {

  // API Key for API-based tests
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'

  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Track created users for cleanup
  const createdUserIds: string[] = []

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Users')
    allure.story('Security & Access Control')
  })

  after(() => {
    // Cleanup: Delete any users created during tests
    if (createdUserIds.length > 0) {
      cy.log(`🧹 Cleaning up ${createdUserIds.length} test user(s)`)
      createdUserIds.forEach((userId) => {
        cy.request({
          method: 'DELETE',
          url: `${BASE_URL}/api/v1/users/${userId}`,
          headers: {
            'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
            'Content-Type': 'application/json'
          },
          failOnStatusCode: false
        }).then((response) => {
          if (response.status === 200) {
            cy.log(`✅ Deleted test user: ${userId}`)
          } else {
            cy.log(`⚠️ Failed to delete user ${userId}: ${response.status}`)
          }
        })
      })
    }
  })

  // ============================================
  // Session-Based Authentication Tests
  // ============================================

  describe('Session-Based Authentication', () => {

    it('USER_SEC_001: Member user should get 403 on GET /api/v1/users', { tags: '@smoke' }, () => {
      allure.severity('critical')
      const users = getThemeUsers()

      // Login as member using DevKeyring (quick login by email)
      cy.session('member-security-001', () => {
        cy.visit('/login')
        const devKeyring = new DevKeyring()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(users.MEMBER)
        cy.url().should('include', '/dashboard')
      }, {
        validate: () => {
          cy.visit('/dashboard')
          cy.url().should('include', '/dashboard')
        }
      })

      cy.visit('/dashboard')

      // Attempt to access /api/v1/users
      cy.request({
        method: 'GET',
        url: '/api/v1/users',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('error')
        expect(response.body.error).to.include('Insufficient permissions')
      })
    })

    it('USER_SEC_002: Superadmin should get 200 on GET /api/v1/users', { tags: '@smoke' }, () => {
      allure.severity('critical')
      // Note: We use API key for superadmin tests as DevKeyring uses theme users
      // and superadmin@cypress.com might not be in the DevKeyring list.
      // This test validates superadmin API key access instead of session.
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.be.greaterThan(0)

        // Validate user structure
        const firstUser = response.body.data[0]
        expect(firstUser).to.have.property('id')
        expect(firstUser).to.have.property('email')
      })
    })

    it('USER_SEC_003: Member cannot POST to /api/v1/users (create user)', () => {
      const users = getThemeUsers()

      // Login as member using DevKeyring (quick login by email)
      cy.session('member-security-003', () => {
        cy.visit('/login')
        const devKeyring = new DevKeyring()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(users.MEMBER)
        cy.url().should('include', '/dashboard')
      }, {
        validate: () => {
          cy.visit('/dashboard')
          cy.url().should('include', '/dashboard')
        }
      })

      cy.visit('/dashboard')

      // Attempt to create a user
      cy.request({
        method: 'POST',
        url: '/api/v1/users',
        body: {
          email: 'test-create@example.com',
          firstName: 'Test',
          lastName: 'User',
          country: 'US'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403)
        expect(response.body).to.have.property('success', false)
        expect(response.body.error).to.include('Insufficient permissions')
      })
    })
  })

  // ============================================
  // API Key Authentication Tests
  // ============================================

  describe('API Key Authentication', () => {

    it('USER_SEC_010: Superadmin API key should get 200 on GET /api/v1/users', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.be.greaterThan(0)

        // Validate user structure
        const firstUser = response.body.data[0]
        expect(firstUser).to.have.property('id')
        expect(firstUser).to.have.property('email')
        expect(firstUser).to.have.property('role')
      })
    })

    it('USER_SEC_011: Invalid API key should get 401', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': 'Bearer test_invalid_key_for_testing_purposes_only_not_real_12345678901234567',
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })

    it('USER_SEC_012: Malformed API key should get 401', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': 'Bearer not_a_valid_key',
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })

    it('USER_SEC_013: Superadmin API key can create users via POST', () => {
      const timestamp = Date.now()
      const newUserData = {
        email: `cypress-security-test-${timestamp}@example.com`,
        firstName: 'Security',
        lastName: 'Test',
        country: 'US',
        language: 'en',
        timezone: 'UTC'
      }

      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: newUserData,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(201)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data).to.have.property('id')
        expect(response.body.data).to.have.property('email', newUserData.email)
        expect(response.body.data).to.have.property('firstName', newUserData.firstName)

        // Track for cleanup
        createdUserIds.push(response.body.data.id)
      })
    })
  })

  // ============================================
  // Unauthenticated Access Tests
  // ============================================

  describe('Unauthenticated Access', () => {

    it('USER_SEC_020: No authentication should get 401', () => {
      // Clear all sessions and cookies
      cy.clearAllSessionStorage()
      cy.clearAllCookies()

      // Attempt to access without authentication
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('error')
        expect(response.body.error).to.include('Authentication required')
      })
    })

    it('USER_SEC_021: No auth on POST should get 401', () => {
      cy.clearAllSessionStorage()
      cy.clearAllCookies()

      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/v1/users`,
        body: {
          email: 'unauthorized@example.com',
          firstName: 'Unauthorized',
          lastName: 'User',
          country: 'US'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(response.body.error).to.include('Authentication required')
      })
    })

    it('USER_SEC_022: Empty Authorization header should get 401', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': '',
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })
  })

  // ============================================
  // Response Structure Validation
  // ============================================

  describe('Response Structure Validation', () => {

    it('USER_SEC_030: Users list should have proper pagination info', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')
        expect(response.body).to.have.property('info')
        expect(response.body.info).to.have.property('timestamp')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
      })
    })

    it('USER_SEC_031: Users should have expected fields (no sensitive data)', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/users`,
        headers: {
          'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)

        if (response.body.data.length > 0) {
          const user = response.body.data[0]

          // Should have these fields
          expect(user).to.have.property('id')
          expect(user).to.have.property('email')
          expect(user).to.have.property('role')
          expect(user).to.have.property('createdAt')

          // Should NOT expose sensitive fields
          expect(user).to.not.have.property('password')
          expect(user).to.not.have.property('passwordHash')
        }
      })
    })
  })
})
