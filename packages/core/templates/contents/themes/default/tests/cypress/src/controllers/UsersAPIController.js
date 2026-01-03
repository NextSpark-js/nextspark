/**
 * UsersAPIController - Controller for interacting with the Users API
 * Encapsulates all CRUD operations for /api/v1/users endpoints
 *
 * NOTE: Users is a GLOBAL entity - does NOT require x-team-id header
 *
 * Requires:
 * - API Key with users:read, users:write scopes (or superadmin with *)
 */
const BaseAPIController = require('./BaseAPIController')
const entitiesConfig = require('../../fixtures/entities.json')

const { slug } = entitiesConfig.entities.users

class UsersAPIController extends BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication
   * NOTE: Does NOT accept teamId - users is a global entity
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null) {
    // NO pasar teamId (null) para entidades globales
    super(baseUrl, apiKey, null, { slug })
  }

  // ============================================================
  // SEMANTIC ALIASES (for backward compatibility)
  // ============================================================

  /**
   * GET /api/v1/users - Get list of users
   * @param {Object} options - Query options
   * @param {number} [options.page] - Page number
   * @param {number} [options.limit] - Results per page
   * @param {string} [options.role] - Filter by role ('member', 'superadmin')
   * @param {string} [options.metas] - Metadata parameter ('all', 'key1,key2', etc.)
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getUsers(options = {}) {
    return this.list(options)
  }

  /**
   * GET /api/v1/users/{id} - Get specific user by ID or email
   * @param {string} identifier - User ID or email
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getUserById(identifier, options = {}) {
    return this.getById(identifier, options)
  }

  /**
   * POST /api/v1/users - Create new user
   * @param {Object} userData - User data
   * @param {string} userData.email - User email (required)
   * @param {string} userData.firstName - User first name (required)
   * @param {string} userData.lastName - User last name (required)
   * @param {string} userData.country - User country (required, min 2 chars)
   * @param {string} [userData.image] - User image URL
   * @param {string} [userData.language] - User language (default: "en")
   * @param {string} [userData.timezone] - User timezone (default: "UTC")
   * @param {string} [userData.role] - User role (default: "member")
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  createUser(userData, options = {}) {
    return this.create(userData, options)
  }

  /**
   * PATCH /api/v1/users/{id} - Update user
   * @param {string} identifier - User ID or email
   * @param {Object} updateData - Data to update
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  updateUser(identifier, updateData, options = {}) {
    return this.update(identifier, updateData, options)
  }

  /**
   * DELETE /api/v1/users/{id} - Delete user
   * @param {string} identifier - User ID or email
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  deleteUser(identifier, options = {}) {
    return this.delete(identifier, options)
  }

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate random user data for testing
   * Required by BaseAPIController.createTestEntity()
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated user data
   */
  generateRandomData(overrides = {}) {
    return this.generateRandomUserData(overrides)
  }

  /**
   * Generate random user data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated user data
   */
  generateRandomUserData(overrides = {}) {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    return {
      email: `testuser_${timestamp}_${randomId}@nextspark.dev`,
      firstName: `TestUser${randomId}`,
      lastName: 'Cypress',
      country: 'US',
      role: 'member',
      language: 'en',
      timezone: 'UTC',
      ...overrides
    }
  }

  /**
   * Create a test user and return its data
   * @param {Object} userData - User data (optional)
   * @returns {Cypress.Chainable} Promise resolving with created user data
   */
  createTestUser(userData = {}) {
    return this.createTestEntity(userData)
  }

  /**
   * Clean up a test user (delete it)
   * @param {string} identifier - User ID or email
   * @returns {Cypress.Chainable} Delete response
   */
  cleanupTestUser(identifier) {
    return this.cleanup(identifier)
  }

  // ============================================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================================

  /**
   * Validate user object structure
   * @param {Object} user - User object
   * @param {boolean} allowMetas - If metas property is allowed
   */
  validateUserObject(user, allowMetas = false) {
    // Base fields from BaseAPIController
    this.validateBaseEntityFields(user)

    // Required entity fields
    expect(user).to.have.property('email')
    expect(user.email).to.be.a('string')

    expect(user).to.have.property('firstName')
    expect(user.firstName).to.be.a('string')

    expect(user).to.have.property('role')
    expect(user.role).to.be.oneOf(['member', 'colaborator', 'admin', 'superadmin'])

    expect(user).to.have.property('emailVerified')
    expect(user.emailVerified).to.be.a('boolean')

    // Optional fields that can be null
    if (user.name !== null && user.name !== undefined) {
      expect(user.name).to.be.a('string')
    }

    if (user.lastName !== null && user.lastName !== undefined) {
      expect(user.lastName).to.be.a('string')
    }

    if (user.country !== null && user.country !== undefined) {
      expect(user.country).to.be.a('string')
    }

    if (user.timezone !== null && user.timezone !== undefined) {
      expect(user.timezone).to.be.a('string')
    }

    if (user.language !== null && user.language !== undefined) {
      expect(user.language).to.be.a('string')
    }

    if (user.image !== null && user.image !== undefined) {
      expect(user.image).to.be.a('string')
    }

    // Validate metas if present
    if (allowMetas && user.hasOwnProperty('metas')) {
      expect(user.metas).to.be.an('object')
    }
  }

  // ============================================================
  // METADATA HELPERS
  // ============================================================

  /**
   * Generate sample metadata for testing
   * @param {string} type - Type of metadata ('uiPreferences', 'securityPreferences', 'notificationPreferences')
   * @returns {Object} Sample metadata
   */
  generateSampleMetadata(type = 'uiPreferences') {
    const sampleMetas = {
      uiPreferences: {
        theme: 'dark',
        sidebarCollapsed: false,
        language: 'en',
        density: 'comfortable'
      },
      securityPreferences: {
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        trustedDevices: []
      },
      notificationPreferences: {
        emailEnabled: true,
        pushEnabled: false,
        digestFrequency: 'daily'
      }
    }

    return { [type]: sampleMetas[type] || sampleMetas.uiPreferences }
  }
}

// Export class for use in tests
module.exports = UsersAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.UsersAPIController = UsersAPIController
}
