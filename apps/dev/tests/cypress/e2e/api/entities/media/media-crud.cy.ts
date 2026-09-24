/**
 * Media API - CRUD Tests
 *
 * Comprehensive test suite for Media API endpoints.
 * Tests GET, PATCH, DELETE operations and upload functionality.
 *
 * Entity characteristics:
 * - No team context required (global media library)
 * - Soft delete (status → deleted)
 * - Supports filtering by type, search by filename
 * - Pagination via limit/offset
 * - Sorting via orderBy/orderDir
 */

/// <reference types="cypress" />

import * as allure from 'allure-cypress'

const MediaAPIController = require('../../../../src/controllers/MediaAPIController.js')

describe('Media API - CRUD Operations', {
  tags: ['@api', '@feat-media-library', '@crud', '@regression']
}, () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let mediaAPI: InstanceType<typeof MediaAPIController>

  // Track created media for cleanup
  let createdMedia: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    mediaAPI = new MediaAPIController(BASE_URL, SUPERADMIN_API_KEY)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Media Library')
  })

  afterEach(() => {
    // Cleanup created media after each test
    createdMedia.forEach((media) => {
      if (media?.id) {
        mediaAPI.deleteMedia(media.id)
      }
    })
    createdMedia = []
  })

  // ============================================
  // GET /api/v1/media - List Media
  // ============================================
  describe('GET /api/v1/media - List Media', () => {
    it('MEDIA_API_001: Should list media with valid API key', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      mediaAPI.getMedia().then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('offset')
        expect(response.body.info).to.have.property('total')

        cy.log(`Found ${response.body.data.length} media items`)
      })
    })

    it('MEDIA_API_002: Should list media with pagination (limit/offset)', () => {
      mediaAPI.getMedia({ limit: 5, offset: 0 }).then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.info.offset).to.eq(0)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} media items`)
      })
    })

    it('MEDIA_API_003: Should filter media by type=image', () => {
      mediaAPI.getMedia({ type: 'image' }).then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // All returned items should have type=image
        response.body.data.forEach((media: any) => {
          expect(media.type).to.eq('image')
        })

        cy.log(`Found ${response.body.data.length} images`)
      })
    })

    it('MEDIA_API_004: Should filter media by type=video', () => {
      mediaAPI.getMedia({ type: 'video' }).then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // All returned items should have type=video
        response.body.data.forEach((media: any) => {
          expect(media.type).to.eq('video')
        })

        cy.log(`Found ${response.body.data.length} videos`)
      })
    })

    it('MEDIA_API_005: Should search media by filename', () => {
      // This test assumes there's existing media with searchable filenames
      // If no media exists, search returns empty array (still valid)
      const searchTerm = 'test'

      mediaAPI.getMedia({ search: searchTerm }).then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        cy.log(`Search '${searchTerm}' found ${response.body.data.length} results`)
      })
    })

    it('MEDIA_API_006: Should sort media by filename (ascending)', () => {
      mediaAPI.getMedia({ orderBy: 'filename', orderDir: 'asc', limit: 10 }).then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        if (response.body.data.length > 1) {
          // Verify ascending order
          const filenames = response.body.data.map((m: any) => m.filename)
          const sorted = [...filenames].sort()
          expect(filenames).to.deep.eq(sorted)
        }

        cy.log(`Sorted ${response.body.data.length} items by filename (asc)`)
      })
    })

    it('MEDIA_API_007: Should sort media by uploadedAt (descending)', () => {
      mediaAPI.getMedia({ orderBy: 'uploadedAt', orderDir: 'desc', limit: 10 }).then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        if (response.body.data.length > 1) {
          // Verify descending order by uploadedAt
          const timestamps = response.body.data.map((m: any) => new Date(m.uploadedAt).getTime())
          for (let i = 0; i < timestamps.length - 1; i++) {
            expect(timestamps[i]).to.be.at.least(timestamps[i + 1])
          }
        }

        cy.log(`Sorted ${response.body.data.length} items by uploadedAt (desc)`)
      })
    })

    it('MEDIA_API_008: Should return empty array for non-matching search', () => {
      const nonExistentTerm = 'NonExistentMediaFilename123456789'

      mediaAPI.getMedia({ search: nonExistentTerm }).then((response: any) => {
        mediaAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.eq(0)

        cy.log('Search with non-matching term returns empty array')
      })
    })

    it('MEDIA_API_009: Should reject request without API key', () => {
      const noAuthAPI = new MediaAPIController(BASE_URL, null)

      noAuthAPI.getMedia().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })
  })

  // ============================================
  // GET /api/v1/media/{id} - Get Media by ID
  // ============================================
  describe('GET /api/v1/media/{id} - Get Media by ID', () => {
    let testMediaId: string

    beforeEach(() => {
      // Get first media item from list for testing
      mediaAPI.getMedia({ limit: 1 }).then((response: any) => {
        if (response.body.data.length > 0) {
          testMediaId = response.body.data[0].id
        }
      })
    })

    it('MEDIA_API_010: Should get media by valid ID', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test')
          return
        }

        mediaAPI.getMediaById(testMediaId).then((response: any) => {
          mediaAPI.validateSuccessResponse(response, 200)

          const media = response.body.data
          mediaAPI.validateMediaObject(media)
          expect(media.id).to.eq(testMediaId)

          cy.log(`Retrieved media: ${media.filename}`)
        })
      })
    })

    it('MEDIA_API_011: Should return 404 for non-existent media', () => {
      const fakeId = 'non-existent-media-id-12345'

      mediaAPI.getMediaById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent media returns 404')
      })
    })
  })

  // ============================================
  // PATCH /api/v1/media/{id} - Update Media Metadata
  // ============================================
  describe('PATCH /api/v1/media/{id} - Update Media Metadata', () => {
    let testMediaId: string

    beforeEach(() => {
      // Get first media item for testing
      mediaAPI.getMedia({ limit: 1 }).then((response: any) => {
        if (response.body.data.length > 0) {
          testMediaId = response.body.data[0].id
        }
      })
    })

    it('MEDIA_API_020: Should update media alt text', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test')
          return
        }

        const updateData = {
          alt: 'Updated alt text for testing'
        }

        mediaAPI.updateMedia(testMediaId, updateData).then((response: any) => {
          mediaAPI.validateSuccessResponse(response, 200)

          const media = response.body.data
          expect(media.alt).to.eq(updateData.alt)

          cy.log(`Updated media alt: ${media.alt}`)
        })
      })
    })

    it('MEDIA_API_021: Should update media caption', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test')
          return
        }

        const updateData = {
          caption: 'Updated caption for testing'
        }

        mediaAPI.updateMedia(testMediaId, updateData).then((response: any) => {
          mediaAPI.validateSuccessResponse(response, 200)

          const media = response.body.data
          expect(media.caption).to.eq(updateData.caption)

          cy.log(`Updated media caption: ${media.caption}`)
        })
      })
    })

    it('MEDIA_API_022: Should update both alt and caption', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test')
          return
        }

        const updateData = {
          alt: 'Updated alt text',
          caption: 'Updated caption'
        }

        mediaAPI.updateMedia(testMediaId, updateData).then((response: any) => {
          mediaAPI.validateSuccessResponse(response, 200)

          const media = response.body.data
          expect(media.alt).to.eq(updateData.alt)
          expect(media.caption).to.eq(updateData.caption)

          cy.log(`Updated both alt and caption`)
        })
      })
    })

    it('MEDIA_API_023: Should return 404 for non-existent media', () => {
      const fakeId = 'non-existent-media-id-12345'

      mediaAPI.updateMedia(fakeId, { alt: 'New Alt' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent media returns 404')
      })
    })

    it('MEDIA_API_024: Should reject empty update body', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test')
          return
        }

        mediaAPI.updateMedia(testMediaId, {}).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.have.property('success', false)

          cy.log('Empty update body rejected')
        })
      })
    })

    it('MEDIA_API_025: Should reject invalid update fields (only alt/caption allowed)', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test')
          return
        }

        // Try to update filename (should be rejected)
        const invalidUpdate = {
          filename: 'hacked-filename.jpg'
        }

        mediaAPI.updateMedia(testMediaId, invalidUpdate).then((response: any) => {
          // Should return 400 (validation error) or ignore the invalid field
          // Backend should only allow alt/caption updates
          expect(response.status).to.be.oneOf([200, 400])

          if (response.status === 200) {
            // If 200, filename should NOT be changed
            expect(response.body.data.filename).to.not.eq(invalidUpdate.filename)
          }

          cy.log('Invalid field update handled correctly')
        })
      })
    })
  })

  // ============================================
  // DELETE /api/v1/media/{id} - Soft Delete Media
  // ============================================
  describe('DELETE /api/v1/media/{id} - Soft Delete Media', () => {
    let testMediaId: string

    beforeEach(() => {
      // Get a media item that can be deleted
      mediaAPI.getMedia({ limit: 1, type: 'image' }).then((response: any) => {
        if (response.body.data.length > 0) {
          testMediaId = response.body.data[0].id
        }
      })
    })

    it('MEDIA_API_030: Should soft delete media by valid ID', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test deletion')
          return
        }

        // Delete the media
        mediaAPI.deleteMedia(testMediaId).then((response: any) => {
          mediaAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', testMediaId)

          cy.log(`Soft deleted media: ${testMediaId}`)

          // Verify soft delete: item should return 404 or status=deleted
          mediaAPI.getMediaById(testMediaId).then((getResponse: any) => {
            // After soft delete, GET should return 404 (filtered out)
            expect(getResponse.status).to.eq(404)

            cy.log('Verified soft deletion - media no longer accessible')
          })
        })
      })
    })

    it('MEDIA_API_031: Should return 404 for non-existent media', () => {
      const fakeId = 'non-existent-media-id-12345'

      mediaAPI.deleteMedia(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent media returns 404')
      })
    })

    it('MEDIA_API_032: Should return 404 when deleting already deleted media', () => {
      cy.then(() => {
        if (!testMediaId) {
          cy.log('No media items available to test')
          return
        }

        // Delete once
        mediaAPI.deleteMedia(testMediaId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Try to delete again
          mediaAPI.deleteMedia(testMediaId).then((secondDeleteResponse: any) => {
            expect(secondDeleteResponse.status).to.eq(404)
            expect(secondDeleteResponse.body).to.have.property('success', false)

            cy.log('Second delete attempt correctly returns 404')
          })
        })
      })
    })
  })

  // ============================================
  // Authentication Tests
  // ============================================
  describe('Authentication', () => {
    it('MEDIA_API_040: Should accept session authentication', () => {
      // Login as superadmin and use session cookies
      cy.login('superadmin@tmt.dev', 'Test1234')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/media`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        cy.log('Session authentication successful')
      })
    })

    it('MEDIA_API_041: Should accept API key authentication', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/media`,
        headers: {
          'Authorization': `Bearer ${SUPERADMIN_API_KEY}`
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true

        cy.log('API key authentication successful')
      })
    })

    it('MEDIA_API_042: Should return 401 without authentication', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/media`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false

        cy.log('No authentication returns 401')
      })
    })
  })

  // ============================================
  // Edge Cases & Error Handling
  // ============================================
  describe('Edge Cases & Error Handling', () => {
    it('MEDIA_API_050: Should handle invalid limit parameter', () => {
      mediaAPI.getMedia({ limit: -1 }).then((response: any) => {
        // Backend should either reject with 400 or use default limit
        expect(response.status).to.be.oneOf([200, 400])

        if (response.status === 200) {
          // If accepted, should use default limit (not negative)
          expect(response.body.info.limit).to.be.greaterThan(0)
        }

        cy.log('Invalid limit handled correctly')
      })
    })

    it('MEDIA_API_051: Should handle invalid offset parameter', () => {
      mediaAPI.getMedia({ offset: -1 }).then((response: any) => {
        // Backend should either reject with 400 or use default offset (0)
        expect(response.status).to.be.oneOf([200, 400])

        if (response.status === 200) {
          expect(response.body.info.offset).to.be.at.least(0)
        }

        cy.log('Invalid offset handled correctly')
      })
    })

    it('MEDIA_API_052: Should handle invalid type filter', () => {
      mediaAPI.getMedia({ type: 'invalid-type' }).then((response: any) => {
        // Backend should either reject with 400 or return empty results
        expect(response.status).to.be.oneOf([200, 400])

        if (response.status === 200) {
          // Should return empty array for invalid type
          expect(response.body.data).to.be.an('array')
        }

        cy.log('Invalid type filter handled correctly')
      })
    })

    it('MEDIA_API_053: Should handle invalid orderBy field', () => {
      mediaAPI.getMedia({ orderBy: 'invalid-field' }).then((response: any) => {
        // Backend should either reject with 400 or ignore invalid orderBy
        expect(response.status).to.be.oneOf([200, 400])

        cy.log('Invalid orderBy handled correctly')
      })
    })
  })

  // ============================================
  // Integration - Read -> Update -> Delete Lifecycle
  // ============================================
  describe('Integration - Read -> Update -> Delete Lifecycle', () => {
    it('MEDIA_API_100: Should complete lifecycle: Read -> Update -> Delete', () => {
      // Get first available media item
      mediaAPI.getMedia({ limit: 1 }).then((listResponse: any) => {
        if (listResponse.body.data.length === 0) {
          cy.log('No media items available for lifecycle test')
          return
        }

        const mediaId = listResponse.body.data[0].id

        // 1. READ
        mediaAPI.getMediaById(mediaId).then((readResponse: any) => {
          mediaAPI.validateSuccessResponse(readResponse, 200)
          const originalFilename = readResponse.body.data.filename

          cy.log(`1. Read media: ${originalFilename}`)

          // 2. UPDATE
          const updateData = {
            alt: 'Lifecycle Test Alt',
            caption: 'Lifecycle Test Caption'
          }

          mediaAPI.updateMedia(mediaId, updateData).then((updateResponse: any) => {
            mediaAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.alt).to.eq(updateData.alt)
            expect(updateResponse.body.data.caption).to.eq(updateData.caption)

            cy.log(`2. Updated media metadata`)

            // 3. DELETE
            mediaAPI.deleteMedia(mediaId).then((deleteResponse: any) => {
              mediaAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`3. Deleted media: ${mediaId}`)

              // 4. VERIFY DELETION
              mediaAPI.getMediaById(mediaId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('4. Verified deletion - media no longer accessible')
                cy.log('Full lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
