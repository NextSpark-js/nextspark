/**
 * BillingAPIController - Controller for interacting with Billing API
 * Encapsulates billing operations for /api/v1/billing/* endpoints
 *
 * Requires:
 * - API Key with appropriate scopes (or superadmin with *)
 * - x-team-id header for team context
 */
const BaseAPIController = require('../../../src/controllers/BaseAPIController')

class BillingAPIController extends BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication
   * @param {string|null} teamId - Team ID for x-team-id header
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {
    super(baseUrl, apiKey, teamId, {
      slug: 'billing',
      endpoint: '/api/v1/billing'
    })
  }

  // ============================================================
  // BILLING-SPECIFIC ENDPOINTS
  // ============================================================

  /**
   * POST /api/v1/billing/check-action - Check if user can perform action
   * @param {string} action - Action slug (e.g., 'projects.create')
   * @param {Object} options - Additional options
   * @param {string} [options.teamId] - Override team ID in body
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  checkAction(action, options = {}) {
    const { teamId, headers = {} } = options
    const body = { action }

    if (teamId) {
      body.teamId = teamId
    }

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}/api/v1/billing/check-action`,
      headers: this.getHeaders(headers),
      body,
      failOnStatusCode: false
    })
  }

  /**
   * POST /api/v1/billing/checkout - Create Stripe checkout session
   * @param {Object} checkoutData - Checkout data
   * @param {string} checkoutData.planSlug - Plan slug (e.g., 'pro')
   * @param {string} [checkoutData.billingPeriod='monthly'] - Billing period
   * @param {Object} options - Additional options
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  createCheckout(checkoutData, options = {}) {
    const { headers = {} } = options

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}/api/v1/billing/checkout`,
      headers: this.getHeaders(headers),
      body: checkoutData,
      failOnStatusCode: false
    })
  }

  /**
   * POST /api/v1/billing/portal - Create customer portal session
   * @param {Object} options - Additional options
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  createPortal(options = {}) {
    const { headers = {} } = options

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}/api/v1/billing/portal`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  /**
   * GET /api/cron/billing/lifecycle - Trigger lifecycle cron job
   * @param {string} cronSecret - CRON_SECRET for authentication
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  triggerLifecycle(cronSecret, options = {}) {
    const headers = {
      'Authorization': `Bearer ${cronSecret}`
    }

    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}/api/cron/billing/lifecycle`,
      headers,
      failOnStatusCode: false
    })
  }

  /**
   * GET /api/v1/teams/{teamId}/usage/{limitSlug} - Get usage for a limit
   * @param {string} teamId - Team ID
   * @param {string} limitSlug - Limit slug (e.g., 'tasks', 'customers')
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getUsage(teamId, limitSlug, options = {}) {
    const { headers = {} } = options

    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}/api/v1/teams/${teamId}/usage/${limitSlug}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  /**
   * GET /api/v1/teams/{teamId}/subscription - Get subscription details
   * @param {string} teamId - Team ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getSubscription(teamId, options = {}) {
    const { headers = {} } = options

    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}/api/v1/teams/${teamId}/subscription`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  // ============================================================
  // VALIDATORS
  // ============================================================

  /**
   * Override base validateSuccessResponse for billing API
   * Billing API doesn't return 'info' property
   * @param {Object} response - API response
   * @param {number} expectedStatus - Expected status code (default: 200)
   */
  validateSuccessResponse(response, expectedStatus = 200) {
    expect(response.status).to.eq(expectedStatus)
    expect(response.body).to.have.property('success', true)
    expect(response.body).to.have.property('data')
  }

  /**
   * Validate check-action response structure
   * @param {Object} response - Cypress response
   * @param {boolean} expectedAllowed - Expected allowed value
   */
  validateCheckActionResponse(response, expectedAllowed) {
    this.validateSuccessResponse(response, 200)

    expect(response.body.data).to.have.property('allowed')
    expect(response.body.data.allowed).to.eq(expectedAllowed)

    if (!expectedAllowed) {
      expect(response.body.data).to.have.property('reason')
      expect(response.body.data.reason).to.be.oneOf([
        'no_permission',
        'feature_not_in_plan',
        'quota_exceeded'
      ])
    }
  }

  /**
   * Validate checkout response structure
   * @param {Object} response - Cypress response
   */
  validateCheckoutResponse(response) {
    this.validateSuccessResponse(response, 200)

    expect(response.body.data).to.have.property('url')
    expect(response.body.data.url).to.be.a('string')
    expect(response.body.data).to.have.property('sessionId')
    expect(response.body.data.sessionId).to.be.a('string')
  }

  /**
   * Validate portal response structure
   * @param {Object} response - Cypress response
   */
  validatePortalResponse(response) {
    this.validateSuccessResponse(response, 200)

    expect(response.body.data).to.have.property('url')
    expect(response.body.data.url).to.be.a('string')
  }

  /**
   * Validate lifecycle response structure
   * @param {Object} response - Cypress response
   */
  validateLifecycleResponse(response) {
    this.validateSuccessResponse(response, 200)

    expect(response.body).to.have.property('processed')
    expect(response.body.processed).to.be.a('number')
    expect(response.body).to.have.property('details')
  }

  /**
   * Validate usage response structure
   * @param {Object} response - Cypress response
   * @param {Object} expected - Expected values
   * @param {boolean} [expected.allowed] - Expected allowed value
   * @param {number} [expected.current] - Expected current usage
   * @param {number} [expected.max] - Expected max limit
   */
  validateUsageResponse(response, expected = {}) {
    this.validateSuccessResponse(response, 200)

    expect(response.body.data).to.have.property('allowed')
    expect(response.body.data).to.have.property('current')
    expect(response.body.data).to.have.property('max')
    expect(response.body.data).to.have.property('remaining')
    expect(response.body.data).to.have.property('percentUsed')

    if (expected.allowed !== undefined) {
      expect(response.body.data.allowed).to.eq(expected.allowed)
    }
    if (expected.current !== undefined) {
      expect(response.body.data.current).to.eq(expected.current)
    }
    if (expected.max !== undefined) {
      expect(response.body.data.max).to.eq(expected.max)
    }
  }

  /**
   * Validate subscription response structure
   * @param {Object} response - Cypress response
   * @param {Object} expected - Expected values
   * @param {string} [expected.status] - Expected status
   * @param {string} [expected.planSlug] - Expected plan slug
   */
  validateSubscriptionResponse(response, expected = {}) {
    this.validateSuccessResponse(response, 200)

    expect(response.body.data).to.have.property('subscription')
    expect(response.body.data.subscription).to.have.property('status')
    expect(response.body.data.subscription).to.have.property('plan')

    if (expected.status) {
      expect(response.body.data.subscription.status).to.eq(expected.status)
    }
    if (expected.planSlug) {
      expect(response.body.data.subscription.plan.slug).to.eq(expected.planSlug)
    }
  }

  /**
   * Validate check-action denied response
   * @param {Object} response - Cypress response
   * @param {string} expectedReason - Expected reason ('feature_not_in_plan', 'quota_exceeded', 'no_permission')
   */
  validateActionDenied(response, expectedReason) {
    this.validateSuccessResponse(response, 200)

    expect(response.body.data.allowed).to.be.false
    expect(response.body.data.reason).to.eq(expectedReason)
  }

  /**
   * Validate check-action allowed response
   * @param {Object} response - Cypress response
   */
  validateActionAllowed(response) {
    this.validateSuccessResponse(response, 200)

    expect(response.body.data.allowed).to.be.true
    expect(response.body.data.reason).to.be.undefined
  }

  /**
   * Validate quota exceeded response with quota details
   * @param {Object} response - Cypress response
   * @param {Object} expected - Expected quota values
   * @param {number} [expected.current] - Expected current value
   * @param {number} [expected.max] - Expected max value
   */
  validateQuotaExceeded(response, expected = {}) {
    this.validateActionDenied(response, 'quota_exceeded')

    expect(response.body.data).to.have.property('quota')
    expect(response.body.data.quota.allowed).to.be.false

    if (expected.current !== undefined) {
      expect(response.body.data.quota.current).to.eq(expected.current)
    }
    if (expected.max !== undefined) {
      expect(response.body.data.quota.max).to.eq(expected.max)
    }
  }
}

// Export class for use in tests
module.exports = BillingAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.BillingAPIController = BillingAPIController
}
