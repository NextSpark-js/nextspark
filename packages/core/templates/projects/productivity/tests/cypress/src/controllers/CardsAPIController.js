/**
 * CardsAPIController - Controller for interacting with the Cards API
 * Encapsulates all CRUD operations for /api/v1/cards endpoints
 * Cards are tasks within a Kanban list (column)
 *
 * Requires:
 * - API Key with cards:read, cards:write scopes (or superadmin with *)
 * - x-team-id header for team context
 */
class CardsAPIController {
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.endpoints = {
      cards: '/api/v1/cards',
      cardById: (id) => `/api/v1/cards/${id}`
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
   * GET /api/v1/cards - Get list of cards
   * @param {Object} options - Query options
   * @param {string} options.boardId - Filter by board ID
   * @param {string} options.listId - Filter by list ID
   * @param {string} options.assigneeId - Filter by assignee
   * @param {string} options.priority - Filter by priority (low, medium, high, urgent)
   * @param {number} options.page - Page number
   * @param {number} options.limit - Results per page
   * @param {string} options.search - Search in title/description
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getAll(options = {}) {
    const { boardId, listId, assigneeId, priority, page, limit, search, headers = {} } = options;

    const queryParams = new URLSearchParams();
    if (boardId) queryParams.append('boardId', boardId);
    if (listId) queryParams.append('listId', listId);
    if (assigneeId) queryParams.append('assigneeId', assigneeId);
    if (priority) queryParams.append('priority', priority);
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (search) queryParams.append('search', search);

    const url = `${this.baseUrl}${this.endpoints.cards}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * POST /api/v1/cards - Create new card
   * @param {Object} cardData - Card data
   * @param {string} cardData.title - Card title (required)
   * @param {string} cardData.listId - Parent list ID (required)
   * @param {string} cardData.boardId - Parent board ID (required)
   * @param {string} cardData.description - Description (optional)
   * @param {string} cardData.priority - Priority: low, medium, high, urgent (optional)
   * @param {string} cardData.dueDate - Due date ISO string (optional)
   * @param {Array<string>} cardData.labels - Labels array (optional)
   * @param {string} cardData.assigneeId - Assignee user ID (optional)
   * @param {number} cardData.position - Position in list (optional)
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  create(cardData, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}${this.endpoints.cards}`,
      headers: this.getHeaders(headers),
      body: cardData,
      failOnStatusCode: false
    });
  }

  /**
   * GET /api/v1/cards/{id} - Get specific card by ID
   * @param {string} id - Card ID
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getById(id, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}${this.endpoints.cardById(id)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * PATCH /api/v1/cards/{id} - Update card
   * @param {string} id - Card ID
   * @param {Object} updateData - Data to update
   * @param {string} updateData.title - Card title (optional)
   * @param {string} updateData.description - Description (optional)
   * @param {string} updateData.priority - Priority (optional)
   * @param {string} updateData.dueDate - Due date (optional)
   * @param {Array<string>} updateData.labels - Labels (optional)
   * @param {string} updateData.assigneeId - Assignee (optional)
   * @param {string} updateData.listId - Move to different list (optional)
   * @param {number} updateData.position - Position in list (optional)
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  update(id, updateData, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}${this.endpoints.cardById(id)}`,
      headers: this.getHeaders(headers),
      body: updateData,
      failOnStatusCode: false
    });
  }

  /**
   * DELETE /api/v1/cards/{id} - Delete card
   * @param {string} id - Card ID
   * @param {Object} options - Additional options
   * @param {Object} options.headers - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  delete(id, options = {}) {
    const { headers = {} } = options;

    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}${this.endpoints.cardById(id)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  // ========== SPECIAL METHODS ==========

  /**
   * Move card to a different list
   * @param {string} id - Card ID
   * @param {string} targetListId - Target list ID
   * @param {number} position - Position in target list (optional)
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  move(id, targetListId, position = 0, options = {}) {
    return this.update(id, { listId: targetListId, position }, options);
  }

  /**
   * Assign card to a user
   * @param {string} id - Card ID
   * @param {string} assigneeId - User ID to assign
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  assign(id, assigneeId, options = {}) {
    return this.update(id, { assigneeId }, options);
  }

  /**
   * Unassign card
   * @param {string} id - Card ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  unassign(id, options = {}) {
    return this.update(id, { assigneeId: null }, options);
  }

  /**
   * Set card priority
   * @param {string} id - Card ID
   * @param {string} priority - Priority: low, medium, high, urgent
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  setPriority(id, priority, options = {}) {
    return this.update(id, { priority }, options);
  }

  /**
   * Set card due date
   * @param {string} id - Card ID
   * @param {string} dueDate - Due date ISO string
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  setDueDate(id, dueDate, options = {}) {
    return this.update(id, { dueDate }, options);
  }

  /**
   * Get all cards for a specific board
   * @param {string} boardId - Board ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getByBoard(boardId, options = {}) {
    return this.getAll({ ...options, boardId, limit: 500 });
  }

  /**
   * Get all cards for a specific list
   * @param {string} listId - List ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getByList(listId, options = {}) {
    return this.getAll({ ...options, listId, limit: 100 });
  }

  // ========== UTILITY METHODS ==========

  /**
   * Generate random card data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated card data
   */
  generateRandomData(overrides = {}) {
    const randomId = Math.random().toString(36).substring(2, 8);
    const priorities = ['low', 'medium', 'high', 'urgent'];
    const labels = ['bug', 'feature', 'enhancement', 'documentation', 'urgent', 'important'];
    const cardTitles = [
      'Fix login bug',
      'Implement search feature',
      'Update documentation',
      'Refactor API',
      'Add unit tests',
      'Review pull request',
      'Deploy to staging',
      'Performance optimization'
    ];

    // Generate random due date (1-30 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 30) + 1);

    return {
      title: `${cardTitles[Math.floor(Math.random() * cardTitles.length)]} ${randomId}`,
      description: `Test card description for task ${randomId}`,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      dueDate: futureDate.toISOString().split('T')[0],
      labels: [labels[Math.floor(Math.random() * labels.length)]],
      ...overrides
    };
  }

  /**
   * Create a test card and return its data
   * @param {string} boardId - Parent board ID
   * @param {string} listId - Parent list ID
   * @param {Object} cardData - Card data (optional)
   * @returns {Cypress.Chainable} Promise resolving with created card data
   */
  createTestRecord(boardId, listId, cardData = {}) {
    const testCardData = this.generateRandomData({ ...cardData, boardId, listId });

    return this.create(testCardData).then((response) => {
      if (response.status === 201) {
        return { ...testCardData, ...response.body.data };
      }
      throw new Error(`Failed to create test card: ${response.body?.error || 'Unknown error'}`);
    });
  }

  /**
   * Clean up a test card (delete it)
   * @param {string} id - Card ID
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
   * Validate card object structure
   * @param {Object} card - Card object
   */
  validateObject(card) {
    // Required system fields
    expect(card).to.have.property('id');
    expect(card).to.have.property('createdAt');
    expect(card).to.have.property('updatedAt');

    // Required entity fields
    expect(card).to.have.property('title');
    expect(card.title).to.be.a('string');

    expect(card).to.have.property('listId');
    expect(card.listId).to.be.a('string');

    expect(card).to.have.property('boardId');
    expect(card.boardId).to.be.a('string');

    // Optional fields
    if (card.description !== null && card.description !== undefined) {
      expect(card.description).to.be.a('string');
    }

    if (card.priority !== null && card.priority !== undefined) {
      expect(card.priority).to.be.oneOf(['low', 'medium', 'high', 'urgent']);
    }

    if (card.dueDate !== null && card.dueDate !== undefined) {
      expect(card.dueDate).to.be.a('string');
    }

    if (card.labels !== null && card.labels !== undefined) {
      expect(card.labels).to.be.an('array');
    }

    if (card.position !== null && card.position !== undefined) {
      expect(card.position).to.be.a('number');
    }
  }
}

// Export class for use in tests
module.exports = CardsAPIController;

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.CardsAPIController = CardsAPIController;
}
