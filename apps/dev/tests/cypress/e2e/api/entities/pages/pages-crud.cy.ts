/// <reference types="cypress" />

/**
 * Pages API - CRUD Tests
 *
 * Basic CRUD operations for /api/v1/pages endpoints.
 * Tests page creation, reading, updating, and deletion.
 *
 * Tags: @api, @feat-pages, @crud, @page-builder
 */

import * as allure from 'allure-cypress'

describe('Pages API - CRUD Operations', {
  tags: ['@api', '@feat-pages', '@crud', '@page-builder']
}, () => {
  // Superadmin API key for testing
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'
  const API_PAGES = `${BASE_URL}/api/v1/pages`

  // Track created pages for cleanup
  let createdPages: string[] = []

  // Helper to make authenticated requests
  const apiRequest = (method: string, url: string, body?: object) => {
    return cy.request({
      method,
      url,
      headers: {
        'x-api-key': SUPERADMIN_API_KEY,
        'Content-Type': 'application/json'
      },
      body,
      failOnStatusCode: false
    })
  }

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Pages')
  })

  afterEach(() => {
    // Cleanup: Delete pages created during tests
    createdPages.forEach((pageId) => {
      apiRequest('DELETE', `${API_PAGES}/${pageId}`)
    })
    createdPages = []
  })

  // ============================================================
  // GET /api/v1/pages - List Pages
  // ============================================================
  describe('GET /api/v1/pages - List Pages', () => {
    it('PB_API_001: Should list pages with valid API key', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      apiRequest('GET', API_PAGES).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        cy.log(`Found ${response.body.data.length} pages`)
      })
    })

    it('PB_API_002: Should return page with expected structure', () => {
      apiRequest('GET', API_PAGES).then((response) => {
        expect(response.status).to.eq(200)

        if (response.body.data.length > 0) {
          const page = response.body.data[0]

          // Verify page structure
          expect(page).to.have.property('id')
          expect(page).to.have.property('title')
          expect(page).to.have.property('slug')
          expect(page).to.have.property('locale')
          expect(page).to.have.property('published')
          expect(page).to.have.property('blocks')
          expect(page.blocks).to.be.an('array')

          cy.log(`Page structure verified: ${page.title}`)
        }
      })
    })

    it('PB_API_003: Should reject request without API key', { tags: '@security' }, () => {
      cy.request({
        method: 'GET',
        url: API_PAGES,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
      })
    })
  })

  // ============================================================
  // POST /api/v1/pages - Create Page
  // ============================================================
  describe('POST /api/v1/pages - Create Page', () => {
    it('PB_API_004: Should create page with valid data', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      const pageData = {
        title: `Test Page ${Date.now()}`,
        slug: `test-page-${Date.now()}`,
        locale: 'en',
        published: false,
        blocks: []
      }

      apiRequest('POST', API_PAGES, pageData).then((response) => {
        expect(response.status).to.eq(201)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.have.property('id')
        expect(response.body.data.title).to.eq(pageData.title)
        expect(response.body.data.slug).to.eq(pageData.slug)

        // Track for cleanup
        createdPages.push(response.body.data.id)
        cy.log(`Created page: ${response.body.data.id}`)
      })
    })

    it('PB_API_005: Should create page with blocks', () => {
      const pageData = {
        title: `Page With Blocks ${Date.now()}`,
        slug: `page-with-blocks-${Date.now()}`,
        locale: 'en',
        published: false,
        blocks: [
          {
            id: `block-${Date.now()}-1`,
            blockSlug: 'hero',
            props: {
              title: 'Test Hero',
              subtitle: 'Test Subtitle'
            }
          }
        ]
      }

      apiRequest('POST', API_PAGES, pageData).then((response) => {
        expect(response.status).to.eq(201)
        expect(response.body.data.blocks).to.have.length(1)
        expect(response.body.data.blocks[0].blockSlug).to.eq('hero')

        createdPages.push(response.body.data.id)
        cy.log(`Created page with ${response.body.data.blocks.length} blocks`)
      })
    })

    it('PB_API_006: Should reject page with reserved slug', () => {
      const pageData = {
        title: 'Admin Page',
        slug: 'admin', // Reserved slug
        locale: 'en',
        published: false,
        blocks: []
      }

      apiRequest('POST', API_PAGES, pageData).then((response) => {
        expect(response.status).to.be.oneOf([400, 422])
        expect(response.body.success).to.be.false
      })
    })

    it('PB_API_007: Should reject duplicate slug in same locale', () => {
      const uniqueSlug = `unique-slug-${Date.now()}`

      // Create first page
      const pageData1 = {
        title: 'First Page',
        slug: uniqueSlug,
        locale: 'en',
        published: false,
        blocks: []
      }

      apiRequest('POST', API_PAGES, pageData1).then((response1) => {
        expect(response1.status).to.eq(201)
        createdPages.push(response1.body.data.id)

        // Try to create duplicate
        const pageData2 = {
          title: 'Second Page',
          slug: uniqueSlug, // Same slug
          locale: 'en', // Same locale
          published: false,
          blocks: []
        }

        apiRequest('POST', API_PAGES, pageData2).then((response2) => {
          expect(response2.status).to.be.oneOf([400, 409, 422])
          expect(response2.body.success).to.be.false
        })
      })
    })
  })

  // ============================================================
  // GET /api/v1/pages/{id} - Get Page by ID
  // ============================================================
  describe('GET /api/v1/pages/{id} - Get Page by ID', () => {
    let testPageId: string

    beforeEach(() => {
      // Create a test page
      const pageData = {
        title: `Test Get By ID ${Date.now()}`,
        slug: `test-get-${Date.now()}`,
        locale: 'en',
        published: false,
        blocks: []
      }

      apiRequest('POST', API_PAGES, pageData).then((response) => {
        testPageId = response.body.data.id
        createdPages.push(testPageId)
      })
    })

    it('PB_API_008: Should get page by valid ID', () => {
      cy.then(() => {
        apiRequest('GET', `${API_PAGES}/${testPageId}`).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.success).to.be.true
          expect(response.body.data.id).to.eq(testPageId)

          cy.log(`Got page: ${response.body.data.title}`)
        })
      })
    })

    it('PB_API_009: Should return 404 for non-existent page', () => {
      apiRequest('GET', `${API_PAGES}/non-existent-id-12345`).then((response) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })
    })
  })

  // ============================================================
  // PATCH /api/v1/pages/{id} - Update Page
  // ============================================================
  describe('PATCH /api/v1/pages/{id} - Update Page', () => {
    let testPageId: string

    beforeEach(() => {
      const pageData = {
        title: `Test Update ${Date.now()}`,
        slug: `test-update-${Date.now()}`,
        locale: 'en',
        published: false,
        blocks: []
      }

      apiRequest('POST', API_PAGES, pageData).then((response) => {
        testPageId = response.body.data.id
        createdPages.push(testPageId)
      })
    })

    it('PB_API_010: Should update page title', () => {
      const updateData = {
        title: 'Updated Title'
      }

      cy.then(() => {
        apiRequest('PATCH', `${API_PAGES}/${testPageId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.title).to.eq(updateData.title)

          cy.log(`Updated page title to: ${updateData.title}`)
        })
      })
    })

    it('PB_API_011: Should update page blocks', () => {
      const updateData = {
        blocks: [
          {
            id: `block-${Date.now()}`,
            blockSlug: 'cta-section',
            props: {
              title: 'New CTA',
              description: 'Test description'
            }
          }
        ]
      }

      cy.then(() => {
        apiRequest('PATCH', `${API_PAGES}/${testPageId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.blocks).to.have.length(1)
          expect(response.body.data.blocks[0].blockSlug).to.eq('cta-section')

          cy.log(`Updated page with new blocks`)
        })
      })
    })

    it('PB_API_012: Should publish page', () => {
      const updateData = {
        published: true
      }

      cy.then(() => {
        apiRequest('PATCH', `${API_PAGES}/${testPageId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.published).to.be.true

          cy.log('Page published successfully')
        })
      })
    })
  })

  // ============================================================
  // DELETE /api/v1/pages/{id} - Delete Page
  // ============================================================
  describe('DELETE /api/v1/pages/{id} - Delete Page', () => {
    it('PB_API_013: Should delete page by valid ID', () => {
      // Create page to delete
      const pageData = {
        title: `Test Delete ${Date.now()}`,
        slug: `test-delete-${Date.now()}`,
        locale: 'en',
        published: false,
        blocks: []
      }

      apiRequest('POST', API_PAGES, pageData).then((createResponse) => {
        const pageId = createResponse.body.data.id

        // Delete the page
        apiRequest('DELETE', `${API_PAGES}/${pageId}`).then((deleteResponse) => {
          expect(deleteResponse.status).to.eq(200)
          expect(deleteResponse.body.success).to.be.true

          // Verify deletion
          apiRequest('GET', `${API_PAGES}/${pageId}`).then((getResponse) => {
            expect(getResponse.status).to.eq(404)
            cy.log(`Deleted and verified: ${pageId}`)
          })
        })
      })
    })

    it('PB_API_014: Should return 404 for non-existent page', () => {
      apiRequest('DELETE', `${API_PAGES}/non-existent-id-12345`).then((response) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })
    })
  })

  // ============================================================
  // Integration Test - Complete CRUD Lifecycle
  // ============================================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('PB_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      const timestamp = Date.now()
      const pageData = {
        title: `Lifecycle Test ${timestamp}`,
        slug: `lifecycle-test-${timestamp}`,
        locale: 'en',
        published: false,
        blocks: [
          {
            id: `block-${timestamp}`,
            blockSlug: 'hero',
            props: { title: 'Lifecycle Hero' }
          }
        ]
      }

      // 1. CREATE
      apiRequest('POST', API_PAGES, pageData).then((createResponse) => {
        expect(createResponse.status).to.eq(201)
        const createdPage = createResponse.body.data
        cy.log(`1. Created page: ${createdPage.id}`)

        // 2. READ
        apiRequest('GET', `${API_PAGES}/${createdPage.id}`).then((readResponse) => {
          expect(readResponse.status).to.eq(200)
          expect(readResponse.body.data.title).to.eq(pageData.title)
          cy.log(`2. Read page: ${createdPage.id}`)

          // 3. UPDATE
          const updateData = {
            title: 'Updated Lifecycle Page',
            published: true
          }
          apiRequest('PATCH', `${API_PAGES}/${createdPage.id}`, updateData).then((updateResponse) => {
            expect(updateResponse.status).to.eq(200)
            expect(updateResponse.body.data.title).to.eq(updateData.title)
            expect(updateResponse.body.data.published).to.be.true
            cy.log(`3. Updated page: ${updateData.title}`)

            // 4. DELETE
            apiRequest('DELETE', `${API_PAGES}/${createdPage.id}`).then((deleteResponse) => {
              expect(deleteResponse.status).to.eq(200)
              cy.log(`4. Deleted page: ${createdPage.id}`)

              // 5. VERIFY DELETION
              apiRequest('GET', `${API_PAGES}/${createdPage.id}`).then((finalResponse) => {
                expect(finalResponse.status).to.eq(404)
                cy.log('5. Verified deletion: page not found (404)')
                cy.log('Full CRUD lifecycle completed successfully')
              })
            })
          })
        })
      })
    })
  })
})
