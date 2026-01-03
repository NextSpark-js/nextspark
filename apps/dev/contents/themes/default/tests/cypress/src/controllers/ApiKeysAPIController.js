/**
 * ApiKeysAPIController - Controller for API Keys API
 *
 * Extends BaseAPIController for CRUD operations on /api/v1/api-keys endpoint.
 *
 * IMPORTANT: API Keys is a GLOBAL entity - NO teamId required
 * NOTE: api-keys is NOT in entities.json, so slug is hardcoded
 *
 * @endpoint /api/v1/api-keys
 */

const BaseAPIController = require('./BaseAPIController')

// NOTA: api-keys NO está en entities.json - hardcodeamos el slug
const slug = 'api-keys'

class ApiKeysAPIController extends BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication (superadmin key)
   * NO acepta teamId - api-keys es entidad global
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null) {
    // NO pasar teamId (null) para entidades globales
    super(baseUrl, apiKey, null, { slug })
  }

  // ============================================
  // SEMANTIC ALIASES
  // ============================================

  /**
   * GET /api/v1/api-keys - List all API keys
   * @param {Object} options - Query options (page, limit, etc.)
   */
  getApiKeys(options = {}) {
    return this.list(options)
  }

  /**
   * GET /api/v1/api-keys/{id} - Get API key by ID
   * @param {string} id - API key ID
   * @param {Object} options - Additional options
   */
  getApiKeyById(id, options = {}) {
    return this.getById(id, options)
  }

  /**
   * POST /api/v1/api-keys - Create new API key
   * @param {Object} apiKeyData - API key data (name, scopes, expiresAt)
   * @param {Object} options - Additional options
   */
  createApiKey(apiKeyData, options = {}) {
    return this.create(apiKeyData, options)
  }

  /**
   * PATCH /api/v1/api-keys/{id} - Update API key
   * @param {string} id - API key ID
   * @param {Object} updateData - Fields to update
   * @param {Object} options - Additional options
   */
  updateApiKey(id, updateData, options = {}) {
    return this.update(id, updateData, options)
  }

  /**
   * DELETE /api/v1/api-keys/{id} - Revoke API key
   * @param {string} id - API key ID
   * @param {Object} options - Additional options
   */
  deleteApiKey(id, options = {}) {
    return this.delete(id, options)
  }

  // ============================================
  // DATA GENERATORS
  // ============================================

  /**
   * Generate random API key data (required by createTestEntity)
   * @param {Object} overrides - Fields to override
   */
  generateRandomData(overrides = {}) {
    return this.generateRandomApiKeyData(overrides)
  }

  /**
   * Generate random API key data for testing
   * @param {Object} overrides - Fields to override
   */
  generateRandomApiKeyData(overrides = {}) {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    return {
      name: `Cypress Test Key ${randomId} - ${timestamp}`,
      scopes: ['users:read', 'tasks:read'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides
    }
  }

  /**
   * Create a test API key
   * @param {Object} apiKeyData - API key data overrides
   */
  createTestApiKey(apiKeyData = {}) {
    return this.createTestEntity(apiKeyData)
  }

  /**
   * Cleanup (delete) a test API key
   * @param {string} id - API key ID
   */
  cleanupTestApiKey(id) {
    return this.cleanup(id)
  }

  // ============================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================

  /**
   * Validate API key object structure
   * @param {Object} apiKey - API key object from response
   */
  validateApiKeyObject(apiKey) {
    // Base fields
    this.validateBaseEntityFields(apiKey)

    // Required entity fields
    expect(apiKey).to.have.property('name')
    expect(apiKey.name).to.be.a('string')

    expect(apiKey).to.have.property('keyPrefix')
    expect(apiKey.keyPrefix).to.be.a('string')

    expect(apiKey).to.have.property('scopes')
    expect(apiKey.scopes).to.be.an('array')

    expect(apiKey).to.have.property('status')
    expect(apiKey.status).to.be.oneOf(['active', 'inactive', 'expired'])
  }

  /**
   * Validate API key response on creation (includes full key)
   * @param {Object} response - API response
   */
  validateCreatedApiKey(response) {
    expect(response.status).to.eq(201)
    expect(response.body).to.have.property('success', true)
    expect(response.body.data).to.have.property('id')
    expect(response.body.data).to.have.property('key') // Full key only on creation
    expect(response.body.data).to.have.property('name')
    expect(response.body.data).to.have.property('scopes')
    expect(response.body.data).to.have.property('warning') // Security warning about key visibility
  }

  /**
   * Validate revoked API key response
   * @param {Object} response - API response
   */
  validateRevokedApiKey(response) {
    expect(response.status).to.eq(200)
    expect(response.body).to.have.property('success', true)
    expect(response.body.data).to.have.property('revoked', true)
    expect(response.body.data).to.have.property('id')
  }
}

module.exports = ApiKeysAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.ApiKeysAPIController = ApiKeysAPIController
}
