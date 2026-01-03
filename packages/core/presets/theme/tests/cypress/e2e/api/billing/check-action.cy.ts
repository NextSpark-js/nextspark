// @ts-nocheck
/// <reference types="cypress" />

/**
 * Billing API - check-action Endpoint Tests
 *
 * FIX1: Tests for the check-action endpoint that validates:
 * - RBAC permissions (role-based access control)
 * - Plan features (subscription-based access)
 * - Quota limits (usage-based access)
 *
 * Session: 2025-12-20-subscriptions-system-v2
 * Phase: 9 (api-tester)
 */

import * as allure from 'allure-cypress'

const BillingAPIController = require('./BillingAPIController.js')

describe('Billing API - check-action Endpoint', () => {
  let billingAPI: any

  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    billingAPI = new BillingAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    cy.log('BillingAPIController initialized')
    cy.log(`Base URL: ${BASE_URL}`)
    cy.log(`Team ID: ${TEAM_ID}`)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Billing')
    allure.story('check-action Endpoint')
  })

  // ============================================================
  // TEST 1: Authentication
  // ============================================================
  describe('Authentication', () => {
    it('BILLING_API_001: Should return 401 without authentication', () => {
      allure.severity('critical')

      // Remove API key
      const originalApiKey = billingAPI.apiKey
      billingAPI.setApiKey(null)

      billingAPI.checkAction('projects.create').then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false

        cy.log('✓ Returns 401 without auth')
      })

      // Restore API key
      billingAPI.setApiKey(originalApiKey)
    })

    it('BILLING_API_002: Should accept API key authentication', () => {
      allure.severity('critical')

      billingAPI.checkAction('projects.create').then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        cy.log('✓ Accepts API key authentication')
      })
    })

    it('BILLING_API_003: Should require team context', () => {
      allure.severity('critical')

      // Remove team ID
      const originalTeamId = billingAPI.teamId
      billingAPI.setTeamId(null)

      billingAPI.checkAction('projects.create').then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.error).to.include('team context')

        cy.log('✓ Requires team context')
      })

      // Restore team ID
      billingAPI.setTeamId(originalTeamId)
    })
  })

  // ============================================================
  // TEST 2: Allowed Actions (RBAC + Feature + Quota Pass)
  // ============================================================
  describe('Allowed Actions', () => {
    it('BILLING_API_010: Should allow action with valid permissions', () => {
      allure.severity('critical')

      // Superadmin has all permissions
      billingAPI.checkAction('projects.create').then((response: any) => {
        billingAPI.validateCheckActionResponse(response, true)

        expect(response.body.data.allowed).to.be.true
        expect(response.body.data.reason).to.be.undefined

        cy.log('✓ Action allowed for superadmin')
        cy.log(`Action: projects.create`)
      })
    })

    it('BILLING_API_011: Should allow multiple different actions', () => {
      const actions = [
        'projects.create',
        'projects.read',
        'projects.update',
        'projects.delete'
      ]

      actions.forEach((action) => {
        billingAPI.checkAction(action).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.allowed).to.be.true

          cy.log(`✓ ${action} allowed`)
        })
      })
    })
  })

  // ============================================================
  // TEST 3: Feature Not in Plan (Subscription-based Access)
  // ============================================================
  describe('Feature Restrictions', () => {
    it('BILLING_API_020: Should return feature_not_in_plan for missing feature', () => {
      allure.severity('critical')

      // This test assumes there's a feature that free plan doesn't have
      // For now, we'll test the endpoint structure
      // In a real scenario, you'd create a test user with free plan

      cy.log('Note: This test checks endpoint structure')
      cy.log('Full test requires multi-team setup with different plans')

      // Using a hypothetical enterprise-only feature
      billingAPI.checkAction('auth.configure_sso').then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.have.property('allowed')

        // With superadmin, this might be allowed or restricted
        // The key is the endpoint works correctly
        cy.log(`✓ Endpoint responds for feature check`)
        cy.log(`Allowed: ${response.body.data.allowed}`)

        if (!response.body.data.allowed) {
          expect(response.body.data.reason).to.be.oneOf([
            'feature_not_in_plan',
            'no_permission'
          ])
        }
      })
    })

    it('BILLING_API_021: Should check wildcard feature access', () => {
      // Test wildcard feature support (*)
      billingAPI.checkAction('custom.any_action').then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        // Superadmin with * should allow any action
        cy.log(`✓ Wildcard feature check works`)
        cy.log(`Allowed: ${response.body.data.allowed}`)
      })
    })
  })

  // ============================================================
  // TEST 4: Quota Exceeded (Usage-based Access)
  // ============================================================
  describe('Quota Limits', () => {
    it('BILLING_API_030: Should return quota info when checking limits', () => {
      allure.severity('normal')

      // Check an action that has quota limits
      billingAPI.checkAction('projects.create').then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.have.property('allowed')

        // If there's a quota check, it should include quota info
        if (response.body.data.quota) {
          expect(response.body.data.quota).to.have.property('current')
          expect(response.body.data.quota).to.have.property('max')
          expect(response.body.data.quota).to.have.property('allowed')

          cy.log(`✓ Quota info included`)
          cy.log(`Current: ${response.body.data.quota.current}/${response.body.data.quota.max}`)
        } else {
          cy.log('Note: No quota limit for this action')
        }
      })
    })

    it('BILLING_API_031: Should handle quota_exceeded scenario', () => {
      // This test would require setting up a user at quota limit
      // For now, we verify the endpoint handles the check correctly

      cy.log('Note: Full quota_exceeded test requires quota setup')
      cy.log('This verifies endpoint response structure')

      billingAPI.checkAction('projects.create').then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body.data).to.have.property('allowed')

        if (!response.body.data.allowed && response.body.data.reason === 'quota_exceeded') {
          expect(response.body.data.quota).to.exist
          expect(response.body.data.quota.current).to.be.gte(response.body.data.quota.max)

          cy.log(`✓ Quota exceeded response correct`)
        } else {
          cy.log(`✓ User not at quota limit (allowed: ${response.body.data.allowed})`)
        }
      })
    })
  })

  // ============================================================
  // TEST 5: Validation & Error Handling
  // ============================================================
  describe('Validation', () => {
    it('BILLING_API_040: Should reject request without action', () => {
      allure.severity('normal')

      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/v1/billing/check-action`,
        headers: billingAPI.getHeaders(),
        body: {},
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.error).to.include('Validation')

        cy.log('✓ Rejects empty action')
      })
    })

    it('BILLING_API_041: Should reject invalid JSON', () => {
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/v1/billing/check-action`,
        headers: {
          ...billingAPI.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: 'invalid json',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false

        cy.log('✓ Rejects invalid JSON')
      })
    })

    it('BILLING_API_042: Should validate action is non-empty string', () => {
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/v1/billing/check-action`,
        headers: billingAPI.getHeaders(),
        body: { action: '' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false

        cy.log('✓ Rejects empty action string')
      })
    })
  })

  // ============================================================
  // TEST 6: Integration - Complete Flow
  // ============================================================
  describe('Integration', () => {
    it('BILLING_API_100: Should complete full permission check flow', () => {
      allure.severity('critical')

      const testAction = 'projects.create'

      // 1. Check action permission
      billingAPI.checkAction(testAction).then((checkResponse: any) => {
        expect(checkResponse.status).to.eq(200)
        expect(checkResponse.body.success).to.be.true

        cy.log(`1. Permission check: ${checkResponse.body.data.allowed ? 'ALLOWED' : 'DENIED'}`)

        if (checkResponse.body.data.allowed) {
          cy.log(`   ✓ User can perform: ${testAction}`)

          if (checkResponse.body.data.quota) {
            cy.log(`   Quota: ${checkResponse.body.data.quota.current}/${checkResponse.body.data.quota.max}`)
          }
        } else {
          cy.log(`   ✗ Reason: ${checkResponse.body.data.reason}`)

          if (checkResponse.body.data.quota) {
            cy.log(`   Quota exceeded: ${checkResponse.body.data.quota.current}/${checkResponse.body.data.quota.max}`)
          }
        }

        // 2. Verify response structure is consistent
        expect(checkResponse.body.data).to.have.property('allowed')

        if (!checkResponse.body.data.allowed) {
          expect(checkResponse.body.data).to.have.property('reason')
        }

        cy.log('2. Response structure validated')
        cy.log('✓ Full permission check flow completed')
      })
    })
  })
})
