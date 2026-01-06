/**
 * BaseAPIController - Abstract base class for all CRM API controllers
 *
 * Provides common functionality for:
 * - HTTP request handling with authentication
 * - Response validation
 * - Test data generation
 * - Error handling
 */

export interface APIRequestOptions {
  headers?: Record<string, string>
  page?: number
  limit?: number
  search?: string
  metas?: string
  [key: string]: unknown
}

export interface APIResponse<T = unknown> {
  status: number
  body: {
    success: boolean
    data: T
    info: {
      page?: number
      limit?: number
      total?: number | string
      totalPages?: number
      timestamp: string
    }
    error?: string
    code?: string
  }
}

export interface CreateTestRecordOptions {
  withRetry?: boolean
  maxRetries?: number
}

export abstract class BaseAPIController {
  protected baseUrl: string
  protected apiKey: string | null
  protected teamId: string | null
  protected abstract entitySlug: string

  constructor(
    baseUrl = 'http://localhost:5173',
    apiKey: string | null = null,
    teamId: string | null = null
  ) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
    this.teamId = teamId
  }

  /**
   * Get the API endpoint for this entity
   */
  protected get endpoint(): string {
    return `/api/v1/${this.entitySlug}`
  }

  /**
   * Get endpoint for a specific record by ID
   */
  protected endpointById(id: string): string {
    return `${this.endpoint}/${id}`
  }

  /**
   * Set the API key for requests
   */
  setApiKey(apiKey: string): this {
    this.apiKey = apiKey
    return this
  }

  /**
   * Set the team ID for requests
   */
  setTeamId(teamId: string): this {
    this.teamId = teamId
    return this
  }

  /**
   * Get default headers for requests
   */
  protected getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    if (this.teamId) {
      headers['x-team-id'] = this.teamId
    }

    return headers
  }

  /**
   * Build query string from options
   */
  protected buildQueryString(options: Record<string, unknown>): string {
    const queryParams = new URLSearchParams()

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'headers') {
        queryParams.append(key, String(value))
      }
    })

    const queryString = queryParams.toString()
    return queryString ? `?${queryString}` : ''
  }

  /**
   * GET all records with optional filtering
   */
  getAll(options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    const { headers = {}, ...queryOptions } = options
    const url = `${this.baseUrl}${this.endpoint}${this.buildQueryString(queryOptions)}`

    return cy.request({
      method: 'GET',
      url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  /**
   * GET a single record by ID
   */
  getById(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    const { headers = {}, metas } = options
    const queryParams: Record<string, unknown> = {}
    if (metas) queryParams.metas = metas

    const url = `${this.baseUrl}${this.endpointById(id)}${this.buildQueryString(queryParams)}`

    return cy.request({
      method: 'GET',
      url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  /**
   * POST create a new record
   */
  create(data: Record<string, unknown>, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    const { headers = {} } = options

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}${this.endpoint}`,
      headers: this.getHeaders(headers),
      body: data,
      failOnStatusCode: false
    })
  }

  /**
   * PATCH update an existing record
   */
  update(id: string, data: Record<string, unknown>, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    const { headers = {} } = options

    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}${this.endpointById(id)}`,
      headers: this.getHeaders(headers),
      body: data,
      failOnStatusCode: false
    })
  }

  /**
   * DELETE a record
   */
  delete(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    const { headers = {} } = options

    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}${this.endpointById(id)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    })
  }

  /**
   * Generate random test data - must be implemented by subclasses
   */
  abstract generateRandomData(overrides?: Record<string, unknown>): Record<string, unknown>

  /**
   * Create a test record with optional retry logic
   */
  createTestRecord(
    data: Record<string, unknown> = {},
    options: CreateTestRecordOptions = {}
  ): Cypress.Chainable<Record<string, unknown>> {
    const { withRetry = false, maxRetries = 3 } = options
    const testData = this.generateRandomData(data)

    if (withRetry) {
      return this.createWithRetry(testData, maxRetries)
    }

    return this.create(testData).then((response) => {
      if (response.status === 201) {
        return { ...testData, ...response.body.data }
      }
      throw new Error(`Failed to create test record: ${response.body?.error || 'Unknown error'}`)
    })
  }

  /**
   * Create with retry logic for handling transient failures
   */
  protected createWithRetry(
    data: Record<string, unknown>,
    maxRetries: number,
    currentAttempt = 1
  ): Cypress.Chainable<Record<string, unknown>> {
    return this.create(data).then((response) => {
      if (response.status === 201) {
        return { ...data, ...response.body.data }
      }

      if (response.status === 500 && currentAttempt < maxRetries) {
        cy.wait(500 * currentAttempt) // Exponential backoff
        return this.createWithRetry(data, maxRetries, currentAttempt + 1)
      }

      throw new Error(`Failed to create test record after ${currentAttempt} attempts: ${response.body?.error || 'Unknown error'}`)
    })
  }

  /**
   * Clean up a test record
   */
  cleanupTestRecord(id: string): Cypress.Chainable<APIResponse> {
    return this.delete(id)
  }

  // ========== VALIDATION METHODS ==========

  /**
   * Validate success response structure
   */
  validateSuccessResponse(response: APIResponse, expectedStatus = 200): void {
    expect(response.status).to.eq(expectedStatus)
    expect(response.body).to.have.property('success', true)
    expect(response.body).to.have.property('data')
    expect(response.body).to.have.property('info')
    expect(response.body.info).to.have.property('timestamp')
  }

  /**
   * Validate error response structure
   */
  validateErrorResponse(response: APIResponse, expectedStatus: number, expectedErrorCode?: string): void {
    expect(response.status).to.eq(expectedStatus)
    expect(response.body).to.have.property('success', false)
    expect(response.body).to.have.property('error')

    if (expectedErrorCode) {
      expect(response.body).to.have.property('code', expectedErrorCode)
    }
  }

  /**
   * Validate basic object structure - must be implemented by subclasses
   */
  abstract validateObject(obj: Record<string, unknown>, allowMetas?: boolean): void

  /**
   * Validate common system fields present in all entities
   */
  protected validateSystemFields(obj: Record<string, unknown>): void {
    expect(obj).to.have.property('id')
    expect(obj).to.have.property('createdAt')
    expect(obj).to.have.property('updatedAt')
  }

  /**
   * Helper to validate optional string fields
   */
  protected validateOptionalStringFields(obj: Record<string, unknown>, fields: string[]): void {
    fields.forEach(field => {
      if (obj[field] !== null && obj[field] !== undefined) {
        expect(obj[field]).to.be.a('string')
      }
    })
  }
}
