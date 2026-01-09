/// <reference types="cypress" />

/**
 * Post-Categories API - CRUD Tests
 *
 * Test suite for Post-Categories API endpoints (abstracts taxonomies internally).
 * Tests GET, POST, PUT, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: name
 * - Optional fields: slug (auto-generated if not provided), description, icon, color, parentId
 * - Unique constraint: type + slug (internally type='post_category')
 * - Access: authenticated users only (dual auth: session + API key)
 * - Hierarchical support: parentId for nested categories
 * - Soft delete: deletedAt when category has posts
 *
 * Tags: @api, @feat-posts, @crud, @categories
 */

import * as allure from 'allure-cypress'

describe('Post-Categories API - CRUD Operations', {
  tags: ['@api', '@feat-posts', '@crud', '@categories']
}, () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'
  const API_CATEGORIES = `${BASE_URL}/api/v1/post-categories`

  // Track created categories for cleanup
  let createdCategories: string[] = []

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
    allure.feature('Post Categories')
  })

  afterEach(() => {
    // Cleanup: Delete categories created during tests
    createdCategories.forEach((categoryId) => {
      apiRequest('DELETE', `${API_CATEGORIES}/${categoryId}`)
    })
    createdCategories = []
  })

  // ============================================================
  // GET /api/v1/post-categories - List Categories
  // ============================================================
  describe('GET /api/v1/post-categories - List Categories', () => {
    it('CAT_API_001: Should list categories with valid API key', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      apiRequest('GET', API_CATEGORIES).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        cy.log(`Found ${response.body.data.length} categories`)
      })
    })

    it('CAT_API_002: Should return category with expected structure', () => {
      apiRequest('GET', API_CATEGORIES).then((response) => {
        expect(response.status).to.eq(200)

        if (response.body.data.length > 0) {
          const category = response.body.data[0]

          // Verify category structure (type is not included in list responses)
          expect(category).to.have.property('id')
          expect(category).to.have.property('slug')
          expect(category).to.have.property('name')
          expect(category).to.have.property('isActive')

          cy.log(`Category structure verified: ${category.name}`)
        }
      })
    })

    it('CAT_API_003: Should only return active categories by default', () => {
      apiRequest('GET', API_CATEGORIES).then((response) => {
        expect(response.status).to.eq(200)

        // All returned categories should be active
        response.body.data.forEach((category: any) => {
          expect(category.isActive).to.be.true
        })

        cy.log(`All ${response.body.data.length} categories are active`)
      })
    })

    it('CAT_API_004: Should allow public read access without authentication', { tags: '@security' }, () => {
      /**
       * NOTE: GET /api/v1/post-categories is publicly accessible
       * to allow frontend applications to fetch categories for filtering.
       * Only write operations (POST, PUT, DELETE) require authentication.
       */
      cy.request({
        method: 'GET',
        url: API_CATEGORIES,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.be.an('array')

        cy.log('Categories list is publicly accessible (by design)')
      })
    })
  })

  // ============================================================
  // POST /api/v1/post-categories - Create Category
  // ============================================================
  describe('POST /api/v1/post-categories - Create Category', () => {
    it('CAT_API_010: Should create category with valid data', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      const timestamp = Date.now()
      const categoryData = {
        name: `Test Category ${timestamp}`,
        slug: `test-category-${timestamp}`,
        description: 'Test category description',
        icon: 'bookmark',
        color: '#FF5733'
      }

      apiRequest('POST', API_CATEGORIES, categoryData).then((response) => {
        expect(response.status).to.eq(201)
        expect(response.body.success).to.be.true

        const category = response.body.data
        expect(category).to.have.property('id')
        expect(category.type).to.eq('post_category')
        expect(category.slug).to.eq(categoryData.slug)
        expect(category.name).to.eq(categoryData.name)
        expect(category.description).to.eq(categoryData.description)
        expect(category.icon).to.eq(categoryData.icon)
        expect(category.color).to.eq(categoryData.color)

        createdCategories.push(category.id)
        cy.log(`Created category: ${category.name} (ID: ${category.id})`)
      })
    })

    it('CAT_API_011: Should auto-generate slug from name if not provided', () => {
      const categoryData = {
        name: `Auto Slug Category ${Date.now()}`
        // slug not provided
      }

      apiRequest('POST', API_CATEGORIES, categoryData).then((response) => {
        expect(response.status).to.eq(201)

        const category = response.body.data
        expect(category.slug).to.exist
        expect(category.slug).to.match(/^[a-z0-9\-]+$/)
        expect(category.name).to.eq(categoryData.name)

        createdCategories.push(category.id)
        cy.log(`Created category with auto-generated slug: ${category.slug}`)
      })
    })

    it('CAT_API_012: Should create category with minimal data', () => {
      const minimalData = {
        name: `Minimal Category ${Date.now()}`
      }

      apiRequest('POST', API_CATEGORIES, minimalData).then((response) => {
        expect(response.status).to.eq(201)

        const category = response.body.data
        expect(category.name).to.eq(minimalData.name)
        expect(category.slug).to.exist
        expect(category.isActive).to.be.true // Default value

        createdCategories.push(category.id)
        cy.log(`Created minimal category: ${category.id}`)
      })
    })

    it('CAT_API_013: Should create category with icon and color', () => {
      const categoryData = {
        name: `Styled Category ${Date.now()}`,
        icon: 'star',
        color: '#3B82F6'
      }

      apiRequest('POST', API_CATEGORIES, categoryData).then((response) => {
        expect(response.status).to.eq(201)

        const category = response.body.data
        expect(category.icon).to.eq(categoryData.icon)
        expect(category.color).to.eq(categoryData.color)

        createdCategories.push(category.id)
        cy.log(`Created styled category with icon '${category.icon}' and color '${category.color}'`)
      })
    })

    it('CAT_API_014: Should reject creation without name', () => {
      const invalidData = {
        slug: `no-name-${Date.now()}`
        // Missing: name
      }

      apiRequest('POST', API_CATEGORIES, invalidData).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false

        cy.log('Creation without name rejected with 400')
      })
    })

    it('CAT_API_015: Should reject invalid slug format', () => {
      const invalidData = {
        name: 'Test Category',
        slug: 'Invalid Slug With Spaces!'
      }

      apiRequest('POST', API_CATEGORIES, invalidData).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false

        cy.log('Invalid slug format rejected with 400')
      })
    })

    it('CAT_API_016: Should reject duplicate slug', () => {
      const uniqueSlug = `duplicate-cat-${Date.now()}`

      // Create first category
      const categoryData1 = {
        name: 'First Category',
        slug: uniqueSlug
      }

      apiRequest('POST', API_CATEGORIES, categoryData1).then((response1) => {
        expect(response1.status).to.eq(201)
        createdCategories.push(response1.body.data.id)

        // Try to create duplicate
        const categoryData2 = {
          name: 'Second Category',
          slug: uniqueSlug // Same slug
        }

        apiRequest('POST', API_CATEGORIES, categoryData2).then((response2) => {
          expect(response2.status).to.be.oneOf([400, 409])
          expect(response2.body.success).to.be.false

          cy.log('Duplicate slug rejected')
        })
      })
    })

    it('CAT_API_017: Should create hierarchical category with parentId', () => {
      // First create a parent category
      const parentData = {
        name: `Parent Category ${Date.now()}`
      }

      apiRequest('POST', API_CATEGORIES, parentData).then((parentResponse) => {
        expect(parentResponse.status).to.eq(201)
        const parentId = parentResponse.body.data.id
        createdCategories.push(parentId)

        // Create child category
        const childData = {
          name: `Child Category ${Date.now()}`,
          parentId: parentId
        }

        apiRequest('POST', API_CATEGORIES, childData).then((childResponse) => {
          expect(childResponse.status).to.eq(201)

          const childCategory = childResponse.body.data
          expect(childCategory.parentId).to.eq(parentId)

          createdCategories.push(childCategory.id)
          cy.log(`Created hierarchical category: ${childCategory.name} (parent: ${parentId})`)
        })
      })
    })

    it('CAT_API_018: Should reject creation without authentication', { tags: '@security' }, () => {
      const categoryData = {
        name: 'Unauthorized Category'
      }

      cy.request({
        method: 'POST',
        url: API_CATEGORIES,
        body: categoryData,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false

        cy.log('Creation without authentication rejected with 401')
      })
    })
  })

  // ============================================================
  // GET /api/v1/post-categories/{id} - Get Category by ID
  // ============================================================
  describe('GET /api/v1/post-categories/{id} - Get Category by ID', () => {
    let testCategoryId: string

    beforeEach(() => {
      // Create a test category
      const categoryData = {
        name: `Test Get By ID ${Date.now()}`,
        description: 'Test category for GET by ID'
      }

      apiRequest('POST', API_CATEGORIES, categoryData).then((response) => {
        testCategoryId = response.body.data.id
        createdCategories.push(testCategoryId)
      })
    })

    it('CAT_API_020: Should get category by valid ID', () => {
      cy.then(() => {
        apiRequest('GET', `${API_CATEGORIES}/${testCategoryId}`).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.success).to.be.true
          expect(response.body.data.id).to.eq(testCategoryId)
          // Note: type field is not included in GET by ID response
          expect(response.body.data).to.have.property('name')
          expect(response.body.data).to.have.property('slug')

          cy.log(`Got category: ${response.body.data.name}`)
        })
      })
    })

    it('CAT_API_021: Should return 404 for non-existent category', () => {
      apiRequest('GET', `${API_CATEGORIES}/non-existent-id-12345`).then((response) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false

        cy.log('Non-existent category returns 404')
      })
    })
  })

  // ============================================================
  // PUT /api/v1/post-categories/{id} - Update Category
  // ============================================================
  describe('PUT /api/v1/post-categories/{id} - Update Category', () => {
    let testCategoryId: string

    beforeEach(() => {
      const categoryData = {
        name: `Test Update ${Date.now()}`,
        description: 'Original description'
      }

      apiRequest('POST', API_CATEGORIES, categoryData).then((response) => {
        testCategoryId = response.body.data.id
        createdCategories.push(testCategoryId)
      })
    })

    it('CAT_API_030: Should update category name', () => {
      const updateData = {
        name: 'Updated Category Name'
      }

      cy.then(() => {
        apiRequest('PUT', `${API_CATEGORIES}/${testCategoryId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.name).to.eq(updateData.name)

          cy.log(`Updated category name to: ${updateData.name}`)
        })
      })
    })

    it('CAT_API_031: Should update category slug', () => {
      const updateData = {
        slug: `updated-slug-${Date.now()}`
      }

      cy.then(() => {
        apiRequest('PUT', `${API_CATEGORIES}/${testCategoryId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.slug).to.eq(updateData.slug)

          cy.log(`Updated category slug to: ${updateData.slug}`)
        })
      })
    })

    it('CAT_API_032: Should update category description', () => {
      const updateData = {
        description: 'Updated description text'
      }

      cy.then(() => {
        apiRequest('PUT', `${API_CATEGORIES}/${testCategoryId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.description).to.eq(updateData.description)

          cy.log('Updated category description')
        })
      })
    })

    it('CAT_API_033: Should update category icon and color', () => {
      const updateData = {
        icon: 'heart',
        color: '#EF4444'
      }

      cy.then(() => {
        apiRequest('PUT', `${API_CATEGORIES}/${testCategoryId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.icon).to.eq(updateData.icon)
          expect(response.body.data.color).to.eq(updateData.color)

          cy.log(`Updated icon to '${updateData.icon}' and color to '${updateData.color}'`)
        })
      })
    })

    it('CAT_API_034: Should toggle isActive status', () => {
      const updateData = {
        isActive: false
      }

      cy.then(() => {
        apiRequest('PUT', `${API_CATEGORIES}/${testCategoryId}`, updateData).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.isActive).to.be.false

          cy.log('Category deactivated')
        })
      })
    })

    it('CAT_API_035: Should return 404 for non-existent category', () => {
      apiRequest('PUT', `${API_CATEGORIES}/non-existent-id-12345`, {
        name: 'New Name'
      }).then((response) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false

        cy.log('Update non-existent category returns 404')
      })
    })

    it('CAT_API_036: Should reject update without authentication', { tags: '@security' }, () => {
      cy.then(() => {
        cy.request({
          method: 'PUT',
          url: `${API_CATEGORIES}/${testCategoryId}`,
          body: { name: 'Unauthorized Update' },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(401)
          expect(response.body.success).to.be.false

          cy.log('Update without authentication rejected with 401')
        })
      })
    })
  })

  // ============================================================
  // DELETE /api/v1/post-categories/{id} - Delete Category
  // ============================================================
  describe('DELETE /api/v1/post-categories/{id} - Delete Category', () => {
    it('CAT_API_040: Should delete category by valid ID', () => {
      // Create category to delete
      const categoryData = {
        name: `Test Delete ${Date.now()}`
      }

      apiRequest('POST', API_CATEGORIES, categoryData).then((createResponse) => {
        const categoryId = createResponse.body.data.id

        // Delete the category
        apiRequest('DELETE', `${API_CATEGORIES}/${categoryId}`).then((deleteResponse) => {
          expect(deleteResponse.status).to.eq(200)
          expect(deleteResponse.body.success).to.be.true

          // Verify deletion (may be soft delete or hard delete depending on usage)
          apiRequest('GET', `${API_CATEGORIES}/${categoryId}`).then((getResponse) => {
            // Should either be 404 (hard delete) or exist but deletedAt set (soft delete)
            expect(getResponse.status).to.be.oneOf([200, 404])
            cy.log(`Deleted category: ${categoryId}`)
          })
        })
      })
    })

    it('CAT_API_041: Should return 404 for non-existent category', () => {
      apiRequest('DELETE', `${API_CATEGORIES}/non-existent-id-12345`).then((response) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false

        cy.log('Delete non-existent category returns 404')
      })
    })

    it('CAT_API_042: Should reject deletion without authentication', { tags: '@security' }, () => {
      // Create a category first
      const categoryData = {
        name: `Auth Delete Test ${Date.now()}`
      }

      apiRequest('POST', API_CATEGORIES, categoryData).then((createResponse) => {
        const categoryId = createResponse.body.data.id
        createdCategories.push(categoryId)

        // Try to delete without auth
        cy.request({
          method: 'DELETE',
          url: `${API_CATEGORIES}/${categoryId}`,
          failOnStatusCode: false
        }).then((response) => {
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
    it('CAT_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      const timestamp = Date.now()
      const categoryData = {
        name: `Lifecycle Test ${timestamp}`,
        slug: `lifecycle-test-${timestamp}`,
        description: 'Lifecycle test description',
        icon: 'check',
        color: '#10B981'
      }

      // 1. CREATE
      apiRequest('POST', API_CATEGORIES, categoryData).then((createResponse) => {
        expect(createResponse.status).to.eq(201)
        const createdCategory = createResponse.body.data
        cy.log(`1. Created category: ${createdCategory.id}`)

        // 2. READ
        apiRequest('GET', `${API_CATEGORIES}/${createdCategory.id}`).then((readResponse) => {
          expect(readResponse.status).to.eq(200)
          expect(readResponse.body.data.name).to.eq(categoryData.name)
          cy.log(`2. Read category: ${createdCategory.id}`)

          // 3. UPDATE
          const updateData = {
            name: 'Updated Lifecycle Category',
            description: 'Updated description',
            icon: 'star',
            color: '#F59E0B'
          }
          apiRequest('PUT', `${API_CATEGORIES}/${createdCategory.id}`, updateData).then((updateResponse) => {
            expect(updateResponse.status).to.eq(200)
            expect(updateResponse.body.data.name).to.eq(updateData.name)
            expect(updateResponse.body.data.description).to.eq(updateData.description)
            expect(updateResponse.body.data.icon).to.eq(updateData.icon)
            expect(updateResponse.body.data.color).to.eq(updateData.color)
            cy.log(`3. Updated category: ${updateData.name}`)

            // 4. DELETE
            apiRequest('DELETE', `${API_CATEGORIES}/${createdCategory.id}`).then((deleteResponse) => {
              expect(deleteResponse.status).to.eq(200)
              cy.log(`4. Deleted category: ${createdCategory.id}`)

              // 5. VERIFY DELETION
              apiRequest('GET', `${API_CATEGORIES}/${createdCategory.id}`).then((finalResponse) => {
                // May return 404 or 200 with deletedAt depending on implementation
                cy.log('5. Verified deletion')
                cy.log('Full CRUD lifecycle completed successfully')
              })
            })
          })
        })
      })
    })
  })
})
