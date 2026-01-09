/// <reference types="cypress" />

/**
 * Pages API - Status System Tests
 *
 * Test suite for validating the status system migration in Pages API.
 * Tests status field behavior (draft, published, scheduled, archived)
 * and visibility rules for public routes.
 *
 * Migrated from published: boolean to status: string system.
 *
 * Tags: @api, @feat-pages, @status-system, @regression
 */

import * as allure from 'allure-cypress'

const PagesAPIController = require('../../src/controllers/PagesAPIController.js')

describe('Pages API - Status System', {
  tags: ['@api', '@feat-pages', '@status-system', '@regression']
}, () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let pagesAPI: InstanceType<typeof PagesAPIController>

  // Track created pages for cleanup
  let createdPages: string[] = []

  before(() => {
    // Initialize controller with superadmin credentials and team context
    pagesAPI = new PagesAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    cy.log('PagesAPIController initialized')
    cy.log(`Base URL: ${BASE_URL}`)
    cy.log(`Team ID: ${TEAM_ID}`)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Pages Status System')
  })

  afterEach(() => {
    // Cleanup: Delete pages created during tests
    createdPages.forEach((pageId) => {
      pagesAPI.deletePage(pageId)
    })
    createdPages = []
  })

  // ============================================================
  // POST /api/v1/pages - Create with Status
  // ============================================================
  describe('POST /api/v1/pages - Create with Status', () => {
    it('PAGE_STATUS_001: Should create page with default status draft', { tags: '@smoke' }, () => {
      allure.story('Status System')
      allure.severity('critical')

      const pageData = PagesAPIController.generateRandomPageData({
        title: 'Test Page Default Status'
      })
      delete pageData.status // Remove to test default

      pagesAPI.createPage(pageData).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 201)

        const page = response.body.data
        expect(page).to.have.property('status')
        expect(page.status).to.eq('draft')

        createdPages.push(page.id)
        cy.log(`Created page with default status: ${page.status}`)
      })
    })

    it('PAGE_STATUS_002: Should create page with status published', () => {
      const pageData = PagesAPIController.generateRandomPageData({
        title: 'Test Page Published',
        status: 'published'
      })

      pagesAPI.createPage(pageData).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 201)

        const page = response.body.data
        expect(page.status).to.eq('published')

        createdPages.push(page.id)
        cy.log(`Created page with status: published`)
      })
    })

    it('PAGE_STATUS_003: Should create page with status scheduled', () => {
      const pageData = PagesAPIController.generateRandomPageData({
        title: 'Test Page Scheduled',
        status: 'scheduled'
      })

      pagesAPI.createPage(pageData).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 201)

        const page = response.body.data
        expect(page.status).to.eq('scheduled')

        createdPages.push(page.id)
        cy.log(`Created page with status: scheduled`)
      })
    })

    it('PAGE_STATUS_004: Should create page with status archived', () => {
      const pageData = PagesAPIController.generateRandomPageData({
        title: 'Test Page Archived',
        status: 'archived'
      })

      pagesAPI.createPage(pageData).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 201)

        const page = response.body.data
        expect(page.status).to.eq('archived')

        createdPages.push(page.id)
        cy.log(`Created page with status: archived`)
      })
    })

    it('PAGE_STATUS_005: Should reject invalid status value', () => {
      const pageData = PagesAPIController.generateRandomPageData({
        title: 'Test Page Invalid Status',
        status: 'invalid-status'
      })

      pagesAPI.createPage(pageData).then((response: any) => {
        expect(response.status).to.be.oneOf([400, 422])
        expect(response.body.success).to.be.false

        cy.log('Invalid status value rejected with 400/422')
      })
    })
  })

  // ============================================================
  // PATCH /api/v1/pages/:id - Update Status
  // ============================================================
  describe('PATCH /api/v1/pages/:id - Update Status', () => {
    let testPageId: string

    beforeEach(() => {
      // Create a test page with draft status
      const pageData = PagesAPIController.generateRandomPageData({
        title: `Test Update Status ${Date.now()}`,
        status: 'draft'
      })

      pagesAPI.createPage(pageData).then((response: any) => {
        testPageId = response.body.data.id
        createdPages.push(testPageId)
      })
    })

    it('PAGE_STATUS_010: Should update status from draft to published', { tags: '@smoke' }, () => {
      allure.story('Status System')
      allure.severity('critical')

      cy.then(() => {
        const updateData = {
          status: 'published'
        }

        pagesAPI.updatePage(testPageId, updateData).then((response: any) => {
          pagesAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('published')

          cy.log('Status updated from draft to published')
        })
      })
    })

    it('PAGE_STATUS_011: Should update status to scheduled', () => {
      cy.then(() => {
        const updateData = {
          status: 'scheduled'
        }

        pagesAPI.updatePage(testPageId, updateData).then((response: any) => {
          pagesAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('scheduled')

          cy.log('Status updated to scheduled')
        })
      })
    })

    it('PAGE_STATUS_012: Should update status to archived', () => {
      cy.then(() => {
        const updateData = {
          status: 'archived'
        }

        pagesAPI.updatePage(testPageId, updateData).then((response: any) => {
          pagesAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('archived')

          cy.log('Status updated to archived')
        })
      })
    })

    it('PAGE_STATUS_013: Should reject invalid status in update', () => {
      cy.then(() => {
        const updateData = {
          status: 'invalid-status-update'
        }

        pagesAPI.updatePage(testPageId, updateData).then((response: any) => {
          expect(response.status).to.be.oneOf([400, 422])
          expect(response.body.success).to.be.false

          cy.log('Invalid status update rejected')
        })
      })
    })
  })

  // ============================================================
  // GET /api/v1/pages - Filter by Status
  // ============================================================
  describe('GET /api/v1/pages - Filter by Status', () => {
    it('PAGE_STATUS_020: Should filter pages by status=published', { tags: '@smoke' }, () => {
      allure.story('Status Filtering')
      allure.severity('critical')

      pagesAPI.getPages({ status: 'published' }).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // All returned pages should have status='published'
        response.body.data.forEach((page: any) => {
          expect(page.status).to.eq('published')
        })

        cy.log(`Found ${response.body.data.length} published pages`)
      })
    })

    it('PAGE_STATUS_021: Should filter pages by status=draft', () => {
      pagesAPI.getPages({ status: 'draft' }).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        response.body.data.forEach((page: any) => {
          expect(page.status).to.eq('draft')
        })

        cy.log(`Found ${response.body.data.length} draft pages`)
      })
    })

    it('PAGE_STATUS_022: Should filter pages by status=scheduled', () => {
      pagesAPI.getPages({ status: 'scheduled' }).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        response.body.data.forEach((page: any) => {
          expect(page.status).to.eq('scheduled')
        })

        cy.log(`Found ${response.body.data.length} scheduled pages`)
      })
    })

    it('PAGE_STATUS_023: Should filter pages by status=archived', () => {
      pagesAPI.getPages({ status: 'archived' }).then((response: any) => {
        pagesAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        response.body.data.forEach((page: any) => {
          expect(page.status).to.eq('archived')
        })

        cy.log(`Found ${response.body.data.length} archived pages`)
      })
    })
  })

  // ============================================================
  // Integration Test - Status Lifecycle
  // ============================================================
  describe('Integration - Status Lifecycle', () => {
    it('PAGE_STATUS_100: Should complete status lifecycle: draft -> published -> archived', () => {
      const pageData = PagesAPIController.generateRandomPageData({
        title: `Status Lifecycle Test ${Date.now()}`,
        status: 'draft'
      })

      // 1. CREATE as draft
      pagesAPI.createPage(pageData).then((createResponse: any) => {
        pagesAPI.validateSuccessResponse(createResponse, 201)
        const createdPage = createResponse.body.data
        expect(createdPage.status).to.eq('draft')
        cy.log(`1. Created page with status: draft`)

        // 2. UPDATE to published
        pagesAPI.updatePage(createdPage.id, { status: 'published' })
          .then((publishResponse: any) => {
            pagesAPI.validateSuccessResponse(publishResponse, 200)
            expect(publishResponse.body.data.status).to.eq('published')
            cy.log(`2. Updated status to: published`)

            // 3. UPDATE to archived
            pagesAPI.updatePage(createdPage.id, { status: 'archived' })
              .then((archiveResponse: any) => {
                pagesAPI.validateSuccessResponse(archiveResponse, 200)
                expect(archiveResponse.body.data.status).to.eq('archived')
                cy.log(`3. Updated status to: archived`)

                // 4. VERIFY final status
                pagesAPI.getPageById(createdPage.id).then((finalResponse: any) => {
                  pagesAPI.validateSuccessResponse(finalResponse, 200)
                  expect(finalResponse.body.data.status).to.eq('archived')
                  cy.log('4. Verified final status: archived')
                  cy.log('Full status lifecycle completed successfully')

                  // Cleanup
                  pagesAPI.deletePage(createdPage.id)
                })
              })
          })
      })
    })
  })
})
