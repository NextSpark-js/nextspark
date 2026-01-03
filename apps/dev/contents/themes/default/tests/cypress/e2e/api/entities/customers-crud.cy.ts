/**
 * Customers API - CRUD Tests
 *
 * Comprehensive test suite for Customer API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: name, account (UNIQUE), office
 * - Access: shared within team (all team members see all customers)
 * - Team context: required (x-team-id header)
 */

/// <reference types="cypress" />

import * as allure from 'allure-cypress'

const CustomerAPIController = require('../../../src/controllers/CustomerAPIController.js')

describe('Customers API - CRUD Operations', {
  tags: ['@api', '@feat-customers', '@crud', '@regression']
}, () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let customerAPI: InstanceType<typeof CustomerAPIController>

  // Track created customers for cleanup
  let createdCustomers: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    customerAPI = new CustomerAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Customers')
  })

  afterEach(() => {
    // Cleanup created customers after each test
    createdCustomers.forEach((customer) => {
      if (customer?.id) {
        customerAPI.deleteCustomer(customer.id)
      }
    })
    createdCustomers = []
  })

  // ============================================
  // GET /api/v1/customers - List Customers
  // ============================================
  describe('GET /api/v1/customers - List Customers', () => {
    it('CUST_API_001: Should list customers with valid API key', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')
      customerAPI.getCustomers().then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} customers`)
      })
    })

    it('CUST_API_002: Should list customers with pagination', () => {
      customerAPI.getCustomers({ page: 1, limit: 5 }).then((response: any) => {
        customerAPI.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} customers`)
      })
    })

    it('CUST_API_003: Should filter customers by office', () => {
      // First create a customer with a specific office
      const testOffice = `TestOffice-${Date.now()}`
      const customerData = customerAPI.generateRandomCustomerData({ office: testOffice })

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCustomers.push(createResponse.body.data)

        // Now filter by that office
        customerAPI.getCustomers({ office: testOffice }).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned customers should have the specified office
          response.body.data.forEach((customer: any) => {
            expect(customer.office).to.eq(testOffice)
          })

          cy.log(`Found ${response.body.data.length} customers with office '${testOffice}'`)
        })
      })
    })

    it('CUST_API_004: Should filter customers by salesRep', () => {
      // First create a customer with a specific salesRep
      const testSalesRep = `SalesRep-${Date.now()}`
      const customerData = customerAPI.generateRandomCustomerData({ salesRep: testSalesRep })

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCustomers.push(createResponse.body.data)

        // Now filter by that salesRep
        customerAPI.getCustomers({ salesRep: testSalesRep }).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned customers should have the specified salesRep
          response.body.data.forEach((customer: any) => {
            expect(customer.salesRep).to.eq(testSalesRep)
          })

          cy.log(`Found ${response.body.data.length} customers with salesRep '${testSalesRep}'`)
        })
      })
    })

    it('CUST_API_005: Should search customers by name/account', () => {
      // Create a customer with a unique searchable term
      const uniqueTerm = `SearchCustomer${Date.now()}`
      const customerData = customerAPI.generateRandomCustomerData({
        name: `Customer ${uniqueTerm} Corp`
      })

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCustomers.push(createResponse.body.data)

        // Search for the unique term
        customerAPI.getCustomers({ search: uniqueTerm }).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found customer contains our search term
          const foundCustomer = response.body.data.find(
            (c: any) => c.id === createResponse.body.data.id
          )
          expect(foundCustomer).to.exist
          expect(foundCustomer.name).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} customers matching '${uniqueTerm}'`)
        })
      })
    })

    it('CUST_API_006: Should return empty array for non-matching search', () => {
      const nonExistentTerm = 'NonExistentCustomerSearchTerm123456789'

      customerAPI.getCustomers({ search: nonExistentTerm }).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.eq(0)

        cy.log('Search with non-matching term returns empty array')
      })
    })

    it('CUST_API_007: Should reject request without API key', () => {
      const noAuthAPI = new CustomerAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getCustomers().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })

    it('CUST_API_008: Should reject request without x-team-id', () => {
      const noTeamAPI = new CustomerAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getCustomers().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/customers - Create Customer
  // ============================================
  describe('POST /api/v1/customers - Create Customer', () => {
    it('CUST_API_010: Should create customer with valid data', { tags: '@smoke' }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')
      const customerData = customerAPI.generateRandomCustomerData({
        phone: '+1-555-1234',
        salesRep: 'John Sales',
        visitDays: ['lun', 'mie', 'vie'],
        contactDays: ['mar', 'jue']
      })

      customerAPI.createCustomer(customerData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 201)
        createdCustomers.push(response.body.data)

        const customer = response.body.data
        customerAPI.validateCustomerObject(customer)

        // Verify provided data
        expect(customer.name).to.eq(customerData.name)
        expect(Number(customer.account)).to.eq(customerData.account)
        expect(customer.office).to.eq(customerData.office)
        expect(customer.phone).to.eq(customerData.phone)
        expect(customer.salesRep).to.eq(customerData.salesRep)
        expect(customer.visitDays).to.deep.eq(customerData.visitDays)
        expect(customer.contactDays).to.deep.eq(customerData.contactDays)

        cy.log(`Created customer: ${customer.name} (ID: ${customer.id})`)
      })
    })

    it('CUST_API_011: Should create customer with minimal data and default values', () => {
      const minimalData = {
        name: `Minimal Customer ${Date.now()}`,
        account: customerAPI.generateUniqueAccount(),
        office: 'Main Office'
      }

      customerAPI.createCustomer(minimalData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 201)
        createdCustomers.push(response.body.data)

        const customer = response.body.data
        customerAPI.validateCustomerObject(customer)

        // Verify required fields
        expect(customer.name).to.eq(minimalData.name)
        expect(Number(customer.account)).to.eq(minimalData.account)
        expect(customer.office).to.eq(minimalData.office)

        // Verify defaults for optional fields
        expect(customer.visitDays).to.deep.eq([])
        expect(customer.contactDays).to.deep.eq([])

        cy.log(`Created customer with minimal data: ${customer.id}`)
      })
    })

    it('CUST_API_012: Should create customer with visitDays/contactDays', () => {
      const customerData = customerAPI.generateRandomCustomerData({
        visitDays: ['lun', 'mar', 'mie'],
        contactDays: ['jue', 'vie']
      })

      customerAPI.createCustomer(customerData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 201)
        createdCustomers.push(response.body.data)

        const customer = response.body.data
        expect(customer.visitDays).to.be.an('array')
        expect(customer.visitDays).to.deep.eq(['lun', 'mar', 'mie'])
        expect(customer.contactDays).to.be.an('array')
        expect(customer.contactDays).to.deep.eq(['jue', 'vie'])

        cy.log(`Created customer with visitDays: ${JSON.stringify(customer.visitDays)}`)
      })
    })

    it('CUST_API_013: Should reject creation without name', () => {
      const invalidData = {
        account: customerAPI.generateUniqueAccount(),
        office: 'Test Office'
        // Missing: name
      }

      customerAPI.createCustomer(invalidData).then((response: any) => {
        customerAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without name rejected with VALIDATION_ERROR')
      })
    })

    it('CUST_API_014: Should reject creation without account', () => {
      const invalidData = {
        name: 'Test Customer',
        office: 'Test Office'
        // Missing: account
      }

      customerAPI.createCustomer(invalidData).then((response: any) => {
        // Can be 400 (validation) or 500 (DB constraint for INTEGER NOT NULL)
        expect(response.status).to.be.oneOf([400, 500])
        expect(response.body).to.have.property('success', false)

        cy.log('Creation without account rejected')
      })
    })

    it('CUST_API_015: Should reject creation without office', () => {
      const invalidData = {
        name: 'Test Customer',
        account: customerAPI.generateUniqueAccount()
        // Missing: office
      }

      customerAPI.createCustomer(invalidData).then((response: any) => {
        customerAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without office rejected with VALIDATION_ERROR')
      })
    })

    it('CUST_API_016: Should reject duplicate account number', () => {
      // First create a customer
      const customerData = customerAPI.generateRandomCustomerData()

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCustomers.push(createResponse.body.data)

        // Try to create another customer with the same account
        const duplicateData = customerAPI.generateRandomCustomerData({
          account: customerData.account // Same account number
        })

        customerAPI.createCustomer(duplicateData).then((response: any) => {
          // Should fail due to UNIQUE constraint
          expect(response.status).to.be.oneOf([400, 409, 500])
          expect(response.body).to.have.property('success', false)

          cy.log('Duplicate account number rejected')
        })
      })
    })

    it('CUST_API_017: Should reject creation without x-team-id', () => {
      const noTeamAPI = new CustomerAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const customerData = noTeamAPI.generateRandomCustomerData()

      noTeamAPI.createCustomer(customerData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // GET /api/v1/customers/{id} - Get Customer by ID
  // ============================================
  describe('GET /api/v1/customers/{id} - Get Customer by ID', () => {
    it('CUST_API_020: Should get customer by valid ID', () => {
      // First create a customer
      const customerData = customerAPI.generateRandomCustomerData()

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCustomers.push(createResponse.body.data)

        const customerId = createResponse.body.data.id

        // Get the customer by ID
        customerAPI.getCustomerById(customerId).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)

          const customer = response.body.data
          customerAPI.validateCustomerObject(customer)
          expect(customer.id).to.eq(customerId)
          expect(customer.name).to.eq(customerData.name)

          cy.log(`Retrieved customer: ${customer.name}`)
        })
      })
    })

    it('CUST_API_021: Should return 404 for non-existent customer', () => {
      const fakeId = 'non-existent-customer-id-12345'

      customerAPI.getCustomerById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent customer returns 404')
      })
    })

    // Note: No CUST_API_022 test for "access other user's record" because
    // customers entity has shared: true - all team members can see all customers
  })

  // ============================================
  // PATCH /api/v1/customers/{id} - Update Customer
  // ============================================
  describe('PATCH /api/v1/customers/{id} - Update Customer', () => {
    it('CUST_API_030: Should update customer with valid data', () => {
      // First create a customer
      customerAPI.createTestCustomer().then((testCustomer: any) => {
        createdCustomers.push(testCustomer)

        const updateData = {
          name: 'Updated Customer Name',
          phone: '+1-555-9999'
        }

        customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)

          const customer = response.body.data
          expect(customer.name).to.eq(updateData.name)
          expect(customer.phone).to.eq(updateData.phone)
          // Original values should be preserved
          expect(customer.office).to.eq(testCustomer.office)

          cy.log(`Updated customer: ${customer.name}`)
        })
      })
    })

    it('CUST_API_031: Should update customer office', () => {
      customerAPI.createTestCustomer().then((testCustomer: any) => {
        createdCustomers.push(testCustomer)

        const newOffice = 'New Branch Office'

        customerAPI.updateCustomer(testCustomer.id, { office: newOffice }).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.office).to.eq(newOffice)

          cy.log(`Updated office to: ${newOffice}`)
        })
      })
    })

    it('CUST_API_032: Should update customer salesRep', () => {
      customerAPI.createTestCustomer().then((testCustomer: any) => {
        createdCustomers.push(testCustomer)

        const newSalesRep = 'New Sales Representative'

        customerAPI
          .updateCustomer(testCustomer.id, { salesRep: newSalesRep })
          .then((response: any) => {
            customerAPI.validateSuccessResponse(response, 200)
            expect(response.body.data.salesRep).to.eq(newSalesRep)

            cy.log(`Updated salesRep to: ${newSalesRep}`)
          })
      })
    })

    it('CUST_API_033: Should update customer visitDays/contactDays', () => {
      customerAPI.createTestCustomer().then((testCustomer: any) => {
        createdCustomers.push(testCustomer)

        const updateData = {
          visitDays: ['lun', 'vie'],
          contactDays: ['mar', 'jue']
        }

        customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.visitDays).to.deep.eq(updateData.visitDays)
          expect(response.body.data.contactDays).to.deep.eq(updateData.contactDays)

          cy.log(`Updated visitDays and contactDays`)
        })
      })
    })

    it('CUST_API_034: Should reject update to duplicate account', () => {
      // Create two customers
      customerAPI.createTestCustomer().then((customer1: any) => {
        createdCustomers.push(customer1)

        customerAPI.createTestCustomer().then((customer2: any) => {
          createdCustomers.push(customer2)

          // Try to update customer2's account to customer1's account
          customerAPI
            .updateCustomer(customer2.id, { account: customer1.account })
            .then((response: any) => {
              // Should fail due to UNIQUE constraint
              expect(response.status).to.be.oneOf([400, 409, 500])
              expect(response.body).to.have.property('success', false)

              cy.log('Update to duplicate account rejected')
            })
        })
      })
    })

    it('CUST_API_035: Should return 404 for non-existent customer', () => {
      const fakeId = 'non-existent-customer-id-12345'

      customerAPI.updateCustomer(fakeId, { name: 'New Name' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent customer returns 404')
      })
    })

    it('CUST_API_036: Should reject empty update body', () => {
      customerAPI.createTestCustomer().then((testCustomer: any) => {
        createdCustomers.push(testCustomer)

        customerAPI.updateCustomer(testCustomer.id, {}).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.have.property('success', false)
          // Error code can be NO_FIELDS or HTTP_400 depending on validation layer
          expect(response.body.code).to.be.oneOf(['NO_FIELDS', 'HTTP_400'])

          cy.log('Empty update body rejected')
        })
      })
    })
  })

  // ============================================
  // DELETE /api/v1/customers/{id} - Delete Customer
  // ============================================
  describe('DELETE /api/v1/customers/{id} - Delete Customer', () => {
    it('CUST_API_040: Should delete customer by valid ID', () => {
      // Create a customer to delete
      const customerData = customerAPI.generateRandomCustomerData()

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const customerId = createResponse.body.data.id

        // Delete the customer
        customerAPI.deleteCustomer(customerId).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', customerId)

          cy.log(`Deleted customer: ${customerId}`)
        })
      })
    })

    it('CUST_API_041: Should return 404 for non-existent customer', () => {
      const fakeId = 'non-existent-customer-id-12345'

      customerAPI.deleteCustomer(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent customer returns 404')
      })
    })

    it('CUST_API_042: Should verify deletion persists', () => {
      // Create a customer
      const customerData = customerAPI.generateRandomCustomerData()

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const customerId = createResponse.body.data.id

        // Delete it
        customerAPI.deleteCustomer(customerId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          customerAPI.getCustomerById(customerId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body).to.have.property('success', false)

            cy.log('Deletion verified - customer no longer exists')
          })
        })
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('CUST_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE
      const customerData = customerAPI.generateRandomCustomerData({
        phone: '+1-555-0000',
        salesRep: 'Initial Rep',
        visitDays: ['lun'],
        contactDays: ['mar']
      })

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        customerAPI.validateSuccessResponse(createResponse, 201)
        const customerId = createResponse.body.data.id

        cy.log(`1. Created customer: ${customerId}`)

        // 2. READ
        customerAPI.getCustomerById(customerId).then((readResponse: any) => {
          customerAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.name).to.eq(customerData.name)

          cy.log(`2. Read customer: ${readResponse.body.data.name}`)

          // 3. UPDATE
          const updateData = {
            name: 'Updated Lifecycle Customer',
            phone: '+1-555-9999',
            salesRep: 'Updated Rep',
            visitDays: ['lun', 'mie', 'vie']
          }

          customerAPI.updateCustomer(customerId, updateData).then((updateResponse: any) => {
            customerAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.name).to.eq(updateData.name)
            expect(updateResponse.body.data.phone).to.eq(updateData.phone)

            cy.log(`3. Updated customer: ${updateResponse.body.data.name}`)

            // 4. DELETE
            customerAPI.deleteCustomer(customerId).then((deleteResponse: any) => {
              customerAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted customer: ${customerId}`)

              // 5. VERIFY DELETION
              customerAPI.getCustomerById(customerId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - customer no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
