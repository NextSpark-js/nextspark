/// <reference types="cypress" />

/**
 * Posts API - Status System Tests
 *
 * Test suite for validating the status system migration in Posts API.
 * Tests status field behavior (draft, published, scheduled, archived)
 * and interaction with taxonomy relations.
 *
 * Migrated from published: boolean to status: string system.
 *
 * Tags: @api, @feat-posts, @status-system, @regression
 */

import * as allure from 'allure-cypress'

const PostsAPIController = require('../../src/controllers/PostsAPIController.js')

describe('Posts API - Status System', {
  tags: ['@api', '@feat-posts', '@status-system', '@regression']
}, () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let postsAPI: InstanceType<typeof PostsAPIController>

  // Track created posts for cleanup
  let createdPosts: string[] = []

  before(() => {
    // Initialize controller with superadmin credentials and team context
    postsAPI = new PostsAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    cy.log('PostsAPIController initialized')
    cy.log(`Base URL: ${BASE_URL}`)
    cy.log(`Team ID: ${TEAM_ID}`)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Posts Status System')
  })

  afterEach(() => {
    // Cleanup: Delete posts created during tests
    createdPosts.forEach((postId) => {
      postsAPI.deletePost(postId)
    })
    createdPosts = []
  })

  // ============================================================
  // POST /api/v1/posts - Create with Status
  // ============================================================
  describe('POST /api/v1/posts - Create with Status', () => {
    it('POST_STATUS_001: Should create post with default status draft', { tags: '@smoke' }, () => {
      allure.story('Status System')
      allure.severity('critical')

      const postData = PostsAPIController.generateRandomPostData({
        title: 'Test Post Default Status'
      })
      delete postData.status // Remove to test default

      postsAPI.createPost(postData).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 201)

        const post = response.body.data
        expect(post).to.have.property('status')
        expect(post.status).to.eq('draft')

        createdPosts.push(post.id)
        cy.log(`Created post with default status: ${post.status}`)
      })
    })

    it('POST_STATUS_002: Should create post with status published', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: 'Test Post Published',
        status: 'published'
      })

      postsAPI.createPost(postData).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 201)

        const post = response.body.data
        expect(post.status).to.eq('published')

        createdPosts.push(post.id)
        cy.log(`Created post with status: published`)
      })
    })

    it('POST_STATUS_003: Should create post with status scheduled', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: 'Test Post Scheduled',
        status: 'scheduled'
      })

      postsAPI.createPost(postData).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 201)

        const post = response.body.data
        expect(post.status).to.eq('scheduled')

        createdPosts.push(post.id)
        cy.log(`Created post with status: scheduled`)
      })
    })

    it('POST_STATUS_004: Should create post with excerpt and featured image', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: 'Test Post with Content',
        status: 'draft',
        excerpt: 'This is a test post excerpt',
        featuredImage: 'https://example.com/images/test-featured.jpg'
      })

      postsAPI.createPost(postData).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 201)

        const post = response.body.data
        expect(post.status).to.eq('draft')
        expect(post.excerpt).to.eq(postData.excerpt)
        expect(post.featuredImage).to.eq(postData.featuredImage)

        createdPosts.push(post.id)
        cy.log(`Created post with excerpt and featured image`)
      })
    })

    it('POST_STATUS_005: Should reject invalid status value', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: 'Test Post Invalid Status',
        status: 'invalid-status'
      })

      postsAPI.createPost(postData).then((response: any) => {
        expect(response.status).to.be.oneOf([400, 422])
        expect(response.body.success).to.be.false

        cy.log('Invalid status value rejected with 400/422')
      })
    })
  })

  // ============================================================
  // PUT /api/v1/posts/:id - Update Status
  // ============================================================
  describe('PUT /api/v1/posts/:id - Update Status', () => {
    let testPostId: string

    beforeEach(() => {
      // Create a test post with draft status
      const postData = PostsAPIController.generateRandomPostData({
        title: `Test Update Status ${Date.now()}`,
        status: 'draft'
      })

      postsAPI.createPost(postData).then((response: any) => {
        testPostId = response.body.data.id
        createdPosts.push(testPostId)
      })
    })

    it('POST_STATUS_010: Should update status from draft to published', { tags: '@smoke' }, () => {
      allure.story('Status System')
      allure.severity('critical')

      cy.then(() => {
        const updateData = {
          status: 'published'
        }

        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('published')

          cy.log('Status updated from draft to published')
        })
      })
    })

    it('POST_STATUS_011: Should update status to scheduled', () => {
      cy.then(() => {
        const updateData = {
          status: 'scheduled'
        }

        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('scheduled')

          cy.log('Status updated to scheduled')
        })
      })
    })

    it('POST_STATUS_012: Should update status to archived', () => {
      cy.then(() => {
        const updateData = {
          status: 'archived'
        }

        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('archived')

          cy.log('Status updated to archived')
        })
      })
    })

    it('POST_STATUS_013: Should update excerpt and maintain status', () => {
      cy.then(() => {
        const updateData = {
          excerpt: 'Updated excerpt text'
        }

        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.excerpt).to.eq(updateData.excerpt)
          expect(response.body.data.status).to.eq('draft') // Status unchanged

          cy.log('Excerpt updated, status maintained')
        })
      })
    })

    it('POST_STATUS_014: Should reject invalid status in update', () => {
      cy.then(() => {
        const updateData = {
          status: 'invalid-status-update'
        }

        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          expect(response.status).to.be.oneOf([400, 422])
          expect(response.body.success).to.be.false

          cy.log('Invalid status update rejected')
        })
      })
    })
  })

  // ============================================================
  // GET /api/v1/posts - Filter by Status
  // ============================================================
  describe('GET /api/v1/posts - Filter by Status', () => {
    it('POST_STATUS_020: Should filter posts by status=published', { tags: '@smoke' }, () => {
      allure.story('Status Filtering')
      allure.severity('critical')

      postsAPI.getPosts({ status: 'published' }).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // All returned posts should have status='published'
        response.body.data.forEach((post: any) => {
          expect(post.status).to.eq('published')
        })

        cy.log(`Found ${response.body.data.length} published posts`)
      })
    })

    it('POST_STATUS_021: Should filter posts by status=draft', () => {
      postsAPI.getPosts({ status: 'draft' }).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        response.body.data.forEach((post: any) => {
          expect(post.status).to.eq('draft')
        })

        cy.log(`Found ${response.body.data.length} draft posts`)
      })
    })

    it('POST_STATUS_022: Should return posts with categories field', () => {
      postsAPI.getPosts({ status: 'published' }).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 200)

        if (response.body.data.length > 0) {
          const post = response.body.data[0]
          expect(post).to.have.property('categories')
          expect(post.categories).to.be.an('array')

          cy.log('Posts include categories field (taxonomy relations)')
        }
      })
    })
  })

  // ============================================================
  // Integration Test - Status with Taxonomies
  // ============================================================
  describe('Integration - Status with Taxonomies', () => {
    it('POST_STATUS_100: Should create published post and retrieve with categories', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: `Integration Test ${Date.now()}`,
        status: 'published',
        excerpt: 'Integration test excerpt',
        categoryIds: [] // Empty for now, can be extended with actual category IDs
      })

      // 1. CREATE published post
      postsAPI.createPost(postData).then((createResponse: any) => {
        postsAPI.validateSuccessResponse(createResponse, 201)
        const createdPost = createResponse.body.data
        expect(createdPost.status).to.eq('published')
        cy.log(`1. Created published post: ${createdPost.id}`)

        // 2. RETRIEVE by ID (verify categories included)
        postsAPI.getPostById(createdPost.id).then((getResponse: any) => {
          postsAPI.validateSuccessResponse(getResponse, 200)
          expect(getResponse.body.data.status).to.eq('published')
          expect(getResponse.body.data).to.have.property('categories')
          expect(getResponse.body.data.categories).to.be.an('array')
          cy.log(`2. Retrieved post with categories field`)

          // 3. UPDATE to draft
          postsAPI.updatePost(createdPost.id, { status: 'draft' })
            .then((updateResponse: any) => {
              postsAPI.validateSuccessResponse(updateResponse, 200)
              expect(updateResponse.body.data.status).to.eq('draft')
              cy.log(`3. Updated status to draft`)

              // 4. VERIFY not in published filter
              postsAPI.getPosts({ status: 'published' }).then((filterResponse: any) => {
                const foundInPublished = filterResponse.body.data.some(
                  (p: any) => p.id === createdPost.id
                )
                expect(foundInPublished).to.be.false
                cy.log('4. Verified post not in published filter')
                cy.log('Integration test completed successfully')

                // Cleanup
                postsAPI.deletePost(createdPost.id)
              })
            })
        })
      })
    })
  })

  // ============================================================
  // Integration Test - Status Lifecycle
  // ============================================================
  describe('Integration - Status Lifecycle', () => {
    it('POST_STATUS_200: Should complete status lifecycle: draft -> published -> archived', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: `Status Lifecycle Test ${Date.now()}`,
        status: 'draft',
        excerpt: 'Lifecycle test excerpt'
      })

      // 1. CREATE as draft
      postsAPI.createPost(postData).then((createResponse: any) => {
        postsAPI.validateSuccessResponse(createResponse, 201)
        const createdPost = createResponse.body.data
        expect(createdPost.status).to.eq('draft')
        cy.log(`1. Created post with status: draft`)

        // 2. UPDATE to published
        postsAPI.updatePost(createdPost.id, { status: 'published' })
          .then((publishResponse: any) => {
            postsAPI.validateSuccessResponse(publishResponse, 200)
            expect(publishResponse.body.data.status).to.eq('published')
            cy.log(`2. Updated status to: published`)

            // 3. UPDATE to archived
            postsAPI.updatePost(createdPost.id, { status: 'archived' })
              .then((archiveResponse: any) => {
                postsAPI.validateSuccessResponse(archiveResponse, 200)
                expect(archiveResponse.body.data.status).to.eq('archived')
                cy.log(`3. Updated status to: archived`)

                // 4. VERIFY final status
                postsAPI.getPostById(createdPost.id).then((finalResponse: any) => {
                  postsAPI.validateSuccessResponse(finalResponse, 200)
                  expect(finalResponse.body.data.status).to.eq('archived')
                  cy.log('4. Verified final status: archived')
                  cy.log('Full status lifecycle completed successfully')

                  // Cleanup
                  postsAPI.deletePost(createdPost.id)
                })
              })
          })
      })
    })
  })
})
