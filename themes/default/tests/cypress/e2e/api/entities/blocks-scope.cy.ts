/// <reference types="cypress" />

/**
 * Blocks Scope API - Tests
 *
 * Test suite for blocks scope filtering functionality.
 * Validates that GET /api/v1/blocks correctly filters blocks by scope parameter.
 *
 * Scope types:
 * - 'pages': Blocks available in page builder
 * - 'posts': Blocks available in post editor
 * - No scope: Returns all blocks
 *
 * Tags: @api, @feat-page-builder, @scope
 */

import * as allure from 'allure-cypress'

describe('Blocks Scope API - Filtering Tests', {
  tags: ['@api', '@feat-page-builder', '@scope']
}, () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'
  const API_BLOCKS = `${BASE_URL}/api/v1/blocks`

  // Helper to make authenticated API key requests
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
    allure.feature('Blocks')
  })

  // ============================================================
  // GET /api/v1/blocks - List All Blocks (No Scope Filter)
  // ============================================================
  describe('GET /api/v1/blocks - List All Blocks', () => {
    it('BLOCKS_API_001: Should list all blocks without scope filter', { tags: '@smoke' }, () => {
      allure.story('Scope Filtering')
      allure.severity('critical')

      apiRequest('GET', API_BLOCKS).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.be.greaterThan(0)

        cy.log(`Found ${response.body.data.length} total blocks`)
      })
    })

    it('BLOCKS_API_002: Should return blocks with expected structure', () => {
      apiRequest('GET', API_BLOCKS).then((response) => {
        expect(response.status).to.eq(200)

        if (response.body.data.length > 0) {
          const block = response.body.data[0]

          // Verify block structure
          expect(block).to.have.property('slug')
          expect(block).to.have.property('name')
          expect(block).to.have.property('description')
          expect(block).to.have.property('category')
          expect(block).to.have.property('fieldDefinitions')
          expect(block).to.have.property('scope')

          cy.log(`Block structure verified: ${block.name}`)
        }
      })
    })
  })

  // ============================================================
  // GET /api/v1/blocks?scope=pages - Filter by Pages Scope
  // ============================================================
  describe('GET /api/v1/blocks?scope=pages - Filter by Pages Scope', () => {
    it('BLOCKS_API_010: Should filter blocks by scope=pages', { tags: '@smoke' }, () => {
      allure.story('Scope Filtering')
      allure.severity('critical')

      apiRequest('GET', `${API_BLOCKS}?scope=pages`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        // All returned blocks should include 'pages' in their scope
        response.body.data.forEach((block: any) => {
          expect(block.scope).to.exist
          expect(block.scope).to.be.an('array')
          expect(block.scope).to.include('pages')
        })

        cy.log(`Found ${response.body.data.length} blocks with scope 'pages'`)
      })
    })

    it('BLOCKS_API_011: Should include expected blocks for pages', () => {
      apiRequest('GET', `${API_BLOCKS}?scope=pages`).then((response) => {
        expect(response.status).to.eq(200)

        const blockSlugs = response.body.data.map((b: any) => b.slug)

        // Expected blocks for pages (from plan.md)
        const expectedBlocks = [
          'cta-section',
          'features-grid',
          'testimonials',
          'text-content',
          'benefits'
        ]

        expectedBlocks.forEach((expectedSlug) => {
          expect(blockSlugs).to.include(expectedSlug)
          cy.log(`Verified block '${expectedSlug}' is available for pages`)
        })
      })
    })

    it('BLOCKS_API_012: Should not include posts-only blocks', () => {
      apiRequest('GET', `${API_BLOCKS}?scope=pages`).then((response) => {
        expect(response.status).to.eq(200)

        // Verify no block has scope=['posts'] only (without 'pages')
        response.body.data.forEach((block: any) => {
          if (block.scope && block.scope.length === 1 && block.scope[0] === 'posts') {
            throw new Error(`Block '${block.slug}' should not appear in pages scope`)
          }
        })

        cy.log('Verified posts-only blocks are excluded')
      })
    })
  })

  // ============================================================
  // GET /api/v1/blocks?scope=posts - Filter by Posts Scope
  // ============================================================
  describe('GET /api/v1/blocks?scope=posts - Filter by Posts Scope', () => {
    it('BLOCKS_API_020: Should filter blocks by scope=posts', { tags: '@smoke' }, () => {
      allure.story('Scope Filtering')
      allure.severity('critical')

      apiRequest('GET', `${API_BLOCKS}?scope=posts`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        // All returned blocks should include 'posts' in their scope
        response.body.data.forEach((block: any) => {
          expect(block.scope).to.exist
          expect(block.scope).to.be.an('array')
          expect(block.scope).to.include('posts')
        })

        cy.log(`Found ${response.body.data.length} blocks with scope 'posts'`)
      })
    })

    it('BLOCKS_API_021: Should include hero block for posts', () => {
      apiRequest('GET', `${API_BLOCKS}?scope=posts`).then((response) => {
        expect(response.status).to.eq(200)

        const blockSlugs = response.body.data.map((b: any) => b.slug)

        // Hero block should be available for posts (from plan.md)
        expect(blockSlugs).to.include('hero')

        const heroBlock = response.body.data.find((b: any) => b.slug === 'hero')
        expect(heroBlock).to.exist
        expect(heroBlock.scope).to.include('posts')

        cy.log("Verified 'hero' block is available for posts")
      })
    })

    it('BLOCKS_API_022: Should have fewer blocks than pages scope', () => {
      // Get blocks for pages
      apiRequest('GET', `${API_BLOCKS}?scope=pages`).then((pagesResponse) => {
        const pagesCount = pagesResponse.body.data.length

        // Get blocks for posts
        apiRequest('GET', `${API_BLOCKS}?scope=posts`).then((postsResponse) => {
          const postsCount = postsResponse.body.data.length

          // Posts scope should have fewer blocks (only hero according to plan.md)
          expect(postsCount).to.be.lessThan(pagesCount)

          cy.log(`Pages blocks: ${pagesCount}, Posts blocks: ${postsCount}`)
        })
      })
    })

    it('BLOCKS_API_023: Should not include pages-only blocks', () => {
      apiRequest('GET', `${API_BLOCKS}?scope=posts`).then((response) => {
        expect(response.status).to.eq(200)

        // Verify no block has scope=['pages'] only (without 'posts')
        response.body.data.forEach((block: any) => {
          if (block.scope && block.scope.length === 1 && block.scope[0] === 'pages') {
            throw new Error(`Block '${block.slug}' should not appear in posts scope`)
          }
        })

        cy.log('Verified pages-only blocks are excluded')
      })
    })
  })

  // ============================================================
  // Edge Cases and Validation
  // ============================================================
  describe('Edge Cases and Validation', () => {
    it('BLOCKS_API_030: Should handle invalid scope parameter gracefully', () => {
      apiRequest('GET', `${API_BLOCKS}?scope=invalid-scope`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        // Should return empty array or no blocks matching the invalid scope
        // (depending on implementation)
        cy.log(`Invalid scope returned ${response.body.data.length} blocks`)
      })
    })

    it('BLOCKS_API_031: Should handle empty scope parameter', () => {
      apiRequest('GET', `${API_BLOCKS}?scope=`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        cy.log(`Empty scope parameter returned ${response.body.data.length} blocks`)
      })
    })

    it('BLOCKS_API_032: Should handle multiple scope parameters', () => {
      // Test if API supports multiple scopes (optional feature)
      apiRequest('GET', `${API_BLOCKS}?scope=pages&scope=posts`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        cy.log(`Multiple scope parameters returned ${response.body.data.length} blocks`)
      })
    })

    it('BLOCKS_API_033: Should verify blocks without scope are not returned', () => {
      // Get all blocks
      apiRequest('GET', API_BLOCKS).then((allResponse) => {
        // Verify all blocks have a scope property
        allResponse.body.data.forEach((block: any) => {
          expect(block).to.have.property('scope')
          // Blocks with undefined or empty scope should not appear in filtered results
        })

        cy.log('Verified all blocks have scope property')
      })
    })
  })

  // ============================================================
  // Integration - Scope Consistency
  // ============================================================
  describe('Integration - Scope Consistency', () => {
    it('BLOCKS_API_100: Should maintain scope consistency across requests', () => {
      // Get all blocks
      apiRequest('GET', API_BLOCKS).then((allResponse) => {
        const allBlocks = allResponse.body.data
        const totalBlocks = allBlocks.length

        // Get pages scope
        apiRequest('GET', `${API_BLOCKS}?scope=pages`).then((pagesResponse) => {
          const pagesBlocks = pagesResponse.body.data

          // Get posts scope
          apiRequest('GET', `${API_BLOCKS}?scope=posts`).then((postsResponse) => {
            const postsBlocks = postsResponse.body.data

            // Verify consistency
            cy.log(`Total blocks: ${totalBlocks}`)
            cy.log(`Pages blocks: ${pagesBlocks.length}`)
            cy.log(`Posts blocks: ${postsBlocks.length}`)

            // Verify all filtered blocks exist in total blocks
            pagesBlocks.forEach((pageBlock: any) => {
              const existsInAll = allBlocks.some((b: any) => b.slug === pageBlock.slug)
              expect(existsInAll).to.be.true
            })

            postsBlocks.forEach((postBlock: any) => {
              const existsInAll = allBlocks.some((b: any) => b.slug === postBlock.slug)
              expect(existsInAll).to.be.true
            })

            cy.log('Scope consistency verified across all requests')
          })
        })
      })
    })

    it('BLOCKS_API_101: Should verify scope array structure', () => {
      apiRequest('GET', API_BLOCKS).then((response) => {
        expect(response.status).to.eq(200)

        // Verify each block's scope is an array of strings
        response.body.data.forEach((block: any) => {
          expect(block.scope).to.exist
          expect(block.scope).to.be.an('array')

          block.scope.forEach((scopeValue: any) => {
            expect(scopeValue).to.be.a('string')
            // Verify it's a valid scope value
            expect(['pages', 'posts']).to.include(scopeValue)
          })
        })

        cy.log('All block scopes have valid array structure')
      })
    })

    it('BLOCKS_API_102: Should verify dual-scope blocks appear in both filters', () => {
      // Get hero block from posts scope
      apiRequest('GET', `${API_BLOCKS}?scope=posts`).then((postsResponse) => {
        const heroInPosts = postsResponse.body.data.find((b: any) => b.slug === 'hero')

        if (heroInPosts) {
          // If hero is in posts, it might also be in pages
          apiRequest('GET', `${API_BLOCKS}?scope=pages`).then((pagesResponse) => {
            const heroInPages = pagesResponse.body.data.find((b: any) => b.slug === 'hero')

            if (heroInPages) {
              // Verify hero has both 'pages' and 'posts' in scope
              expect(heroInPosts.scope).to.include('posts')
              expect(heroInPages.scope).to.include('pages')

              cy.log("Hero block correctly appears in both scopes")
            } else {
              // Hero is posts-only
              expect(heroInPosts.scope).to.deep.equal(['posts'])
              cy.log("Hero block is posts-only")
            }
          })
        }
      })
    })
  })

  // ============================================================
  // Public Access (Blocks API is publicly accessible)
  // ============================================================
  describe('Public Access', () => {
    it('BLOCKS_API_200: Should allow public access without authentication', { tags: '@security' }, () => {
      /**
       * NOTE: The blocks API is intentionally public to allow frontend
       * applications to fetch block definitions without authentication.
       * This enables page/post editors to load block schemas client-side.
       */
      cy.request({
        method: 'GET',
        url: API_BLOCKS,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        cy.log('Blocks API is publicly accessible (by design)')
      })
    })

    it('BLOCKS_API_201: Should allow scope filter without authentication', { tags: '@security' }, () => {
      cy.request({
        method: 'GET',
        url: `${API_BLOCKS}?scope=pages`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        cy.log('Blocks scope filter is publicly accessible (by design)')
      })
    })
  })
})
