/**
 * CustomerAPIController - Controller for interacting with the Customers API
 * Encapsulates all CRUD operations for /api/v1/customers endpoints
 *
 * Requires:
 * - API Key with customers:read, customers:write scopes (or superadmin with *)
 * - x-team-id header for team context
 */
const BaseAPIController = require('./BaseAPIController')
const entitiesConfig = require('../../fixtures/entities.json')

const { slug } = entitiesConfig.entities.customers

class CustomerAPIController extends BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication
   * @param {string|null} teamId - Team ID for x-team-id header
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {
    super(baseUrl, apiKey, teamId, { slug })
    // Counter for generating unique account numbers
    this.accountCounter = Date.now()
  }

  // ============================================================
  // SEMANTIC ALIASES (for backward compatibility)
  // ============================================================

  /**
   * GET /api/v1/customers - Get list of customers
   * @param {Object} options - Query options
   * @param {number} [options.page] - Page number
   * @param {number} [options.limit] - Results per page
   * @param {string} [options.office] - Filter by office
   * @param {string} [options.salesRep] - Filter by salesRep
   * @param {string} [options.metas] - Metadata parameter ('all', 'key1,key2', etc.)
   * @param {string} [options.search] - Search in name/account/office
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getCustomers(options = {}) {
    return this.list(options)
  }

  /**
   * GET /api/v1/customers/{id} - Get specific customer by ID
   * @param {string} id - Customer ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getCustomerById(id, options = {}) {
    return this.getById(id, options)
  }

  /**
   * POST /api/v1/customers - Create new customer
   * @param {Object} customerData - Customer data
   * @param {string} customerData.name - Customer name (required)
   * @param {number} customerData.account - Account number (required, must be unique)
   * @param {string} customerData.office - Customer office (required)
   * @param {string} [customerData.phone] - Phone number
   * @param {string} [customerData.salesRep] - Sales representative
   * @param {string[]} [customerData.visitDays] - Array of visit days
   * @param {string[]} [customerData.contactDays] - Array of contact days
   * @param {Object} [customerData.metas] - Metadata object
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  createCustomer(customerData, options = {}) {
    return this.create(customerData, options)
  }

  /**
   * PATCH /api/v1/customers/{id} - Update customer
   * @param {string} id - Customer ID
   * @param {Object} updateData - Data to update
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  updateCustomer(id, updateData, options = {}) {
    return this.update(id, updateData, options)
  }

  /**
   * DELETE /api/v1/customers/{id} - Delete customer
   * @param {string} id - Customer ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  deleteCustomer(id, options = {}) {
    return this.delete(id, options)
  }

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate a unique account number
   * Uses timestamp + counter to ensure uniqueness
   * @returns {number} Unique account number
   */
  generateUniqueAccount() {
    this.accountCounter++
    // Use last 9 digits to stay within INTEGER range
    return parseInt(String(this.accountCounter).slice(-9))
  }

  /**
   * Generate random customer data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated customer data
   */
  generateRandomData(overrides = {}) {
    return this.generateRandomCustomerData(overrides)
  }

  /**
   * Generate random customer data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated customer data
   */
  generateRandomCustomerData(overrides = {}) {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    return {
      name: `Test Customer ${randomId} - ${timestamp}`,
      account: this.generateUniqueAccount(),
      office: `Office-${randomId}`,
      phone: `+1-555-${Math.floor(1000 + Math.random() * 9000)}`,
      salesRep: `Sales Rep ${randomId}`,
      visitDays: [],
      contactDays: [],
      ...overrides
    }
  }

  /**
   * Create a test customer and return its data
   * @param {Object} customerData - Customer data (optional)
   * @returns {Cypress.Chainable} Promise resolving with created customer data
   */
  createTestCustomer(customerData = {}) {
    return this.createTestEntity(customerData)
  }

  /**
   * Clean up a test customer (delete it)
   * @param {string} id - Customer ID
   * @returns {Cypress.Chainable} Delete response
   */
  cleanupTestCustomer(id) {
    return this.cleanup(id)
  }

  // ============================================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================================

  /**
   * Validate customer object structure
   * @param {Object} customer - Customer object
   * @param {boolean} allowMetas - If metas property is allowed
   */
  validateCustomerObject(customer, allowMetas = false) {
    // Base fields
    this.validateBaseEntityFields(customer)

    // Required entity fields
    expect(customer).to.have.property('name')
    expect(customer.name).to.be.a('string')

    expect(customer).to.have.property('account')
    // Account can be number or string depending on how PostgreSQL returns it
    expect(typeof customer.account === 'number' || typeof customer.account === 'string').to.be.true

    expect(customer).to.have.property('office')
    expect(customer.office).to.be.a('string')

    // Optional fields that can be null
    if (customer.phone !== null && customer.phone !== undefined) {
      expect(customer.phone).to.be.a('string')
    }

    if (customer.salesRep !== null && customer.salesRep !== undefined) {
      expect(customer.salesRep).to.be.a('string')
    }

    // JSONB array fields
    expect(customer).to.have.property('visitDays')
    expect(customer.visitDays).to.be.an('array')

    expect(customer).to.have.property('contactDays')
    expect(customer.contactDays).to.be.an('array')

    // Validate metas if present
    if (allowMetas && customer.hasOwnProperty('metas')) {
      expect(customer.metas).to.be.an('object')
    }
  }

  // ============================================================
  // METADATA HELPERS
  // ============================================================

  /**
   * Generate sample metadata for testing
   * @param {string} type - Type of metadata ('contactPreferences', 'billing', 'notes')
   * @returns {Object} Sample metadata
   */
  generateSampleMetadata(type = 'contactPreferences') {
    const sampleMetas = {
      contactPreferences: {
        preferredTime: 'morning',
        preferredChannel: 'phone',
        language: 'es',
        doNotContact: false
      },
      billing: {
        paymentTerms: 'net30',
        creditLimit: 50000,
        taxExempt: false,
        currency: 'USD'
      },
      notes: {
        lastContact: '2025-12-01T10:00:00Z',
        nextFollowUp: '2025-12-15T10:00:00Z',
        accountManager: 'John Doe',
        priority: 'high'
      },
      customFields: {
        industry: 'Technology',
        segment: 'Enterprise',
        referralSource: 'Website',
        loyaltyTier: 'Gold'
      }
    }

    return { [type]: sampleMetas[type] || sampleMetas.contactPreferences }
  }
}

// Export class for use in tests
module.exports = CustomerAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.CustomerAPIController = CustomerAPIController
}
