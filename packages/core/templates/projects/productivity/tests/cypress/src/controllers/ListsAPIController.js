/**
 * ListsAPIController - Controller for interacting with the Lists API
 * Encapsulates all CRUD operations for /api/v1/lists endpoints
 * Lists are columns within a Kanban board
 *
 * Requires:
 * - API Key with lists:read, lists:write scopes (or superadmin with *)
 * - x-team-id header for team context
 */
class ListsAPIController {
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.endpoints = {
      lists: '/api/v1/lists',
      listById: (id) => `/api/v1/lists/${id}`
    };
  }

  /**
   * Set the API key for requests
   * @param {string} apiKey - Valid API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    return this;
  }

  /**
   * Set the team ID for requests
   * @param {string} teamId - Valid team ID
   */
  setTeamId(teamId) {
    this.teamId = teamId;
    return this;
  }

  /**
   * Get default headers for requests
   * @param {Object} additionalHeaders - Additional headers
   * @returns {Object} Complete headers
   */
  getHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (this.teamId) {
      headers['x-team-id'] = this.teamId;
    }

    return headers;
  }

  /**
   * GET /api/v1/lists - Get list of lists (columns)
   * @param {Object} options - Query options
   * @param {string} options.boardId - Filter by board ID (required for most use cases)
   * @param {number} options.page - Page number
   * @param {number} options.limit - Results per page
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getAll(options = {}) {
    const { boardId, page, limit, headers = {} } = options;

    const queryParams = new URLSearchParams();
    if (boardId) queryParams.append('boardId', boardId);
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);

    const url = `${this.baseUrl}${this.endpoints.lists}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * POST /api/v1/lists - Create new list (column)
   * @param {Object} listData - List data
   * @param {string} listData.name - List name (required)
   * @param {string} listData.boardId - Parent board ID (required)
   * @param {number} listData.position - Position in board (optional)
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  create(listData, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}${this.endpoints.lists}`,
      headers: this.getHeaders(headers),
      body: listData,
      failOnStatusCode: false
    });
  }

  /**
   * GET /api/v1/lists/{id} - Get specific list by ID
   * @param {string} id - List ID
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getById(id, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}${this.endpoints.listById(id)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * PATCH /api/v1/lists/{id} - Update list
   * @param {string} id - List ID
   * @param {Object} updateData - Data to update
   * @param {string} updateData.name - List name (optional)
   * @param {number} updateData.position - Position (optional)
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  update(id, updateData, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}${this.endpoints.listById(id)}`,
      headers: this.getHeaders(headers),
      body: updateData,
      failOnStatusCode: false
    });
  }

  /**
   * DELETE /api/v1/lists/{id} - Delete list
   * @param {string} id - List ID
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  delete(id, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}${this.endpoints.listById(id)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  // ========== SPECIAL METHODS ==========

  /**
   * Reorder lists within a board
   * @param {string} boardId - Board ID
   * @param {Array<{id: string, position: number}>} listPositions - Array of list IDs with new positions
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response chain
   */
  reorder(boardId, listPositions, options = {}) {
    // Update each list's position
    const updates = listPositions.map(({ id, position }) =>
      this.update(id, { position }, options)
    );

    return cy.wrap(updates);
  }

  /**
   * Get all lists for a specific board
   * @param {string} boardId - Board ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getByBoard(boardId, options = {}) {
    return this.getAll({ ...options, boardId, limit: 100 });
  }

  // ========== UTILITY METHODS ==========

  /**
   * Generate random list data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated list data
   */
  generateRandomData(overrides = {}) {
    const randomId = Math.random().toString(36).substring(2, 8);
    const listNames = ['To Do', 'In Progress', 'Review', 'Done', 'Backlog', 'Blocked'];

    return {
      name: `${listNames[Math.floor(Math.random() * listNames.length)]} ${randomId}`,
      position: Math.floor(Math.random() * 10),
      ...overrides
    };
  }

  /**
   * Create a test list and return its data
   * @param {string} boardId - Parent board ID
   * @param {Object} listData - List data (optional)
   * @returns {Cypress.Chainable} Promise resolving with created list data
   */
  createTestRecord(boardId, listData = {}) {
    const testListData = this.generateRandomData({ ...listData, boardId });

    return this.create(testListData).then((response) => {
      if (response.status === 201) {
        return { ...testListData, ...response.body.data };
      }
      throw new Error(`Failed to create test list: ${response.body?.error || 'Unknown error'}`);
    });
  }

  /**
   * Clean up a test list (delete it)
   * @param {string} id - List ID
   * @returns {Cypress.Chainable} Delete response
   */
  cleanupTestRecord(id) {
    return this.delete(id);
  }

  // ========== VALIDATION METHODS ==========

  /**
   * Validate success response structure
   * @param {Object} response - API response
   * @param {number} expectedStatus - Expected status code
   */
  validateSuccessResponse(response, expectedStatus = 200) {
    expect(response.status).to.eq(expectedStatus);
    expect(response.body).to.have.property('success', true);
    expect(response.body).to.have.property('data');
  }

  /**
   * Validate error response structure
   * @param {Object} response - API response
   * @param {number} expectedStatus - Expected status code
   * @param {string} expectedErrorCode - Expected error code (optional)
   */
  validateErrorResponse(response, expectedStatus, expectedErrorCode = null) {
    expect(response.status).to.eq(expectedStatus);
    expect(response.body).to.have.property('success', false);
    expect(response.body).to.have.property('error');

    if (expectedErrorCode) {
      expect(response.body).to.have.property('code', expectedErrorCode);
    }
  }

  /**
   * Validate list object structure
   * @param {Object} list - List object
   */
  validateObject(list) {
    // Required system fields
    expect(list).to.have.property('id');
    expect(list).to.have.property('createdAt');
    expect(list).to.have.property('updatedAt');

    // Required entity fields
    expect(list).to.have.property('name');
    expect(list.name).to.be.a('string');

    expect(list).to.have.property('boardId');
    expect(list.boardId).to.be.a('string');

    // Optional fields
    if (list.position !== null && list.position !== undefined) {
      expect(list.position).to.be.a('number');
    }
  }
}

// Export class for use in tests
module.exports = ListsAPIController;

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.ListsAPIController = ListsAPIController;
}
