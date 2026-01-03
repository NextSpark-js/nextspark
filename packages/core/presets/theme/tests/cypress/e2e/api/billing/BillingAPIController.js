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

  // ============================================================
  // VALIDATORS
  // ============================================================

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
}

// Export class for use in tests
module.exports = BillingAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.BillingAPIController = BillingAPIController
}
