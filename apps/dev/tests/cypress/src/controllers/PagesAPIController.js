/**
 * PagesAPIController - Controller for interacting with the Pages API
 * Encapsulates all CRUD operations for /api/v1/pages endpoints
 *
 * Requires:
 * - API Key with pages:read, pages:write scopes (or superadmin with *)
 * - x-team-id header for team context
 *
 * Entity characteristics:
 * - Required fields: slug, title, blocks, locale
 * - Optional fields: SEO fields
 * - Unique constraint: slug + locale
 * - Status system: draft, published, scheduled, archived
 * - Uses PATCH for updates
 */
const BaseAPIController = require('./BaseAPIController')
const entitiesConfig = require('../../fixtures/entities.json')

const { slug } = entitiesConfig.entities.pages

class PagesAPIController extends BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication
   * @param {string|null} teamId - Team ID for x-team-id header
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {
    super(baseUrl, apiKey, teamId, { slug })
  }

  // ============================================================
  // SEMANTIC ALIASES (for better readability in tests)
  // ============================================================

  /**
   * GET /api/v1/pages - List pages
   * @param {Object} options - Query options
   * @param {number} [options.page] - Page number
   * @param {number} [options.limit] - Results per page
   * @param {string} [options.status] - Filter by status (draft, published, scheduled, archived)
   * @param {string} [options.locale] - Filter by locale
   * @param {string} [options.search] - Search in title
   * @param {string} [options.metas] - Metadata parameter
   * @returns {Cypress.Chainable} Cypress response
   */
  getPages(options = {}) {
    return this.list(options)
  }

  /**
   * GET /api/v1/pages/{id} - Get page by ID
   * @param {string} id - Page ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getPageById(id, options = {}) {
    return this.getById(id, options)
  }

  /**
   * POST /api/v1/pages - Create page
   * @param {Object} pageData - Page data
   * @param {string} pageData.slug - Page slug (required)
   * @param {string} pageData.title - Page title (required)
   * @param {string} pageData.locale - Page locale (required)
   * @param {Array} pageData.blocks - Page blocks (required)
   * @param {string} [pageData.status] - Status (draft, published, scheduled, archived)
   * @param {string} [pageData.seoTitle] - SEO title
   * @param {string} [pageData.seoDescription] - SEO description
   * @param {Object} [pageData.metas] - Metadata object
   * @returns {Cypress.Chainable} Cypress response
   */
  createPage(pageData, options = {}) {
    return this.create(pageData, options)
  }

  /**
   * PATCH /api/v1/pages/{id} - Update page
   * @param {string} id - Page ID
   * @param {Object} updateData - Data to update
   * @returns {Cypress.Chainable} Cypress response
   */
  updatePage(id, updateData, options = {}) {
    return this.update(id, updateData, options)
  }

  /**
   * DELETE /api/v1/pages/{id} - Delete page
   * @param {string} id - Page ID
   * @returns {Cypress.Chainable} Cypress response
   */
  deletePage(id, options = {}) {
    return this.delete(id, options)
  }

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate random page data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated page data
   */
  generateRandomData(overrides = {}) {
    return PagesAPIController.generateRandomPageData(overrides)
  }

  /**
   * Static method to generate random page data
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated page data
   */
  static generateRandomPageData(overrides = {}) {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    return {
      slug: `test-page-${randomId}-${timestamp}`,
      title: `Test Page ${randomId}`,
      locale: 'en',
      status: 'draft',
      blocks: [],
      ...overrides
    }
  }

  /**
   * Create a test page and return its data
   * @param {Object} overrides - Data overrides
   * @returns {Cypress.Chainable} Promise resolving with created page data
   */
  createTestPage(overrides = {}) {
    return this.createTestEntity(overrides)
  }

  /**
   * Clean up a test page
   * @param {string} id - Page ID
   * @returns {Cypress.Chainable} Delete response
   */
  cleanupTestPage(id) {
    return this.cleanup(id)
  }

  // ============================================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================================

  /**
   * Validate page object structure
   * @param {Object} page - Page object
   * @param {boolean} allowMetas - If metas property is allowed
   */
  validatePageObject(page, allowMetas = false) {
    // Base fields
    this.validateBaseEntityFields(page)

    // Required page fields
    expect(page).to.have.property('slug')
    expect(page.slug).to.be.a('string')

    expect(page).to.have.property('title')
    expect(page.title).to.be.a('string')

    expect(page).to.have.property('locale')
    expect(page.locale).to.be.a('string')

    expect(page).to.have.property('blocks')
    expect(page.blocks).to.be.an('array')

    // Status field (if present)
    if (page.hasOwnProperty('status') && page.status !== null) {
      expect(page.status).to.be.oneOf(['draft', 'published', 'scheduled', 'archived'])
    }

    // Metas if allowed
    if (allowMetas && page.hasOwnProperty('metas')) {
      expect(page.metas).to.be.an('object')
    }
  }

  // ============================================================
  // METADATA HELPERS
  // ============================================================

  /**
   * Generate sample metadata for testing
   * @param {string} type - Type of metadata ('seo', 'layout', 'settings')
   * @returns {Object} Sample metadata
   */
  generateSampleMetadata(type = 'seo') {
    const sampleMetas = {
      seo: {
        seoTitle: 'Custom Page SEO Title',
        seoDescription: 'Custom SEO description for this page',
        seoKeywords: 'test, page, cypress',
        noindex: false,
        nofollow: false,
        ogImage: '/images/og-page.jpg'
      },
      layout: {
        headerStyle: 'transparent',
        footerVisible: true,
        sidebarEnabled: false,
        fullWidth: true
      },
      settings: {
        cacheEnabled: true,
        cacheTTL: 3600,
        authRequired: false,
        analyticsEnabled: true
      }
    }

    return { [type]: sampleMetas[type] || sampleMetas.seo }
  }
}

// Export for CommonJS
module.exports = PagesAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.PagesAPIController = PagesAPIController
}
