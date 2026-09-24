/**
 * PostsAPIController - Controller for interacting with the Posts API
 * Encapsulates all CRUD operations for /api/v1/posts endpoints
 *
 * Requires:
 * - API Key with posts:read, posts:write scopes (or superadmin with *)
 * - x-team-id header for team context
 *
 * Entity characteristics:
 * - Required fields: slug, title, blocks, locale
 * - Optional fields: excerpt, featuredImage, SEO fields, categoryIds
 * - Unique constraint: slug + locale
 * - Relations: post_taxonomy_relations (many-to-many with taxonomies)
 * - Uses PATCH for updates (standard)
 */
const BaseAPIController = require('./BaseAPIController')
const entitiesConfig = require('../../fixtures/entities.json')

const { slug } = entitiesConfig.entities.posts

class PostsAPIController extends BaseAPIController {
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
   * GET /api/v1/posts - List posts
   * @param {Object} options - Query options
   * @param {number} [options.page] - Page number
   * @param {number} [options.limit] - Results per page
   * @param {string} [options.status] - Filter by status (draft, published, scheduled, archived)
   * @param {string} [options.locale] - Filter by locale
   * @param {boolean} [options.published] - Filter by published flag
   * @param {string} [options.search] - Search in title/excerpt
   * @param {string} [options.metas] - Metadata parameter
   * @returns {Cypress.Chainable} Cypress response
   */
  getPosts(options = {}) {
    return this.list(options)
  }

  /**
   * GET /api/v1/posts/{id} - Get post by ID
   * @param {string} id - Post ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getPostById(id, options = {}) {
    return this.getById(id, options)
  }

  /**
   * POST /api/v1/posts - Create post
   * @param {Object} postData - Post data
   * @param {string} postData.slug - Post slug (required)
   * @param {string} postData.title - Post title (required)
   * @param {string} postData.locale - Post locale (required)
   * @param {Array} postData.blocks - Post blocks (required)
   * @param {string} [postData.excerpt] - Post excerpt
   * @param {string} [postData.featuredImage] - Featured image URL
   * @param {string} [postData.status] - Status (draft, published, scheduled, archived)
   * @param {boolean} [postData.published] - Published flag
   * @param {string[]} [postData.categoryIds] - Category IDs
   * @param {string} [postData.seoTitle] - SEO title
   * @param {string} [postData.seoDescription] - SEO description
   * @param {Object} [postData.metas] - Metadata object
   * @returns {Cypress.Chainable} Cypress response
   */
  createPost(postData, options = {}) {
    return this.create(postData, options)
  }

  /**
   * PUT /api/v1/posts/{id} - Update post
   * @param {string} id - Post ID
   * @param {Object} updateData - Data to update
   * @returns {Cypress.Chainable} Cypress response
   */
  updatePost(id, updateData, options = {}) {
    return this.update(id, updateData, options)
  }

  /**
   * DELETE /api/v1/posts/{id} - Delete post
   * @param {string} id - Post ID
   * @returns {Cypress.Chainable} Cypress response
   */
  deletePost(id, options = {}) {
    return this.delete(id, options)
  }

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate random post data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated post data
   */
  generateRandomData(overrides = {}) {
    return PostsAPIController.generateRandomPostData(overrides)
  }

  /**
   * Static method to generate random post data
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated post data
   */
  static generateRandomPostData(overrides = {}) {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    return {
      slug: `test-post-${randomId}-${timestamp}`,
      title: `Test Post ${randomId}`,
      excerpt: `Test excerpt for post ${randomId}`,
      locale: 'en',
      published: false,
      status: 'draft',
      blocks: [],
      categoryIds: [],
      ...overrides
    }
  }

  /**
   * Create a test post and return its data
   * @param {Object} overrides - Data overrides
   * @returns {Cypress.Chainable} Promise resolving with created post data
   */
  createTestPost(overrides = {}) {
    return this.createTestEntity(overrides)
  }

  /**
   * Clean up a test post
   * @param {string} id - Post ID
   * @returns {Cypress.Chainable} Delete response
   */
  cleanupTestPost(id) {
    return this.cleanup(id)
  }

  // ============================================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================================

  /**
   * Validate post object structure
   * @param {Object} post - Post object
   * @param {boolean} allowMetas - If metas property is allowed
   */
  validatePostObject(post, allowMetas = false) {
    // Base fields
    this.validateBaseEntityFields(post)

    // Required post fields
    expect(post).to.have.property('slug')
    expect(post.slug).to.be.a('string')

    expect(post).to.have.property('title')
    expect(post.title).to.be.a('string')

    expect(post).to.have.property('locale')
    expect(post.locale).to.be.a('string')

    expect(post).to.have.property('blocks')
    expect(post.blocks).to.be.an('array')

    // Status field (if present)
    if (post.hasOwnProperty('status') && post.status !== null) {
      expect(post.status).to.be.oneOf(['draft', 'published', 'scheduled', 'archived'])
    }

    // Published flag (if present)
    if (post.hasOwnProperty('published')) {
      expect(post.published).to.be.a('boolean')
    }

    // Categories relation (if present)
    if (post.hasOwnProperty('categories')) {
      expect(post.categories).to.be.an('array')
    }

    // Optional string fields
    if (post.excerpt !== null && post.excerpt !== undefined) {
      expect(post.excerpt).to.be.a('string')
    }

    if (post.featuredImage !== null && post.featuredImage !== undefined) {
      expect(post.featuredImage).to.be.a('string')
    }

    // Metas if allowed
    if (allowMetas && post.hasOwnProperty('metas')) {
      expect(post.metas).to.be.an('object')
    }
  }

  // ============================================================
  // METADATA HELPERS
  // ============================================================

  /**
   * Generate sample metadata for testing
   * @param {string} type - Type of metadata ('seo', 'social', 'analytics')
   * @returns {Object} Sample metadata
   */
  generateSampleMetadata(type = 'seo') {
    const sampleMetas = {
      seo: {
        seoTitle: 'Custom SEO Title',
        seoDescription: 'Custom SEO description for search engines',
        seoKeywords: 'test, post, cypress',
        noindex: false,
        nofollow: false
      },
      social: {
        ogImage: '/images/og-image.jpg',
        twitterCard: 'summary_large_image',
        shareText: 'Check out this post!'
      },
      analytics: {
        trackViews: true,
        conversionGoal: 'signup',
        utmSource: 'test'
      }
    }

    return { [type]: sampleMetas[type] || sampleMetas.seo }
  }
}

// Export for CommonJS
module.exports = PostsAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.PostsAPIController = PostsAPIController
}
