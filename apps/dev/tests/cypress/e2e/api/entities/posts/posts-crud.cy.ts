/// <reference types="cypress" />

/**
 * Posts API - CRUD Tests
 *
 * Comprehensive test suite for Posts API endpoints.
 * Tests GET, POST, PUT, DELETE operations with taxonomy relations.
 *
 * Entity characteristics:
 * - Required fields: slug, title, blocks, locale
 * - Optional fields: excerpt, featuredImage, SEO fields, categoryIds
 * - Unique constraint: slug + locale
 * - Relations: post_taxonomy_relations (many-to-many with taxonomies)
 * - Access: authenticated users only (dual auth: session + API key)
 *
 * Tags: @api, @feat-posts, @crud, @regression
 */

import * as allure from 'allure-cypress'

const PostsAPIController = require('../../src/controllers/PostsAPIController.js')

describe('Posts API - CRUD Operations', {
  tags: ['@api', '@feat-posts', '@crud', '@regression']
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
    allure.feature('Posts')
  })

  afterEach(() => {
    // Cleanup: Delete posts created during tests
    createdPosts.forEach((postId) => {
      postsAPI.deletePost(postId)
    })
    createdPosts = []
  })

  // ============================================================
  // GET /api/v1/posts - List Posts
  // ============================================================
  describe('GET /api/v1/posts - List Posts', () => {
    it('POST_API_001: Should list posts with valid API key', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      postsAPI.getPosts().then((response: any) => {
        postsAPI.validateSuccessResponse(response, 200)
        postsAPI.validatePaginatedResponse(response)
        expect(response.body.data).to.be.an('array')

        cy.log(`Found ${response.body.data.length} posts`)
      })
    })

    it('POST_API_002: Should return post with expected structure', () => {
      postsAPI.getPosts().then((response: any) => {
        postsAPI.validateSuccessResponse(response, 200)

        if (response.body.data.length > 0) {
          const post = response.body.data[0]

          // Verify post structure
          expect(post).to.have.property('id')
          expect(post).to.have.property('slug')
          expect(post).to.have.property('title')
          expect(post).to.have.property('locale')
          expect(post).to.have.property('blocks')
          expect(post.blocks).to.be.an('array')

          // Categories relation (if present)
          if (post.hasOwnProperty('categories')) {
            expect(post.categories).to.be.an('array')
          }

          cy.log(`Post structure verified: ${post.title}`)
        }
      })
    })

    it('POST_API_003: Should paginate posts', () => {
      postsAPI.getPosts({ page: 1, limit: 5 }).then((response: any) => {
        postsAPI.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} posts`)
      })
    })

    it('POST_API_004: Should filter posts by published status', () => {
      postsAPI.getPosts({ published: true }).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // All returned posts should be published
        response.body.data.forEach((post: any) => {
          expect(post.published).to.be.true
        })

        cy.log(`Found ${response.body.data.length} published posts`)
      })
    })

    it('POST_API_005: Should filter posts by locale', () => {
      postsAPI.getPosts({ locale: 'en' }).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // All returned posts should have locale 'en'
        response.body.data.forEach((post: any) => {
          expect(post.locale).to.eq('en')
        })

        cy.log(`Found ${response.body.data.length} posts in 'en' locale`)
      })
    })

    it('POST_API_006: Should search posts by title/excerpt', () => {
      // Create a post with unique searchable term
      const uniqueTerm = `SearchPost${Date.now()}`
      const postData = PostsAPIController.generateRandomPostData({
        title: `Post ${uniqueTerm} Title`,
        excerpt: 'Test excerpt'
      })

      postsAPI.createPost(postData).then((createResponse: any) => {
        postsAPI.validateSuccessResponse(createResponse, 201)
        createdPosts.push(createResponse.body.data.id)

        // Search for the unique term
        postsAPI.getPosts({ search: uniqueTerm }).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          const foundPost = response.body.data.find(
            (p: any) => p.id === createResponse.body.data.id
          )
          expect(foundPost).to.exist
          expect(foundPost.title).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} posts matching '${uniqueTerm}'`)
        })
      })
    })

    it('POST_API_007: Should reject request without authentication', { tags: '@security' }, () => {
      // Create controller without API key
      const noAuthAPI = new PostsAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getPosts().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false

        cy.log('Request without API key rejected with 401')
      })
    })

    it('POST_API_008: Should reject request without x-team-id', () => {
      // Create controller without team ID
      const noTeamAPI = new PostsAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getPosts().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.code).to.eq('TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================================
  // POST /api/v1/posts - Create Post
  // ============================================================
  describe('POST /api/v1/posts - Create Post', () => {
    it('POST_API_010: Should create post with valid data', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      const postData = PostsAPIController.generateRandomPostData({
        title: 'TestCreate - Full Post',
        excerpt: 'This is a test post excerpt',
        featuredImage: '/images/test-featured.jpg',
        blocks: [
          {
            id: `block-${Date.now()}`,
            blockSlug: 'hero',
            props: {
              title: 'Test Hero',
              subtitle: 'Test Subtitle'
            }
          }
        ]
      })

      postsAPI.createPost(postData).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 201)
        postsAPI.validatePostObject(response.body.data)

        const post = response.body.data
        expect(post.slug).to.eq(postData.slug)
        expect(post.title).to.eq(postData.title)
        expect(post.excerpt).to.eq(postData.excerpt)
        expect(post.featuredImage).to.eq(postData.featuredImage)
        expect(post.locale).to.eq(postData.locale)
        expect(post.blocks).to.have.length(1)

        createdPosts.push(post.id)
        cy.log(`Created post: ${post.title} (ID: ${post.id})`)
      })
    })

    it('POST_API_011: Should create post with minimal data', () => {
      const minimalData = PostsAPIController.generateRandomPostData({
        title: `Minimal Post ${Date.now()}`
      })
      delete minimalData.excerpt
      delete minimalData.categoryIds

      postsAPI.createPost(minimalData).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 201)
        postsAPI.validatePostObject(response.body.data)

        const post = response.body.data
        expect(post.slug).to.eq(minimalData.slug)
        expect(post.title).to.eq(minimalData.title)
        expect(post.locale).to.eq(minimalData.locale)

        createdPosts.push(post.id)
        cy.log(`Created minimal post: ${post.id}`)
      })
    })

    it('POST_API_012: Should create post with SEO fields', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: `SEO Post ${Date.now()}`,
        seoTitle: 'Custom SEO Title',
        seoDescription: 'Custom SEO Description',
        seoKeywords: 'test, seo, keywords',
        ogImage: '/images/og-image.jpg',
        noindex: false,
        nofollow: false
      })

      postsAPI.createPost(postData).then((response: any) => {
        postsAPI.validateSuccessResponse(response, 201)

        const post = response.body.data
        expect(post.seoTitle).to.eq(postData.seoTitle)
        expect(post.seoDescription).to.eq(postData.seoDescription)
        expect(post.seoKeywords).to.eq(postData.seoKeywords)
        expect(post.ogImage).to.eq(postData.ogImage)

        createdPosts.push(post.id)
        cy.log(`Created post with SEO fields: ${post.id}`)
      })
    })

    it('POST_API_013: Should reject creation without title', () => {
      const invalidData = {
        slug: `no-title-${Date.now()}`,
        locale: 'en',
        blocks: []
        // Missing: title
      }

      postsAPI.createPost(invalidData).then((response: any) => {
        postsAPI.validateErrorResponse(response, 400)

        cy.log('Creation without title rejected with 400')
      })
    })

    it('POST_API_014: Should reject creation without slug', () => {
      const invalidData = {
        title: 'Test Post',
        locale: 'en',
        blocks: []
        // Missing: slug
      }

      postsAPI.createPost(invalidData).then((response: any) => {
        postsAPI.validateErrorResponse(response, 400)

        cy.log('Creation without slug rejected with 400')
      })
    })

    it('POST_API_015: Should reject invalid slug format', () => {
      const invalidData = {
        slug: 'Invalid Slug With Spaces!',
        title: 'Test Post',
        locale: 'en',
        blocks: []
      }

      postsAPI.createPost(invalidData).then((response: any) => {
        postsAPI.validateErrorResponse(response, 400)

        cy.log('Invalid slug format rejected with 400')
      })
    })

    it('POST_API_016: Should reject duplicate slug in same locale', () => {
      const uniqueSlug = `duplicate-slug-${Date.now()}`

      // Create first post
      const postData1 = PostsAPIController.generateRandomPostData({
        slug: uniqueSlug,
        title: 'First Post'
      })

      postsAPI.createPost(postData1).then((response1: any) => {
        postsAPI.validateSuccessResponse(response1, 201)
        createdPosts.push(response1.body.data.id)

        // Try to create duplicate
        const postData2 = PostsAPIController.generateRandomPostData({
          slug: uniqueSlug, // Same slug
          title: 'Second Post'
        })

        postsAPI.createPost(postData2).then((response2: any) => {
          expect(response2.status).to.be.oneOf([400, 409])
          expect(response2.body.success).to.be.false

          cy.log('Duplicate slug in same locale rejected')
        })
      })
    })

    it('POST_API_017: Should allow same slug in different locale', () => {
      const sharedSlug = `shared-slug-${Date.now()}`

      // Create post in 'en' locale
      const postDataEN = PostsAPIController.generateRandomPostData({
        slug: sharedSlug,
        title: 'English Post',
        locale: 'en'
      })

      postsAPI.createPost(postDataEN).then((responseEN: any) => {
        postsAPI.validateSuccessResponse(responseEN, 201)
        createdPosts.push(responseEN.body.data.id)

        // Create post with same slug in 'es' locale
        const postDataES = PostsAPIController.generateRandomPostData({
          slug: sharedSlug, // Same slug
          title: 'Spanish Post',
          locale: 'es' // Different locale
        })

        postsAPI.createPost(postDataES).then((responseES: any) => {
          postsAPI.validateSuccessResponse(responseES, 201)
          createdPosts.push(responseES.body.data.id)

          cy.log('Same slug in different locale allowed')
        })
      })
    })

    it('POST_API_018: Should reject creation without authentication', { tags: '@security' }, () => {
      const noAuthAPI = new PostsAPIController(BASE_URL, null, TEAM_ID)
      const postData = PostsAPIController.generateRandomPostData()

      noAuthAPI.createPost(postData).then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false

        cy.log('Creation without authentication rejected with 401')
      })
    })

    it('POST_API_019: Should reject creation without x-team-id', () => {
      const noTeamAPI = new PostsAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const postData = PostsAPIController.generateRandomPostData()

      noTeamAPI.createPost(postData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.code).to.eq('TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================================
  // GET /api/v1/posts/{id} - Get Post by ID
  // ============================================================
  describe('GET /api/v1/posts/{id} - Get Post by ID', () => {
    let testPostId: string

    beforeEach(() => {
      // Create a test post
      const postData = PostsAPIController.generateRandomPostData({
        title: `Test Get By ID ${Date.now()}`
      })

      postsAPI.createPost(postData).then((response: any) => {
        testPostId = response.body.data.id
        createdPosts.push(testPostId)
      })
    })

    it('POST_API_020: Should get post by valid ID', () => {
      cy.then(() => {
        postsAPI.getPostById(testPostId).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          postsAPI.validatePostObject(response.body.data)
          expect(response.body.data.id).to.eq(testPostId)

          cy.log(`Got post: ${response.body.data.title}`)
        })
      })
    })

    it('POST_API_021: Should return 404 for non-existent post', () => {
      postsAPI.getPostById('00000000-0000-0000-0000-000000000000').then((response: any) => {
        postsAPI.validateErrorResponse(response, 404)

        cy.log('Non-existent post returns 404')
      })
    })

    it('POST_API_022: Should return 404 for invalid UUID format', () => {
      postsAPI.getPostById('invalid-uuid-format').then((response: any) => {
        postsAPI.validateErrorResponse(response, 404)

        cy.log('Invalid UUID format returns 404')
      })
    })
  })

  // ============================================================
  // PUT /api/v1/posts/{id} - Update Post
  // ============================================================
  describe('PUT /api/v1/posts/{id} - Update Post', () => {
    let testPostId: string

    beforeEach(() => {
      const postData = PostsAPIController.generateRandomPostData({
        title: `Test Update ${Date.now()}`
      })

      postsAPI.createPost(postData).then((response: any) => {
        testPostId = response.body.data.id
        createdPosts.push(testPostId)
      })
    })

    it('POST_API_030: Should update post title', () => {
      const updateData = {
        title: 'Updated Title'
      }

      cy.then(() => {
        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.title).to.eq(updateData.title)

          cy.log(`Updated post title to: ${updateData.title}`)
        })
      })
    })

    it('POST_API_031: Should update post slug', () => {
      const updateData = {
        slug: `updated-slug-${Date.now()}`
      }

      cy.then(() => {
        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.slug).to.eq(updateData.slug)

          cy.log(`Updated post slug to: ${updateData.slug}`)
        })
      })
    })

    it('POST_API_032: Should update post excerpt and featured image', () => {
      const updateData = {
        excerpt: 'Updated excerpt text',
        featuredImage: '/images/updated-featured.jpg'
      }

      cy.then(() => {
        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.excerpt).to.eq(updateData.excerpt)
          expect(response.body.data.featuredImage).to.eq(updateData.featuredImage)

          cy.log('Updated excerpt and featured image')
        })
      })
    })

    it('POST_API_033: Should update post blocks', () => {
      const updateData = {
        blocks: [
          {
            id: `block-${Date.now()}`,
            blockSlug: 'hero',
            props: {
              title: 'New Hero Block'
            }
          }
        ]
      }

      cy.then(() => {
        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.blocks).to.have.length(1)
          expect(response.body.data.blocks[0].blockSlug).to.eq('hero')

          cy.log('Updated post blocks')
        })
      })
    })

    it('POST_API_034: Should publish post', () => {
      const updateData = {
        published: true
      }

      cy.then(() => {
        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.published).to.be.true

          cy.log('Post published successfully')
        })
      })
    })

    it('POST_API_035: Should update SEO fields', () => {
      const updateData = {
        seoTitle: 'Updated SEO Title',
        seoDescription: 'Updated SEO Description',
        noindex: true
      }

      cy.then(() => {
        postsAPI.updatePost(testPostId, updateData).then((response: any) => {
          postsAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.seoTitle).to.eq(updateData.seoTitle)
          expect(response.body.data.seoDescription).to.eq(updateData.seoDescription)
          expect(response.body.data.noindex).to.be.true

          cy.log('Updated SEO fields')
        })
      })
    })

    it('POST_API_036: Should return 404 for non-existent post', () => {
      postsAPI.updatePost('00000000-0000-0000-0000-000000000000', {
        title: 'New Title'
      }).then((response: any) => {
        postsAPI.validateErrorResponse(response, 404)

        cy.log('Update non-existent post returns 404')
      })
    })

    it('POST_API_037: Should reject update without authentication', { tags: '@security' }, () => {
      const noAuthAPI = new PostsAPIController(BASE_URL, null, TEAM_ID)

      cy.then(() => {
        noAuthAPI.updatePost(testPostId, { title: 'Unauthorized Update' }).then((response: any) => {
          expect(response.status).to.eq(401)
          expect(response.body.success).to.be.false

          cy.log('Update without authentication rejected with 401')
        })
      })
    })
  })

  // ============================================================
  // DELETE /api/v1/posts/{id} - Delete Post
  // ============================================================
  describe('DELETE /api/v1/posts/{id} - Delete Post', () => {
    it('POST_API_040: Should delete post by valid ID', () => {
      // Create post to delete
      const postData = PostsAPIController.generateRandomPostData({
        title: `Test Delete ${Date.now()}`
      })

      postsAPI.createPost(postData).then((createResponse: any) => {
        const postId = createResponse.body.data.id

        // Delete the post
        postsAPI.deletePost(postId).then((deleteResponse: any) => {
          postsAPI.validateSuccessResponse(deleteResponse, 200)

          // Verify deletion
          postsAPI.getPostById(postId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            cy.log(`Deleted and verified: ${postId}`)
          })
        })
      })
    })

    it('POST_API_041: Should return 404 for non-existent post', () => {
      postsAPI.deletePost('00000000-0000-0000-0000-000000000000').then((response: any) => {
        postsAPI.validateErrorResponse(response, 404)

        cy.log('Delete non-existent post returns 404')
      })
    })

    it('POST_API_042: Should reject deletion without authentication', { tags: '@security' }, () => {
      // Create a post first
      const postData = PostsAPIController.generateRandomPostData()

      postsAPI.createPost(postData).then((createResponse: any) => {
        const postId = createResponse.body.data.id
        createdPosts.push(postId)

        // Try to delete without auth
        const noAuthAPI = new PostsAPIController(BASE_URL, null, TEAM_ID)
        noAuthAPI.deletePost(postId).then((response: any) => {
          expect(response.status).to.eq(401)
          expect(response.body.success).to.be.false

          cy.log('Deletion without authentication rejected with 401')
        })
      })
    })
  })

  // ============================================================
  // Integration Test - Complete CRUD Lifecycle
  // ============================================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('POST_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      const postData = PostsAPIController.generateRandomPostData({
        title: 'Lifecycle Test Post',
        excerpt: 'Lifecycle test excerpt'
      })

      // 1. CREATE
      postsAPI.createPost(postData).then((createResponse: any) => {
        postsAPI.validateSuccessResponse(createResponse, 201)
        const createdPost = createResponse.body.data
        cy.log(`1. Created post: ${createdPost.id}`)

        // 2. READ
        postsAPI.getPostById(createdPost.id).then((readResponse: any) => {
          postsAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.title).to.eq(postData.title)
          cy.log(`2. Read post: ${createdPost.id}`)

          // 3. UPDATE
          const updateData = {
            title: 'Updated Lifecycle Post',
            published: true,
            excerpt: 'Updated excerpt'
          }
          postsAPI.updatePost(createdPost.id, updateData).then((updateResponse: any) => {
            postsAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.title).to.eq(updateData.title)
            expect(updateResponse.body.data.published).to.be.true
            expect(updateResponse.body.data.excerpt).to.eq(updateData.excerpt)
            cy.log(`3. Updated post: ${updateData.title}`)

            // 4. DELETE
            postsAPI.deletePost(createdPost.id).then((deleteResponse: any) => {
              postsAPI.validateSuccessResponse(deleteResponse, 200)
              cy.log(`4. Deleted post: ${createdPost.id}`)

              // 5. VERIFY DELETION
              postsAPI.getPostById(createdPost.id).then((finalResponse: any) => {
                expect(finalResponse.status).to.eq(404)
                cy.log('5. Verified deletion: post not found (404)')
                cy.log('Full CRUD lifecycle completed successfully')
              })
            })
          })
        })
      })
    })
  })
})
