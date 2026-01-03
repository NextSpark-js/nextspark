/**
 * Products API - CRUD Tests
 *
 * Comprehensive test suite for Product API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: name, price
 * - Optional fields: sku, category, description, isActive
 * - Access: shared within team (all team members see all products)
 * - Team context: required (x-team-id header)
 * - Type: Config entity (typically lower test count)
 */

/// <reference types="cypress" />

import { ProductAPIController } from '../../../src/controllers'

describe('Products API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let productAPI: InstanceType<typeof ProductAPIController>

  // Track created products for cleanup
  let createdProducts: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    productAPI = new ProductAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created products after each test
    createdProducts.forEach((product) => {
      if (product?.id) {
        productAPI.delete(product.id)
      }
    })
    createdProducts = []
  })

  // ============================================
  // GET /api/v1/products - List Products
  // ============================================
  describe('GET /api/v1/products - List Products', () => {
    it('PROD_API_001: Should list products with valid API key', () => {
      productAPI.getAll().then((response: any) => {
        productAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} products`)
      })
    })

    it('PROD_API_002: Should list products with pagination', () => {
      productAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        productAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} products`)
      })
    })

    it('PROD_API_003: Should filter products by category', () => {
      // First create a product with a specific category
      const testCategory = 'Software'
      const productData = productAPI.generateRandomData({ category: testCategory })

      productAPI.create(productData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdProducts.push(createResponse.body.data)

        // Now filter by that category
        productAPI.getAll({ category: testCategory }).then((response: any) => {
          productAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned products should have the specified category
          response.body.data.forEach((product: any) => {
            expect(product.category).to.eq(testCategory)
          })

          cy.log(`Found ${response.body.data.length} products with category '${testCategory}'`)
        })
      })
    })

    it('PROD_API_004: Should filter products by active status', () => {
      // First create active and inactive products
      const activeProduct = productAPI.generateRandomData({ isActive: true })
      const inactiveProduct = productAPI.generateRandomData({ isActive: false })

      productAPI.create(activeProduct).then((createResponse1: any) => {
        expect(createResponse1.status).to.eq(201)
        createdProducts.push(createResponse1.body.data)

        productAPI.create(inactiveProduct).then((createResponse2: any) => {
          expect(createResponse2.status).to.eq(201)
          createdProducts.push(createResponse2.body.data)

          // Filter by active status
          productAPI.getAll({ isActive: true }).then((response: any) => {
            productAPI.validateSuccessResponse(response, 200)
            expect(response.body.data).to.be.an('array')

            // Verify our active product is in results
            const foundActive = response.body.data.find(
              (p: any) => p.id === createResponse1.body.data.id
            )
            expect(foundActive).to.exist
            expect(foundActive.isActive).to.be.true

            cy.log(`Found ${response.body.data.length} active products`)
          })
        })
      })
    })
  })

  // ============================================
  // POST /api/v1/products - Create Product
  // ============================================
  describe('POST /api/v1/products - Create Product', () => {
    it('PROD_API_010: Should create product with valid data', () => {
      const productData = productAPI.generateRandomData({
        code: 'ENT-LIC-001',
        name: 'Enterprise License',
        price: 9999.99,
        category: 'Software',
        description: 'Full enterprise license with all features',
        isActive: true
      })

      productAPI.create(productData).then((response: any) => {
        productAPI.validateSuccessResponse(response, 201)
        createdProducts.push(response.body.data)

        const product = response.body.data
        productAPI.validateObject(product)

        // Verify provided data
        expect(product.name).to.eq(productData.name)
        expect(product.price).to.satisfy((val: any) =>
          typeof val === 'number' ? val === productData.price : parseFloat(val) === productData.price
        )
        expect(product.code).to.eq(productData.code)
        expect(product.category).to.eq(productData.category)
        expect(product.description).to.eq(productData.description)
        expect(product.isActive).to.eq(productData.isActive)

        cy.log(`Created product: ${product.name} (ID: ${product.id})`)
      })
    })

    it('PROD_API_011: Should create product with minimal data (code, name, price only)', () => {
      const minimalData = {
        code: `MIN-${Date.now()}`,
        name: `Minimal Product ${Date.now()}`,
        price: 99.99
      }

      productAPI.create(minimalData).then((response: any) => {
        productAPI.validateSuccessResponse(response, 201)
        createdProducts.push(response.body.data)

        const product = response.body.data
        productAPI.validateObject(product)

        // Verify required fields
        expect(product.name).to.eq(minimalData.name)
        expect(product.price).to.satisfy((val: any) =>
          typeof val === 'number' ? val === minimalData.price : parseFloat(val) === minimalData.price
        )

        cy.log(`Created product with minimal data: ${product.id}`)
      })
    })

    it('PROD_API_012: Should create product with all optional fields', () => {
      const productData = productAPI.generateRandomData({
        code: 'COMPLETE-001',
        name: `Complete Product ${Date.now()}`,
        price: 4999.99,
        category: 'Services',
        description: 'Product with all fields populated',
        isActive: true
      })

      productAPI.create(productData).then((response: any) => {
        productAPI.validateSuccessResponse(response, 201)
        createdProducts.push(response.body.data)

        const product = response.body.data

        // Verify all fields
        expect(product.name).to.eq(productData.name)
        expect(product.code).to.eq(productData.code)
        expect(product.category).to.eq(productData.category)
        expect(product.description).to.eq(productData.description)
        expect(product.isActive).to.eq(productData.isActive)

        cy.log(`Created product with all fields: ${product.id}`)
      })
    })

    it('PROD_API_013: Should reject creation without name', () => {
      const invalidData = {
        code: 'NO-NAME-001',
        price: 99.99
        // Missing: name
      }

      productAPI.create(invalidData).then((response: any) => {
        productAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without name rejected with VALIDATION_ERROR')
      })
    })
  })

  // ============================================
  // GET /api/v1/products/{id} - Get Product by ID
  // ============================================
  describe('GET /api/v1/products/{id} - Get Product by ID', () => {
    it('PROD_API_020: Should get product by valid ID', () => {
      // First create a product
      const productData = productAPI.generateRandomData()

      productAPI.create(productData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdProducts.push(createResponse.body.data)

        const productId = createResponse.body.data.id

        // Get the product by ID
        productAPI.getById(productId).then((response: any) => {
          productAPI.validateSuccessResponse(response, 200)

          const product = response.body.data
          productAPI.validateObject(product)
          expect(product.id).to.eq(productId)
          expect(product.name).to.eq(productData.name)

          cy.log(`Retrieved product: ${product.name}`)
        })
      })
    })

    it('PROD_API_021: Should return 404 for non-existent product', () => {
      const fakeId = 'non-existent-product-id-12345'

      productAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent product returns 404')
      })
    })
  })

  // ============================================
  // PATCH /api/v1/products/{id} - Update Product
  // ============================================
  describe('PATCH /api/v1/products/{id} - Update Product', () => {
    it('PROD_API_030: Should update product with multiple fields', () => {
      // First create a product
      productAPI.createTestRecord().then((testProduct: any) => {
        createdProducts.push(testProduct)

        const updateData = {
          name: 'Updated Product Name',
          price: 1999.99,
          category: 'Training',
          description: 'Updated product description'
        }

        productAPI.update(testProduct.id, updateData).then((response: any) => {
          productAPI.validateSuccessResponse(response, 200)

          const product = response.body.data
          expect(product.name).to.eq(updateData.name)
          expect(product.category).to.eq(updateData.category)
          expect(product.description).to.eq(updateData.description)

          cy.log(`Updated product: ${product.name}`)
        })
      })
    })

    it('PROD_API_031: Should update product price', () => {
      productAPI.createTestRecord().then((testProduct: any) => {
        createdProducts.push(testProduct)

        const newPrice = 2999.99

        productAPI.update(testProduct.id, { price: newPrice }).then((response: any) => {
          productAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.price).to.satisfy((val: any) =>
            typeof val === 'number' ? val === newPrice : parseFloat(val) === newPrice
          )

          cy.log(`Updated price to: ${newPrice}`)
        })
      })
    })

    it('PROD_API_032: Should update product active status', () => {
      productAPI.createTestRecord().then((testProduct: any) => {
        createdProducts.push(testProduct)

        const newStatus = false

        productAPI.update(testProduct.id, { isActive: newStatus }).then((response: any) => {
          productAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.isActive).to.eq(newStatus)

          cy.log(`Updated isActive to: ${newStatus}`)
        })
      })
    })

    it('PROD_API_033: Should return 404 for non-existent product', () => {
      const fakeId = 'non-existent-product-id-12345'

      productAPI.update(fakeId, { name: 'New Name' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent product returns 404')
      })
    })
  })

  // ============================================
  // DELETE /api/v1/products/{id} - Delete Product
  // ============================================
  describe('DELETE /api/v1/products/{id} - Delete Product', () => {
    it('PROD_API_040: Should delete product by valid ID', () => {
      // Create a product to delete
      const productData = productAPI.generateRandomData()

      productAPI.create(productData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const productId = createResponse.body.data.id

        // Delete the product
        productAPI.delete(productId).then((response: any) => {
          productAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', productId)

          cy.log(`Deleted product: ${productId}`)
        })
      })
    })

    it('PROD_API_041: Should return 404 for non-existent product', () => {
      const fakeId = 'non-existent-product-id-12345'

      productAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent product returns 404')
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('PROD_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE
      const productData = productAPI.generateRandomData({
        code: 'LIFECYCLE-001',
        name: 'Lifecycle Test Product',
        price: 1999.99,
        category: 'Software',
        description: 'Initial product for lifecycle testing',
        isActive: true
      })

      productAPI.create(productData).then((createResponse: any) => {
        productAPI.validateSuccessResponse(createResponse, 201)
        const productId = createResponse.body.data.id

        cy.log(`1. Created product: ${productId}`)

        // 2. READ
        productAPI.getById(productId).then((readResponse: any) => {
          productAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.name).to.eq(productData.name)
          expect(readResponse.body.data.code).to.eq(productData.code)

          cy.log(`2. Read product: ${readResponse.body.data.name}`)

          // 3. UPDATE
          const updateData = {
            name: 'Updated Lifecycle Product',
            price: 2999.99,
            code: 'LIFECYCLE-002',
            category: 'Services',
            description: 'Updated product description',
            isActive: false
          }

          productAPI.update(productId, updateData).then((updateResponse: any) => {
            productAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.name).to.eq(updateData.name)
            expect(updateResponse.body.data.code).to.eq(updateData.code)
            expect(updateResponse.body.data.category).to.eq(updateData.category)
            expect(updateResponse.body.data.isActive).to.eq(updateData.isActive)

            cy.log(`3. Updated product: ${updateResponse.body.data.name}`)

            // 4. DELETE
            productAPI.delete(productId).then((deleteResponse: any) => {
              productAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted product: ${productId}`)

              // 5. VERIFY DELETION
              productAPI.getById(productId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - product no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
