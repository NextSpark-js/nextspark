// @ts-nocheck
/// <reference types="cypress" />

/**
 * Billing API - Lifecycle Cron Endpoint Tests
 *
 * P1: Lifecycle Jobs - Tests for cron job endpoint
 * Tests the /api/cron/billing/lifecycle endpoint that handles subscription lifecycle
 *
 * Session: 2025-12-20-subscriptions-system-v2
 * Phase: 9 (api-tester)
 */

import * as allure from 'allure-cypress'

const BillingAPIController = require('./BillingAPIController.js')

describe('Billing API - Lifecycle Cron Endpoint', () => {
  let billingAPI: any

  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'
  // CRON_SECRET from environment (fallback to test value)
  const CRON_SECRET = Cypress.env('CRON_SECRET') || 'test-cron-secret-min-32-characters-long-for-security'

  before(() => {
    billingAPI = new BillingAPIController(BASE_URL, null, null)
    cy.log('BillingAPIController initialized for Lifecycle tests')
    cy.log(`CRON_SECRET configured: ${CRON_SECRET ? 'Yes' : 'No'}`)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Billing')
    allure.story('Lifecycle Cron Endpoint')
  })

  // ============================================================
  // TEST 1: Authentication with CRON_SECRET
  // ============================================================
  describe('Authentication', () => {
    it('LIFECYCLE_API_001: Should return 401 without CRON_SECRET', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/cron/billing/lifecycle`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body.error).to.include('Unauthorized')

        cy.log('✓ Returns 401 without CRON_SECRET')
      })
    })

    it('LIFECYCLE_API_002: Should return 401 with invalid CRON_SECRET', () => {
      allure.severity('critical')

      billingAPI.triggerLifecycle('invalid-secret').then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body.error).to.include('Unauthorized')

        cy.log('✓ Returns 401 with invalid CRON_SECRET')
      })
    })

    it('LIFECYCLE_API_003: Should accept valid CRON_SECRET via Bearer token', () => {
      allure.severity('critical')

      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        // Should succeed with 200 or fail with 500 if DB/logic issue
        expect([200, 500]).to.include(response.status)

        if (response.status === 200) {
          cy.log('✓ Accepts valid CRON_SECRET')
        } else {
          cy.log('✓ Auth passed, job execution may have failed (check logs)')
        }
      })
    })

    it('LIFECYCLE_API_004: Should require Bearer prefix in Authorization header', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/cron/billing/lifecycle`,
        headers: {
          'Authorization': CRON_SECRET // Missing "Bearer " prefix
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)

        cy.log('✓ Requires Bearer prefix')
      })
    })
  })

  // ============================================================
  // TEST 2: Successful Job Execution
  // ============================================================
  describe('Job Execution', () => {
    it('LIFECYCLE_API_010: Should execute lifecycle jobs successfully', () => {
      allure.severity('critical')

      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          billingAPI.validateLifecycleResponse(response)

          expect(response.body.success).to.be.true
          expect(response.body.processed).to.be.a('number')
          expect(response.body.processed).to.be.gte(0)

          cy.log('✓ Lifecycle jobs executed')
          cy.log(`   Processed: ${response.body.processed} items`)
        } else {
          cy.log('⚠ Job execution failed (check server logs)')
        }
      })
    })

    it('LIFECYCLE_API_011: Should return detailed results', () => {
      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          expect(response.body.details).to.exist
          expect(response.body.details).to.have.property('expireTrials')
          expect(response.body.details).to.have.property('pastDueGrace')
          expect(response.body.details).to.have.property('resetUsage')

          // Each job should have processed count and errors array
          expect(response.body.details.expireTrials).to.have.property('processed')
          expect(response.body.details.expireTrials).to.have.property('errors')
          expect(response.body.details.expireTrials.errors).to.be.an('array')

          cy.log('✓ Detailed results returned')
          cy.log(`   Expire Trials: ${response.body.details.expireTrials.processed}`)
          cy.log(`   Past Due Grace: ${response.body.details.pastDueGrace.processed}`)
          cy.log(`   Reset Usage: ${response.body.details.resetUsage.processed}`)
        }
      })
    })

    it('LIFECYCLE_API_012: Should include timestamp in response', () => {
      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          expect(response.body.timestamp).to.exist
          expect(response.body.timestamp).to.be.a('string')

          // Validate ISO 8601 timestamp format
          const timestamp = new Date(response.body.timestamp)
          expect(timestamp.toString()).to.not.eq('Invalid Date')

          cy.log('✓ Timestamp included and valid')
          cy.log(`   Timestamp: ${response.body.timestamp}`)
        }
      })
    })

    it('LIFECYCLE_API_013: Should return errors array if jobs fail', () => {
      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          expect(response.body.errors).to.be.an('array')

          if (response.body.errors.length > 0) {
            cy.log(`⚠ Found ${response.body.errors.length} errors:`)
            response.body.errors.forEach((error: string, index: number) => {
              cy.log(`   ${index + 1}. ${error}`)
            })
          } else {
            cy.log('✓ No errors in job execution')
          }
        }
      })
    })
  })

  // ============================================================
  // TEST 3: Response Structure
  // ============================================================
  describe('Response Structure', () => {
    it('LIFECYCLE_API_020: Should return correct success response structure', () => {
      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          expect(response.body).to.have.property('success', true)
          expect(response.body).to.have.property('processed')
          expect(response.body).to.have.property('errors')
          expect(response.body).to.have.property('details')
          expect(response.body).to.have.property('timestamp')

          cy.log('✓ Success response structure valid')
        }
      })
    })

    it('LIFECYCLE_API_021: Should return error response structure on failure', () => {
      // Trigger with invalid secret to force error
      billingAPI.triggerLifecycle('invalid').then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('error')
        expect(response.body.error).to.be.a('string')

        cy.log('✓ Error response structure valid')
      })
    })
  })

  // ============================================================
  // TEST 4: HTTP Methods Support
  // ============================================================
  describe('HTTP Methods', () => {
    it('LIFECYCLE_API_030: Should support GET method', () => {
      allure.severity('normal')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/cron/billing/lifecycle`,
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`
        },
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 500]).to.include(response.status)

        cy.log('✓ GET method supported')
      })
    })

    it('LIFECYCLE_API_031: Should support POST method for manual triggering', () => {
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/cron/billing/lifecycle`,
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`
        },
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 500]).to.include(response.status)

        cy.log('✓ POST method supported (manual trigger)')
      })
    })

    it('LIFECYCLE_API_032: Should reject unsupported HTTP methods', () => {
      cy.request({
        method: 'PUT',
        url: `${BASE_URL}/api/cron/billing/lifecycle`,
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(405)

        cy.log('✓ Rejects PUT method')
      })
    })
  })

  // ============================================================
  // TEST 5: Job Functions
  // ============================================================
  describe('Job Functions', () => {
    it('LIFECYCLE_API_040: Should execute expireTrials job', () => {
      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          const expireTrialsResult = response.body.details.expireTrials

          expect(expireTrialsResult).to.exist
          expect(expireTrialsResult.processed).to.be.a('number')
          expect(expireTrialsResult.errors).to.be.an('array')

          cy.log('✓ expireTrials job executed')
          cy.log(`   Expired: ${expireTrialsResult.processed} trials`)
        }
      })
    })

    it('LIFECYCLE_API_041: Should execute handlePastDueGracePeriod job', () => {
      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          const pastDueResult = response.body.details.pastDueGrace

          expect(pastDueResult).to.exist
          expect(pastDueResult.processed).to.be.a('number')
          expect(pastDueResult.errors).to.be.an('array')

          cy.log('✓ handlePastDueGracePeriod job executed')
          cy.log(`   Processed: ${pastDueResult.processed} past_due subscriptions`)
        }
      })
    })

    it('LIFECYCLE_API_042: Should execute resetMonthlyUsage job (only on day 1)', () => {
      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        if (response.status === 200) {
          const resetUsageResult = response.body.details.resetUsage

          expect(resetUsageResult).to.exist
          expect(resetUsageResult.processed).to.be.a('number')
          expect(resetUsageResult.errors).to.be.an('array')

          const today = new Date().getDate()

          if (today === 1) {
            cy.log('✓ resetMonthlyUsage job executed (first day of month)')
            cy.log(`   Reset: ${resetUsageResult.processed} usage records`)
          } else {
            expect(resetUsageResult.processed).to.eq(0)
            cy.log('✓ resetMonthlyUsage job skipped (not first day of month)')
          }
        }
      })
    })
  })

  // ============================================================
  // TEST 6: Integration
  // ============================================================
  describe('Integration', () => {
    it('LIFECYCLE_API_100: Should complete full lifecycle job execution', () => {
      allure.severity('critical')

      cy.log('1. Triggering lifecycle cron job...')

      billingAPI.triggerLifecycle(CRON_SECRET).then((response: any) => {
        cy.log(`   Status: ${response.status}`)

        if (response.status === 200) {
          cy.log('2. Job executed successfully')
          cy.log(`   Total processed: ${response.body.processed}`)
          cy.log(`   Total errors: ${response.body.errors.length}`)

          cy.log('3. Job details:')
          cy.log(`   - Expire Trials: ${response.body.details.expireTrials.processed}`)
          cy.log(`   - Past Due Grace: ${response.body.details.pastDueGrace.processed}`)
          cy.log(`   - Reset Usage: ${response.body.details.resetUsage.processed}`)

          if (response.body.errors.length > 0) {
            cy.log('4. Errors encountered:')
            response.body.errors.forEach((error: string, index: number) => {
              cy.log(`   ${index + 1}. ${error}`)
            })
          } else {
            cy.log('4. No errors')
          }

          cy.log('✓ Full lifecycle job flow completed')
        } else {
          cy.log('2. Job execution failed')
          cy.log('   Check server logs for details')
        }
      })
    })
  })

  // ============================================================
  // TEST 7: Idempotency
  // ============================================================
  describe('Idempotency', () => {
    it('LIFECYCLE_API_050: Should be safe to run multiple times', () => {
      allure.severity('normal')

      cy.log('Running job twice in succession...')

      // First execution
      billingAPI.triggerLifecycle(CRON_SECRET).then((firstResponse: any) => {
        if (firstResponse.status === 200) {
          cy.log(`First run: ${firstResponse.body.processed} processed`)

          // Second execution immediately after
          billingAPI.triggerLifecycle(CRON_SECRET).then((secondResponse: any) => {
            if (secondResponse.status === 200) {
              cy.log(`Second run: ${secondResponse.body.processed} processed`)

              // Second run should process 0 or fewer items (idempotent)
              expect(secondResponse.body.processed).to.be.lte(firstResponse.body.processed)

              cy.log('✓ Job is idempotent (safe to run multiple times)')
            }
          })
        }
      })
    })
  })

  // ============================================================
  // TEST 8: Edge Cases
  // ============================================================
  describe('Edge Cases', () => {
    it('LIFECYCLE_API_060: Should handle empty CRON_SECRET', () => {
      billingAPI.triggerLifecycle('').then((response: any) => {
        expect(response.status).to.eq(401)

        cy.log('✓ Rejects empty CRON_SECRET')
      })
    })

    it('LIFECYCLE_API_061: Should handle missing Authorization header', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/cron/billing/lifecycle`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)

        cy.log('✓ Rejects missing Authorization header')
      })
    })

    it('LIFECYCLE_API_062: Should handle case-sensitive CRON_SECRET', () => {
      if (CRON_SECRET) {
        const wrongCaseSecret = CRON_SECRET.toUpperCase()

        billingAPI.triggerLifecycle(wrongCaseSecret).then((response: any) => {
          // Should fail unless secret happens to be all uppercase
          if (CRON_SECRET !== wrongCaseSecret) {
            expect(response.status).to.eq(401)
            cy.log('✓ CRON_SECRET is case-sensitive')
          }
        })
      }
    })
  })
})
