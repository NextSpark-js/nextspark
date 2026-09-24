/**
 * MediaAPIController - Controller for interacting with the Media API
 * Encapsulates all CRUD operations for /api/v1/media endpoints
 *
 * Requires:
 * - API Key with media:read, media:write, media:delete scopes (or superadmin with *)
 */
const BaseAPIController = require('./BaseAPIController')

class MediaAPIController extends BaseAPIController {
  /**
   * @param {string} baseUrl - Base URL for API requests
   * @param {string|null} apiKey - API key for authentication
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null) {
    // Media does not require x-team-id (no team context)
    super(baseUrl, apiKey, null, { slug: 'media' })
  }

  // ============================================================
  // SEMANTIC ALIASES (for backward compatibility)
  // ============================================================

  /**
   * GET /api/v1/media - Get list of media items
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Results per page (default: 20)
   * @param {number} [options.offset] - Offset for pagination (default: 0)
   * @param {string} [options.type] - Filter by type (image, video, document, audio)
   * @param {string} [options.search] - Search in filename
   * @param {string} [options.orderBy] - Sort field (filename, uploadedAt, size, etc.)
   * @param {string} [options.orderDir] - Sort direction (asc, desc)
   * @param {Object} [options.headers] - Additional headers
   * @returns {Cypress.Chainable} Cypress response
   */
  getMedia(options = {}) {
    return this.list(options)
  }

  /**
   * GET /api/v1/media/{id} - Get specific media item by ID
   * @param {string} id - Media ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  getMediaById(id, options = {}) {
    return this.getById(id, options)
  }

  /**
   * PATCH /api/v1/media/{id} - Update media metadata
   * @param {string} id - Media ID
   * @param {Object} updateData - Data to update
   * @param {string} [updateData.alt] - Alt text for image
   * @param {string} [updateData.caption] - Caption for media
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  updateMedia(id, updateData, options = {}) {
    return this.update(id, updateData, options)
  }

  /**
   * DELETE /api/v1/media/{id} - Soft delete media item (status -> deleted)
   * @param {string} id - Media ID
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  deleteMedia(id, options = {}) {
    return this.delete(id, options)
  }

  /**
   * POST /api/v1/media/upload - Upload file(s)
   * @param {File|File[]} files - File or array of files to upload
   * @param {Object} options - Additional options
   * @returns {Cypress.Chainable} Cypress response
   */
  uploadMedia(files, options = {}) {
    const { headers = {} } = options
    const formData = new FormData()

    // Handle single file or array of files
    const fileArray = Array.isArray(files) ? files : [files]
    fileArray.forEach((file) => {
      formData.append('files', file)
    })

    // Note: For FormData, Content-Type should be auto-set by browser/Cypress
    const uploadHeaders = { ...this.getHeaders(headers) }
    delete uploadHeaders['Content-Type'] // Let Cypress set multipart boundary

    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}/api/v1/media/upload`,
      headers: uploadHeaders,
      body: formData,
      failOnStatusCode: false
    })
  }

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate random media data for testing
   * @param {Object} overrides - Specific data to override
   * @returns {Object} Generated media data
   */
  generateRandomMediaData(overrides = {}) {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    return {
      filename: `test-image-${randomId}-${timestamp}.jpg`,
      alt: `Alt text for test image ${randomId}`,
      caption: `Caption for test image ${randomId}`,
      type: 'image',
      size: Math.floor(100000 + Math.random() * 900000), // Random size
      mimeType: 'image/jpeg',
      ...overrides
    }
  }

  /**
   * Create a test media item and return its data
   * Note: This creates a DB record without actual file upload (for testing)
   * @param {Object} mediaData - Media data (optional)
   * @returns {Cypress.Chainable} Promise resolving with created media data
   */
  createTestMedia(mediaData = {}) {
    const data = this.generateRandomMediaData(mediaData)
    return this.create(data).then((response) => {
      if (response.status === 201) {
        return response.body.data
      }
      throw new Error(`Failed to create test media: ${response.status}`)
    })
  }

  /**
   * Clean up a test media item (delete it)
   * @param {string} id - Media ID
   * @returns {Cypress.Chainable} Delete response
   */
  cleanupTestMedia(id) {
    return this.deleteMedia(id)
  }

  // ============================================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================================

  /**
   * Validate media object structure
   * @param {Object} media - Media object
   */
  validateMediaObject(media) {
    // Base fields
    this.validateBaseEntityFields(media)

    // Required media fields
    expect(media).to.have.property('filename')
    expect(media.filename).to.be.a('string')

    expect(media).to.have.property('url')
    expect(media.url).to.be.a('string')

    expect(media).to.have.property('type')
    expect(media.type).to.be.oneOf(['image', 'video', 'document', 'audio'])

    expect(media).to.have.property('size')
    expect(media.size).to.be.a('number')

    expect(media).to.have.property('mimeType')
    expect(media.mimeType).to.be.a('string')

    expect(media).to.have.property('status')
    expect(media.status).to.be.oneOf(['active', 'deleted'])

    // Optional fields
    if (media.alt !== null && media.alt !== undefined) {
      expect(media.alt).to.be.a('string')
    }

    if (media.caption !== null && media.caption !== undefined) {
      expect(media.caption).to.be.a('string')
    }

    if (media.thumbnailUrl !== null && media.thumbnailUrl !== undefined) {
      expect(media.thumbnailUrl).to.be.a('string')
    }

    // Timestamps
    expect(media).to.have.property('uploadedAt')
    if (media.uploadedAt) {
      expect(media.uploadedAt).to.be.a('string')
    }
  }

  /**
   * Validate upload response structure
   * @param {Object} response - Upload response body
   */
  validateUploadResponse(response) {
    expect(response).to.have.property('success', true)
    expect(response).to.have.property('urls')
    expect(response.urls).to.be.an('array')

    expect(response).to.have.property('media')
    expect(response.media).to.be.an('array')

    expect(response).to.have.property('count')
    expect(response.count).to.be.a('number')
    expect(response.count).to.eq(response.urls.length)
    expect(response.count).to.eq(response.media.length)

    expect(response).to.have.property('storage')
    expect(response.storage).to.have.property('provider')
    expect(response.storage).to.have.property('bucket')
  }
}

// Export class for use in tests
module.exports = MediaAPIController

// For global use in Cypress
if (typeof window !== 'undefined') {
  window.MediaAPIController = MediaAPIController
}
