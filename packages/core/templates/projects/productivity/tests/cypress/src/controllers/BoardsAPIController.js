/**
 * BoardsAPIController - Controller for interacting with the Boards API
 * Encapsulates all CRUD operations for /api/v1/boards endpoints
 *
 * Requires:
 * - API Key with boards:read, boards:write scopes (or superadmin with *)
 * - x-team-id header for team context
 */
class BoardsAPIController {
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.endpoints = {
      boards: '/api/v1/boards',
      boardById: (id) => `/api/v1/boards/${id}`
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
   * GET /api/v1/boards - Get list of boards
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Results per page
   * @param {boolean} options.archived - Filter by archived status
   * @param {string} options.search - Search in name/description
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getAll(options = {}) {
    const { page, limit, archived, search, headers = {} } = options;

    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (archived !== undefined) queryParams.append('archived', archived);
    if (search) queryParams.append('search', search);

    const url = `${this.baseUrl}${this.endpoints.boards}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * POST /api/v1/boards - Create new board
   * @param {Object} boardData - Board data
   * @param {string} boardData.name - Board name (required)
   * @param {string} boardData.description - Description (optional)
   * @param {string} boardData.color - Color: blue, green, purple, orange, red, pink, gray (optional)
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  create(boardData, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}${this.endpoints.boards}`,
      headers: this.getHeaders(headers),
      body: boardData,
      failOnStatusCode: false
    });
  }

  /**
   * GET /api/v1/boards/{id} - Get specific board by ID
   * @param {string} id - Board ID
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getById(id, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}${this.endpoints.boardById(id)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * PATCH /api/v1/boards/{id} - Update board
   * @param {string} id - Board ID
   * @param {Object} updateData - Data to update
   * @param {string} updateData.name - Board name (optional)
   * @param {string} updateData.description - Description (optional)
   * @param {string} updateData.color - Color (optional)
   * @param {boolean} updateData.archived - Archived status (optional)
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  update(id, updateData, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}${this.endpoints.boardById(id)}`,
      headers: this.getHeaders(headers),
      body: updateData,
      failOnStatusCode: false
    });
  }

  /**
   * DELETE /api/v1/boards/{id} - Delete board
   * @param {string} id - Board ID
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  delete(id, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}${this.endpoints.boardById(id)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  // ========== SPECIAL METHODS ==========

  /**
   * PATCH /api/v1/boards/{id} - Archive board
   * @param {string} id - Board ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  archive(id, options = {}) {
    return this.update(id, { archived: true }, options);
  }

  /**
   * PATCH /api/v1/boards/{id} - Unarchive board
   * @param {string} id - Board ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  unarchive(id, options = {}) {
    return this.update(id, { archived: false }, options);
  }

  // ========== UTILITY METHODS ==========

  /**
   * Generate random board data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated board data
   */
  generateRandomData(overrides = {}) {
    const randomId = Math.random().toString(36).substring(2, 8);
    const colors = ['blue', 'green', 'purple', 'orange', 'red', 'pink', 'gray'];
    const boardNames = ['Project Alpha', 'Marketing Campaign', 'Product Launch', 'Sprint Board', 'Roadmap', 'Bug Tracker'];

    return {
      name: `${boardNames[Math.floor(Math.random() * boardNames.length)]} ${randomId}`,
      description: `Test board description ${randomId}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      ...overrides
    };
  }

  /**
   * Create a test board and return its data
   * @param {Object} boardData - Board data (optional)
   * @returns {Cypress.Chainable} Promise resolving with created board data
   */
  createTestRecord(boardData = {}) {
    const testBoardData = this.generateRandomData(boardData);

    return this.create(testBoardData).then((response) => {
      if (response.status === 201) {
        return { ...testBoardData, ...response.body.data };
      }
      throw new Error(`Failed to create test board: ${response.body?.error || 'Unknown error'}`);
    });
  }

  /**
   * Clean up a test board (delete it)
   * @param {string} id - Board ID
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
   * Validate board object structure
   * @param {Object} board - Board object
   */
  validateObject(board) {
    // Required system fields
    expect(board).to.have.property('id');
    expect(board).to.have.property('createdAt');
    expect(board).to.have.property('updatedAt');

    // Required entity fields
    expect(board).to.have.property('name');
    expect(board.name).to.be.a('string');

    // Optional fields
    if (board.description !== null && board.description !== undefined) {
      expect(board.description).to.be.a('string');
    }

    if (board.color !== null && board.color !== undefined) {
      expect(board.color).to.be.oneOf(['blue', 'green', 'purple', 'orange', 'red', 'pink', 'gray']);
    }

    if (board.archived !== null && board.archived !== undefined) {
      expect(board.archived).to.be.a('boolean');
    }
  }
}

// Export class for use in tests
module.exports = BoardsAPIController;

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.BoardsAPIController = BoardsAPIController;
}
