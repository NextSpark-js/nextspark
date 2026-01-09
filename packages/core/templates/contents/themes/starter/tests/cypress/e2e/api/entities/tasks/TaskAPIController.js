/**
 * TaskAPIController - Controller for interacting with the Tasks API
 * Encapsulates all CRUD operations for /api/v1/tasks endpoints
 *
 * Requires:
 * - API Key with tasks:read, tasks:write scopes (or superadmin with *)
 * - x-team-id header for team context
 */
const BaseAPIController = require('../../src/controllers/BaseAPIController')
const entitiesConfig = require('../../fixtures/entities.json')

const { slug } = entitiesConfig.entities.tasks

class TaskAPIController extends BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication
   * @param {string|null} teamId - Team ID for x-team-id header
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {
    super(baseUrl, apiKey, teamId, { slug })
  }

  // ============================================================
  // SEMANTIC ALIASES (for backward compatibility)
  // ============================================================

  /**
   * GET /api/v1/tasks - Get list of tasks
   * @param {Object} options - Query options
   * @param {number} [options.page] - Page number
   * @param {number} [options.limit] - Results per page
   * @param {string} [options.status] - Filter by status (todo, in-progress, review, done, blocked)
   * @param {string} [options.priority] - Filter by priority (low, medium, high, urgent)
   * @param {string} [options.metas] - Metadata parameter ('all', 'key1,key2', etc.)
   * @param {string} [options.search] - Search in title/description
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getTasks(options = {}) {
    return this.list(options)
  }

  /**
   * GET /api/v1/tasks/{id} - Get specific task by ID
   * @param {string} id - Task ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getTaskById(id, options = {}) {
    return this.getById(id, options)
  }

  /**
   * POST /api/v1/tasks - Create new task
   * @param {Object} taskData - Task data
   * @param {string} taskData.title - Task title (required)
   * @param {string} [taskData.description] - Task description
   * @param {string} [taskData.status] - Status: todo, in-progress, review, done, blocked
   * @param {string} [taskData.priority] - Priority: low, medium, high, urgent
   * @param {string[]} [taskData.tags] - Array of tags
   * @param {string} [taskData.dueDate] - Due date YYYY-MM-DD
   * @param {number} [taskData.estimatedHours] - Estimated hours
   * @param {Object} [taskData.metas] - Metadata object
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  createTask(taskData, options = {}) {
    return this.create(taskData, options)
  }

  /**
   * PATCH /api/v1/tasks/{id} - Update task
   * @param {string} id - Task ID
   * @param {Object} updateData - Data to update
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  updateTask(id, updateData, options = {}) {
    return this.update(id, updateData, options)
  }

  /**
   * DELETE /api/v1/tasks/{id} - Delete task
   * @param {string} id - Task ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  deleteTask(id, options = {}) {
    return this.delete(id, options)
  }

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate random task data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated task data
   */
  generateRandomData(overrides = {}) {
    return this.generateRandomTaskData(overrides)
  }

  /**
   * Generate random task data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated task data
   */
  generateRandomTaskData(overrides = {}) {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    return {
      title: `Test Task ${randomId} - ${timestamp}`,
      description: `Description for test task created at ${new Date().toISOString()}`,
      status: 'todo',
      priority: 'medium',
      tags: [],
      ...overrides
    }
  }

  /**
   * Create a test task and return its data
   * @param {Object} taskData - Task data (optional)
   * @returns {Cypress.Chainable} Promise resolving with created task data
   */
  createTestTask(taskData = {}) {
    return this.createTestEntity(taskData)
  }

  /**
   * Clean up a test task (delete it)
   * @param {string} id - Task ID
   * @returns {Cypress.Chainable} Delete response
   */
  cleanupTestTask(id) {
    return this.cleanup(id)
  }

  // ============================================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================================

  /**
   * Validate task object structure
   * @param {Object} task - Task object
   * @param {boolean} allowMetas - If metas property is allowed
   */
  validateTaskObject(task, allowMetas = false) {
    // Base fields
    this.validateBaseEntityFields(task)

    // Required entity fields
    expect(task).to.have.property('title')
    expect(task.title).to.be.a('string')

    // Optional fields with defaults
    expect(task).to.have.property('status')
    expect(task.status).to.be.oneOf(['todo', 'in-progress', 'review', 'done', 'blocked'])

    expect(task).to.have.property('priority')
    expect(task.priority).to.be.oneOf(['low', 'medium', 'high', 'urgent'])

    expect(task).to.have.property('completed')
    expect(task.completed).to.be.a('boolean')

    expect(task).to.have.property('tags')
    expect(task.tags).to.be.an('array')

    // Optional fields that can be null
    if (task.description !== null && task.description !== undefined) {
      expect(task.description).to.be.a('string')
    }

    if (task.dueDate !== null && task.dueDate !== undefined) {
      expect(task.dueDate).to.be.a('string')
    }

    if (task.estimatedHours !== null && task.estimatedHours !== undefined) {
      // Note: NUMERIC type comes back as string from PostgreSQL
      expect(typeof task.estimatedHours === 'number' || typeof task.estimatedHours === 'string').to.be.true
    }

    // Validate metas if present
    if (allowMetas && task.hasOwnProperty('metas')) {
      expect(task.metas).to.be.an('object')
    }
  }

  // ============================================================
  // METADATA HELPERS
  // ============================================================

  /**
   * Generate sample metadata for testing
   * @param {string} type - Type of metadata ('uiPreferences', 'notifications', 'tracking', 'customFields')
   * @returns {Object} Sample metadata
   */
  generateSampleMetadata(type = 'uiPreferences') {
    const sampleMetas = {
      uiPreferences: {
        colorLabel: 'blue',
        showInKanban: true,
        collapsed: false,
        customIcon: 'star'
      },
      notifications: {
        emailOnDue: true,
        reminderDays: 3,
        notifyAssignee: true,
        channels: ['email', 'slack']
      },
      tracking: {
        actualHours: 5.5,
        startedAt: '2025-12-01T10:00:00Z',
        completedAt: null,
        progressPercent: 75
      },
      customFields: {
        clientRef: 'PRJ-001',
        department: 'Engineering',
        billable: true,
        hourlyRate: 150
      }
    }

    return { [type]: sampleMetas[type] || sampleMetas.uiPreferences }
  }
}

// Export class for use in tests
module.exports = TaskAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.TaskAPIController = TaskAPIController
}
