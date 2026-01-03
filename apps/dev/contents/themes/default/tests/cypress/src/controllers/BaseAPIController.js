/**
 * BaseAPIController - Base class for all API Controllers
 *
 * Provides:
 * - Consistent header handling (x-team-id ALWAYS included)
 * - Standard CRUD operations
 * - Common validators
 * - Extensibility via configuration
 *
 * All entity-specific controllers should extend this class.
 */
class BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication
   * @param {string|null} teamId - Team ID for x-team-id header
   * @param {Object} config - Entity-specific configuration
   * @param {string} config.slug - Entity slug (e.g., 'tasks', 'customers')
   * @param {string} [config.endpoint] - Custom endpoint (default: /api/v1/{slug})
   * @param {string} [config.updateMethod='PATCH'] - HTTP method for updates
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null, config = {}) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
    this.teamId = teamId
    this.entitySlug = config.slug || 'entity'
    this.endpoint = config.endpoint || `/api/v1/${this.entitySlug}`
    this.updateMethod = config.updateMethod || 'PATCH'
  }

  // ============================================================
  // SETTERS (Fluent API)
  // ============================================================

  /**
   * Set the API key for requests
   * @param {string|null} apiKey - Valid API key or null
   * @returns {this} For method chaining
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey
    return this
  }

  /**
   * Set the team ID for requests
   * @param {string|null} teamId - Valid team ID or null
   * @returns {this} For method chaining
   */
  setTeamId(teamId) {
    this.teamId = teamId
    return this
  }

  // ============================================================
  // HEADERS - CRITICAL: x-team-id is ALWAYS included
  // ============================================================

  /**
   * Build headers for requests
   * GUARANTEES x-team-id is present if teamId is configured
   *
   * @param {Object} additionalHeaders - Additional headers to include
   * @returns {Object} Complete headers object
   */
  getHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    // CRITICAL: Always include x-team-id if configured
    if (this.teamId) {
      headers['x-team-id'] = this.teamId
    }

    return headers
  }

  // ============================================================
  // URL BUILDER
  // ============================================================

  /**
   * Build full URL with optional query parameters
   * @param {string} path - Path to append to endpoint
   * @param {Object} queryParams - Query parameters
   * @returns {string} Full URL
   */
  buildUrl(path = '', queryParams = {}) {
    const baseEndpoint = `${this.baseUrl}${this.endpoint}${path}`

    // Filter out undefined/null/empty values
    const filteredParams = Object.entries(queryParams)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')

    if (filteredParams.length === 0) {
      return baseEndpoint
    }

    const params = new URLSearchParams()
    filteredParams.forEach(([key, value]) => {
      params.append(key, String(value))
    })

    return `${baseEndpoint}?${params.toString()}`
  }

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * GET /api/v1/{entity} - List entities
   * @param {Object} options - Query options
   * @param {number} [options.page] - Page number
   * @param {number} [options.limit] - Results per page
   * @param {string} [options.search] - Search term
   * @param {string} [options.metas] - Metadata parameter ('all', 'key1,key2', etc.)
   * @param {string} [options.sortBy] - Sort field
   * @param {string} [options.sortOrder] - Sort order ('asc' or 'desc')
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  list(options = {}) {
    const { headers = {}, ...queryParams } = options

    return cy.request({
      method: 'GET',
      url: this.buildUrl('', queryParams),
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  /**
   * GET /api/v1/{entity}/{id} - Get entity by ID
   * @param {string} id - Entity ID
   * @param {Object} options - Additional options
   * @param {string} [options.metas] - Metadata parameter
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getById(id, options = {}) {
    const { metas, headers = {} } = options
    const queryParams = metas ? { metas } : {}

    return cy.request({
      method: 'GET',
      url: this.buildUrl(`/${id}`, queryParams),
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  /**
   * POST /api/v1/{entity} - Create entity
   * @param {Object} data - Entity data
   * @param {Object} options - Additional options
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  create(data, options = {}) {
    const { headers = {} } = options

    return cy.request({
      method: 'POST',
      url: this.buildUrl(''),
      headers: this.getHeaders(headers),
      body: data,
      failOnStatusCode: false
    })
  }

  /**
   * PATCH/PUT /api/v1/{entity}/{id} - Update entity
   * Uses the updateMethod configured for this controller
   * @param {string} id - Entity ID
   * @param {Object} data - Update data
   * @param {Object} options - Additional options
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  update(id, data, options = {}) {
    const { headers = {} } = options

    return cy.request({
      method: this.updateMethod,
      url: this.buildUrl(`/${id}`),
      headers: this.getHeaders(headers),
      body: data,
      failOnStatusCode: false
    })
  }

  /**
   * DELETE /api/v1/{entity}/{id} - Delete entity
   * @param {string} id - Entity ID
   * @param {Object} options - Additional options
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  delete(id, options = {}) {
    const { headers = {} } = options

    return cy.request({
      method: 'DELETE',
      url: this.buildUrl(`/${id}`),
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  // ============================================================
  // COMMON VALIDATORS
  // ============================================================

  /**
   * Validate success response structure
   * @param {Object} response - API response
   * @param {number} expectedStatus - Expected status code (default: 200)
   */
  validateSuccessResponse(response, expectedStatus = 200) {
    expect(response.status).to.eq(expectedStatus)
    expect(response.body).to.have.property('success', true)
    expect(response.body).to.have.property('data')
    expect(response.body).to.have.property('info')
    expect(response.body.info).to.have.property('timestamp')
  }

  /**
   * Validate error response structure
   * @param {Object} response - API response
   * @param {number} expectedStatus - Expected status code
   * @param {string|null} expectedCode - Expected error code (optional)
   */
  validateErrorResponse(response, expectedStatus, expectedCode = null) {
    expect(response.status).to.eq(expectedStatus)
    expect(response.body).to.have.property('success', false)
    expect(response.body).to.have.property('error')

    if (expectedCode) {
      expect(response.body).to.have.property('code', expectedCode)
    }
  }

  /**
   * Validate paginated response structure
   * @param {Object} response - API response
   */
  validatePaginatedResponse(response) {
    this.validateSuccessResponse(response)
    expect(response.body.data).to.be.an('array')

    const info = response.body.info
    expect(info).to.have.property('page')
    expect(info).to.have.property('limit')
    expect(info).to.have.property('total')
    expect(info).to.have.property('totalPages')
  }

  /**
   * Validate base entity fields (id, createdAt, updatedAt)
   * @param {Object} entity - Entity object
   */
  validateBaseEntityFields(entity) {
    expect(entity).to.have.property('id')
    expect(entity).to.have.property('createdAt')
    expect(entity).to.have.property('updatedAt')
  }

  // ============================================================
  // TEST HELPERS
  // ============================================================

  /**
   * Create a test entity and return its data
   * Subclasses should override generateRandomData() for this to work
   * @param {Object} overrides - Data overrides
   * @returns {Cypress.Chainable} Promise resolving with created entity data
   */
  createTestEntity(overrides = {}) {
    if (typeof this.generateRandomData !== 'function') {
      throw new Error(`generateRandomData() not implemented for ${this.entitySlug}`)
    }

    const testData = this.generateRandomData(overrides)

    return this.create(testData).then((response) => {
      if (response.status === 201) {
        return { ...testData, ...response.body.data }
      }
      throw new Error(`Failed to create test ${this.entitySlug}: ${response.body?.error || 'Unknown error'}`)
    })
  }

  /**
   * Clean up a test entity (delete it)
   * @param {string} id - Entity ID
   * @returns {Cypress.Chainable} Delete response
   */
  cleanup(id) {
    return this.delete(id)
  }
}

// Export for CommonJS
module.exports = BaseAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.BaseAPIController = BaseAPIController
}
