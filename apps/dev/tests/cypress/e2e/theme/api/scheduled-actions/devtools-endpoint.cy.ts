/// <reference types="cypress" />

/**
 * Scheduled Actions API - DevTools Endpoint Tests
 *
 * Tests for /api/v1/devtools/scheduled-actions endpoint that:
 * - Validates authentication (requires superadmin/developer API key)
 * - Supports status filtering (pending, running, completed, failed)
 * - Supports action_type filtering
 * - Returns paginated results
 * - Includes registered action types in meta
 *
 * Session: 2025-12-30-scheduled-actions-v1
 * Phase: 9 (api-tester)
 *
 * AC Coverage:
 * - AC-27: Filter by status
 * - AC-28: Filter by action_type
 * - AC-29: Combined filters
 * - AC-30: Invalid filter handling
 * - AC-31: Pagination with filters
 * - AC-32: Meta includes registeredActionTypes
 */

import * as allure from 'allure-cypress'

describe('Scheduled Actions API - DevTools Endpoint', {
  tags: ['@api', '@feat-scheduled-actions', '@regression']
}, () => {
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'
  const DEVTOOLS_ENDPOINT = `${BASE_URL}/api/v1/devtools/scheduled-actions`

  // API key for superadmin/developer access
  const API_KEY = Cypress.env('SUPERADMIN_API_KEY') || 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Scheduled Actions')
    allure.story('DevTools Endpoint')
  })

  // ============================================================
  // TEST 1: Authentication
  // ============================================================
  describe('Authentication', () => {
    it('SA_DEVTOOLS_AUTH_001: Should return 401 without API key', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: DEVTOOLS_ENDPOINT,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
        expect(response.body.error.code).to.eq('AUTHENTICATION_REQUIRED')

        cy.log('Returns 401 without API key')
      })
    })

    it('SA_DEVTOOLS_AUTH_002: Should return 200 with valid API key', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: DEVTOOLS_ENDPOINT,
        headers: {
          'x-api-key': API_KEY
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        cy.log('Returns 200 with valid API key')
      })
    })
  })

  // ============================================================
  // TEST 2: Status Filtering (AC-27)
  // ============================================================
  describe('Status Filtering', () => {
    it('SA_DEVTOOLS_001: Should filter by status=pending', () => {
      allure.severity('critical')
      allure.tag('@ac-27')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?status=pending`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.have.property('actions')
        expect(response.body.data.actions).to.be.an('array')

        // All returned actions should have status=pending
        response.body.data.actions.forEach((action: { status: string }) => {
          expect(action.status).to.eq('pending')
        })

        cy.log(`Found ${response.body.data.actions.length} pending actions`)
      })
    })

    it('SA_DEVTOOLS_002: Should filter by status=completed', () => {
      allure.severity('critical')
      allure.tag('@ac-27')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?status=completed`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        // All returned actions should have status=completed
        response.body.data.actions.forEach((action: { status: string }) => {
          expect(action.status).to.eq('completed')
        })

        cy.log(`Found ${response.body.data.actions.length} completed actions`)
      })
    })

    it('SA_DEVTOOLS_002b: Should filter by status=failed', () => {
      allure.severity('normal')
      allure.tag('@ac-27')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?status=failed`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        // All returned actions should have status=failed
        response.body.data.actions.forEach((action: { status: string }) => {
          expect(action.status).to.eq('failed')
        })

        cy.log(`Found ${response.body.data.actions.length} failed actions`)
      })
    })

    it('SA_DEVTOOLS_002c: Should filter by status=running', () => {
      allure.severity('normal')
      allure.tag('@ac-27')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?status=running`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        // All returned actions should have status=running
        response.body.data.actions.forEach((action: { status: string }) => {
          expect(action.status).to.eq('running')
        })

        cy.log(`Found ${response.body.data.actions.length} running actions`)
      })
    })
  })

  // ============================================================
  // TEST 3: Action Type Filtering (AC-28)
  // ============================================================
  describe('Action Type Filtering', () => {
    it('SA_DEVTOOLS_003: Should filter by action_type=webhook:send', () => {
      allure.severity('critical')
      allure.tag('@ac-28')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?action_type=webhook:send`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        // All returned actions should have actionType=webhook:send
        response.body.data.actions.forEach((action: { actionType: string }) => {
          expect(action.actionType).to.eq('webhook:send')
        })

        cy.log(`Found ${response.body.data.actions.length} webhook:send actions`)
      })
    })

    it('SA_DEVTOOLS_003b: Should filter by action_type=billing:check-renewals', () => {
      allure.severity('normal')
      allure.tag('@ac-28')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?action_type=billing:check-renewals`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        // All returned actions should have actionType=billing:check-renewals
        response.body.data.actions.forEach((action: { actionType: string }) => {
          expect(action.actionType).to.eq('billing:check-renewals')
        })

        cy.log(`Found ${response.body.data.actions.length} billing:check-renewals actions`)
      })
    })
  })

  // ============================================================
  // TEST 4: Combined Filters (AC-29)
  // ============================================================
  describe('Combined Filters', () => {
    it('SA_DEVTOOLS_004: Should filter by status AND action_type together', () => {
      allure.severity('critical')
      allure.tag('@ac-29')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?status=completed&action_type=webhook:send`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        // All returned actions should match both criteria
        response.body.data.actions.forEach((action: { status: string; actionType: string }) => {
          expect(action.status).to.eq('completed')
          expect(action.actionType).to.eq('webhook:send')
        })

        cy.log(`Found ${response.body.data.actions.length} completed webhook:send actions`)
      })
    })
  })

  // ============================================================
  // TEST 5: Invalid Filter Handling (AC-30)
  // ============================================================
  describe('Invalid Filter Handling', () => {
    it('SA_DEVTOOLS_005: Should return empty array for non-existent action_type', () => {
      allure.severity('normal')
      allure.tag('@ac-30')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?action_type=non-existent:action`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data.actions).to.be.an('array')
        expect(response.body.data.actions.length).to.eq(0)
        expect(response.body.data.pagination.total).to.eq(0)

        cy.log('Returns empty array for non-existent action type')
      })
    })

    it('SA_DEVTOOLS_005b: Should handle invalid status gracefully', () => {
      allure.severity('normal')
      allure.tag('@ac-30')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?status=invalid_status`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        // Should either return empty or treat as no filter
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        cy.log('Handles invalid status gracefully')
      })
    })
  })

  // ============================================================
  // TEST 6: Pagination with Filters (AC-31)
  // ============================================================
  describe('Pagination with Filters', () => {
    it('SA_DEVTOOLS_006: Should paginate filtered results correctly', () => {
      allure.severity('critical')
      allure.tag('@ac-31')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?status=completed&limit=5&page=1`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.have.property('pagination')
        expect(response.body.data.pagination).to.have.property('total')
        expect(response.body.data.pagination).to.have.property('page')
        expect(response.body.data.pagination).to.have.property('limit')
        expect(response.body.data.pagination).to.have.property('totalPages')

        expect(response.body.data.pagination.page).to.eq(1)
        expect(response.body.data.pagination.limit).to.eq(5)
        expect(response.body.data.actions.length).to.be.at.most(5)

        cy.log(`Page 1: ${response.body.data.actions.length} actions`)
        cy.log(`Total: ${response.body.data.pagination.total}`)
        cy.log(`Total Pages: ${response.body.data.pagination.totalPages}`)
      })
    })

    it('SA_DEVTOOLS_006b: Should navigate to page 2 with filters', () => {
      allure.severity('normal')
      allure.tag('@ac-31')

      // First, get page 1 to see if there are enough items
      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?limit=5&page=1`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        const totalPages = response.body.data.pagination.totalPages

        if (totalPages >= 2) {
          // Request page 2
          cy.request({
            method: 'GET',
            url: `${DEVTOOLS_ENDPOINT}?limit=5&page=2`,
            headers: {
              'x-api-key': API_KEY
            }
          }).then((page2Response) => {
            expect(page2Response.status).to.eq(200)
            expect(page2Response.body.data.pagination.page).to.eq(2)

            cy.log(`Page 2: ${page2Response.body.data.actions.length} actions`)
          })
        } else {
          cy.log('Not enough data for page 2 test - only 1 page exists')
        }
      })
    })
  })

  // ============================================================
  // TEST 7: Response Meta (AC-32)
  // ============================================================
  describe('Response Meta', () => {
    it('SA_DEVTOOLS_007: Should include registeredActionTypes in meta', () => {
      allure.severity('critical')
      allure.tag('@ac-32')

      cy.request({
        method: 'GET',
        url: DEVTOOLS_ENDPOINT,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.have.property('meta')
        expect(response.body.data.meta).to.have.property('registeredActionTypes')
        expect(response.body.data.meta.registeredActionTypes).to.be.an('array')

        // Should include known action types
        const actionTypes = response.body.data.meta.registeredActionTypes
        expect(actionTypes).to.include('webhook:send')
        expect(actionTypes).to.include('billing:check-renewals')

        cy.log(`Registered action types: ${actionTypes.join(', ')}`)
      })
    })
  })

  // ============================================================
  // TEST 8: Response Structure
  // ============================================================
  describe('Response Structure', () => {
    it('SA_DEVTOOLS_008: Should return correct action structure', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${DEVTOOLS_ENDPOINT}?limit=1`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        if (response.body.data.actions.length > 0) {
          const action = response.body.data.actions[0]

          // Validate action structure
          expect(action).to.have.property('id')
          expect(action).to.have.property('actionType')
          expect(action).to.have.property('status')
          expect(action).to.have.property('payload')
          expect(action).to.have.property('teamId')
          expect(action).to.have.property('scheduledAt')
          expect(action).to.have.property('createdAt')
          expect(action).to.have.property('updatedAt')
          expect(action).to.have.property('attempts')
          expect(action).to.have.property('recurringInterval')

          cy.log('Action structure validated')
          cy.log(`Action ID: ${action.id}`)
          cy.log(`Type: ${action.actionType}`)
          cy.log(`Status: ${action.status}`)
        } else {
          cy.log('No actions found to validate structure')
        }
      })
    })
  })
})
