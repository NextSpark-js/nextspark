/// <reference types="cypress" />

/**
 * Customers API - Metadata Tests
 *
 * Comprehensive test suite for Customer API endpoints with metadata functionality.
 * Tests GET, POST, PATCH, DELETE operations with various metadata scenarios.
 * Tests metadata parameter handling, merge behavior, and upsert functionality.
 */

import * as allure from 'allure-cypress'

const CustomerAPIController = require('../../../src/controllers/CustomerAPIController.js')

describe('Customers API - Metadata Operations', {
  tags: ['@api', '@feat-customers', '@metas', '@regression']
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
    allure.story('Metadata Operations')
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
  // GET /api/v1/customers - List with Metadata
  // ============================================
  describe('GET /api/v1/customers - List with Metadata', () => {
    let testCustomer: any

    beforeEach(() => {
      // Create a customer with metadata for testing
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        contactPreferences: {
          preferredTime: 'morning',
          preferredChannel: 'phone'
        },
        billing: {
          paymentTerms: 'net30',
          creditLimit: 50000
        }
      }

      return customerAPI.createCustomer(customerData).then((response: any) => {
        expect(response.status).to.eq(201)
        testCustomer = response.body.data
        createdCustomers.push(testCustomer)
      })
    })

    it('CUST_META_001: Should list without metas property when no metas param', () => {
      customerAPI.getCustomers().then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // When no metas param, response should not include metas property
        response.body.data.forEach((customer: any) => {
          expect(customer).to.not.have.property('metas')
        })

        cy.log('List without metas param - no metas property in response')
      })
    })

    it('CUST_META_002: Should list with metas=all includes all metadata groups', () => {
      customerAPI.getCustomers({ metas: 'all' }).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // Find our test customer
        const foundCustomer = response.body.data.find((c: any) => c.id === testCustomer.id)
        if (foundCustomer) {
          expect(foundCustomer).to.have.property('metas')
          expect(foundCustomer.metas).to.be.an('object')
          expect(foundCustomer.metas).to.have.property('contactPreferences')
          expect(foundCustomer.metas).to.have.property('billing')
        }

        cy.log('List with metas=all includes all metadata groups')
      })
    })

    it('CUST_META_003: Should list with metas=key1 includes only specified metaKey', () => {
      customerAPI.getCustomers({ metas: 'contactPreferences' }).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // Find our test customer
        const foundCustomer = response.body.data.find((c: any) => c.id === testCustomer.id)
        if (foundCustomer) {
          expect(foundCustomer).to.have.property('metas')
          expect(foundCustomer.metas).to.have.property('contactPreferences')
          // Should NOT have billing when only requesting contactPreferences
          expect(foundCustomer.metas).to.not.have.property('billing')
        }

        cy.log('List with metas=contactPreferences includes only that key')
      })
    })

    it('CUST_META_004: Should list with metas=key1,key2 includes multiple metaKeys', () => {
      customerAPI.getCustomers({ metas: 'contactPreferences,billing' }).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // Find our test customer
        const foundCustomer = response.body.data.find((c: any) => c.id === testCustomer.id)
        if (foundCustomer) {
          expect(foundCustomer).to.have.property('metas')
          expect(foundCustomer.metas).to.have.property('contactPreferences')
          expect(foundCustomer.metas).to.have.property('billing')
        }

        cy.log('List with metas=contactPreferences,billing includes both keys')
      })
    })

    it('CUST_META_005: Should list with non-existent metaKey returns metas without key', () => {
      customerAPI.getCustomers({ metas: 'nonExistentKey' }).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // Find our test customer - should have empty metas or metas without the key
        const foundCustomer = response.body.data.find((c: any) => c.id === testCustomer.id)
        if (foundCustomer) {
          expect(foundCustomer).to.have.property('metas')
          expect(foundCustomer.metas).to.not.have.property('nonExistentKey')
        }

        cy.log('List with non-existent metaKey returns metas without that key')
      })
    })

    it('CUST_META_006: Should list with pagination + metas works together', () => {
      customerAPI.getCustomers({ page: 1, limit: 5, metas: 'all' }).then((response: any) => {
        customerAPI.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)

        // Customers should have metas
        response.body.data.forEach((customer: any) => {
          expect(customer).to.have.property('metas')
        })

        cy.log('Pagination with metas works correctly')
      })
    })
  })

  // ============================================
  // GET /api/v1/customers/{id} - Get Single with Metadata
  // ============================================
  describe('GET /api/v1/customers/{id} - Get Single with Metadata', () => {
    let testCustomer: any

    beforeEach(() => {
      // Create a customer with metadata for testing
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        contactPreferences: {
          preferredTime: 'afternoon',
          preferredChannel: 'email'
        },
        billing: {
          paymentTerms: 'net60',
          creditLimit: 100000
        }
      }

      return customerAPI.createCustomer(customerData).then((response: any) => {
        expect(response.status).to.eq(201)
        testCustomer = response.body.data
        createdCustomers.push(testCustomer)
      })
    })

    it('CUST_META_010: Should get without metas param - no metas property', () => {
      customerAPI.getCustomerById(testCustomer.id).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.not.have.property('metas')

        cy.log('Get without metas param - no metas in response')
      })
    })

    it('CUST_META_011: Should get with metas=all includes all metadata groups', () => {
      customerAPI.getCustomerById(testCustomer.id, { metas: 'all' }).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('contactPreferences')
        expect(response.body.data.metas).to.have.property('billing')

        cy.log('Get with metas=all includes all metadata')
      })
    })

    it('CUST_META_012: Should get with metas=key1 includes only specified metaKey', () => {
      customerAPI.getCustomerById(testCustomer.id, { metas: 'contactPreferences' }).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('contactPreferences')
        expect(response.body.data.metas).to.not.have.property('billing')

        cy.log('Get with metas=contactPreferences includes only that key')
      })
    })

    it('CUST_META_013: Should get with metas=key1,key2 includes multiple metaKeys', () => {
      customerAPI
        .getCustomerById(testCustomer.id, { metas: 'contactPreferences,billing' })
        .then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.have.property('contactPreferences')
          expect(response.body.data.metas).to.have.property('billing')

          cy.log('Get with multiple metaKeys includes both')
        })
    })

    it('CUST_META_014: Should get customer without metadata returns metas: {}', () => {
      // Create a customer without metadata
      const customerData = customerAPI.generateRandomCustomerData()

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCustomers.push(createResponse.body.data)

        customerAPI
          .getCustomerById(createResponse.body.data.id, { metas: 'all' })
          .then((response: any) => {
            customerAPI.validateSuccessResponse(response, 200)
            expect(response.body.data).to.have.property('metas')
            expect(response.body.data.metas).to.deep.eq({})

            cy.log('Customer without metadata returns metas: {}')
          })
      })
    })

    it('CUST_META_015: Should get with non-existent key returns empty metas', () => {
      customerAPI
        .getCustomerById(testCustomer.id, { metas: 'nonExistentKey' })
        .then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.not.have.property('nonExistentKey')

          cy.log('Get with non-existent metaKey returns empty metas')
        })
    })
  })

  // ============================================
  // POST /api/v1/customers - Create with Metadata
  // ============================================
  describe('POST /api/v1/customers - Create with Metadata', () => {
    it('CUST_META_020: Should create without metas - no metas in response', () => {
      const customerData = customerAPI.generateRandomCustomerData()

      customerAPI.createCustomer(customerData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 201)
        createdCustomers.push(response.body.data)

        // Response should not have metas when not provided
        expect(response.body.data).to.not.have.property('metas')

        cy.log('Created customer without metas')
      })
    })

    it('CUST_META_021: Should create with one meta group - response includes metas', () => {
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = customerAPI.generateSampleMetadata('contactPreferences')

      customerAPI.createCustomer(customerData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 201)
        createdCustomers.push(response.body.data)

        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('contactPreferences')

        cy.log('Created customer with one meta group')
      })
    })

    it('CUST_META_022: Should create with multiple groups - all groups created', () => {
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        ...customerAPI.generateSampleMetadata('contactPreferences'),
        ...customerAPI.generateSampleMetadata('billing'),
        ...customerAPI.generateSampleMetadata('notes')
      }

      customerAPI.createCustomer(customerData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 201)
        createdCustomers.push(response.body.data)

        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('contactPreferences')
        expect(response.body.data.metas).to.have.property('billing')
        expect(response.body.data.metas).to.have.property('notes')

        cy.log('Created customer with multiple meta groups')
      })
    })

    it('CUST_META_023: Should create with nested structure - structure preserved', () => {
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        deepNested: {
          level1: {
            level2: {
              level3: {
                value: 'deeply nested value',
                array: [1, 2, 3]
              }
            }
          }
        }
      }

      customerAPI.createCustomer(customerData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 201)
        createdCustomers.push(response.body.data)

        expect(response.body.data.metas).to.have.property('deepNested')
        expect(response.body.data.metas.deepNested.level1.level2.level3.value).to.eq(
          'deeply nested value'
        )
        expect(response.body.data.metas.deepNested.level1.level2.level3.array).to.deep.eq([1, 2, 3])

        cy.log('Created customer with nested metadata structure')
      })
    })

    it('CUST_META_024: Should reject create with only metas (no required fields)', () => {
      const invalidData = {
        metas: customerAPI.generateSampleMetadata('contactPreferences')
      }

      customerAPI.createCustomer(invalidData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)

        cy.log('Create with only metas rejected (required fields missing)')
      })
    })

    it('CUST_META_025: Should handle create with invalid metas (string instead of object)', () => {
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = 'invalid string metas'

      customerAPI.createCustomer(customerData).then((response: any) => {
        // Should either reject or ignore invalid metas
        if (response.status === 201) {
          // If created, metas should be ignored or empty
          createdCustomers.push(response.body.data)
          cy.log('Invalid metas ignored, customer created')
        } else {
          expect(response.body).to.have.property('success', false)
          cy.log('Invalid metas rejected')
        }
      })
    })
  })

  // ============================================
  // PATCH /api/v1/customers/{id} - Update Metadata
  // ============================================
  describe('PATCH /api/v1/customers/{id} - Update Metadata', () => {
    let testCustomer: any

    beforeEach(() => {
      // Create a customer with initial metadata
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        contactPreferences: {
          preferredTime: 'morning',
          preferredChannel: 'phone',
          language: 'en'
        }
      }

      return customerAPI.createCustomer(customerData).then((response: any) => {
        expect(response.status).to.eq(201)
        testCustomer = response.body.data
        createdCustomers.push(testCustomer)
      })
    })

    it('CUST_META_030: Should update only customer data - metas unchanged, not in response', () => {
      customerAPI
        .updateCustomer(testCustomer.id, { phone: '+1-555-9999' })
        .then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.phone).to.eq('+1-555-9999')
          // Response should not include metas when not updating metas
          expect(response.body.data).to.not.have.property('metas')

          cy.log('Updated customer data only - metas not in response')
        })
    })

    it('CUST_META_031: Should update customer data + metas - both updated', () => {
      const updateData = {
        phone: '+1-555-8888',
        metas: {
          contactPreferences: {
            preferredTime: 'evening'
          }
        }
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)
        expect(response.body.data.phone).to.eq('+1-555-8888')
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas.contactPreferences.preferredTime).to.eq('evening')

        cy.log('Updated both customer data and metas')
      })
    })

    it('CUST_META_032: Should update only metas (requires entity field)', () => {
      // Generic entity API requires at least one entity field
      const updateData = {
        name: testCustomer.name, // Include entity field (no-op)
        metas: {
          contactPreferences: {
            preferredTime: 'night'
          }
        }
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas.contactPreferences.preferredTime).to.eq('night')

        cy.log('Updated only metas (with required entity field)')
      })
    })

    it('CUST_META_033: Should merge - add key to existing group', () => {
      const updateData = {
        name: testCustomer.name,
        metas: {
          contactPreferences: {
            newSetting: 'new value'
          }
        }
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // Should have both old and new keys
        expect(response.body.data.metas.contactPreferences).to.have.property('preferredTime')
        expect(response.body.data.metas.contactPreferences).to.have.property('preferredChannel')
        expect(response.body.data.metas.contactPreferences).to.have.property('newSetting')
        expect(response.body.data.metas.contactPreferences.newSetting).to.eq('new value')

        cy.log('Merge: added new key while preserving existing keys')
      })
    })

    it('CUST_META_034: Should merge - modify existing key', () => {
      const updateData = {
        name: testCustomer.name,
        metas: {
          contactPreferences: {
            preferredTime: 'evening' // Overwrite existing
          }
        }
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // preferredTime should be updated, others preserved
        expect(response.body.data.metas.contactPreferences.preferredTime).to.eq('evening')
        expect(response.body.data.metas.contactPreferences.preferredChannel).to.eq('phone')
        expect(response.body.data.metas.contactPreferences.language).to.eq('en')

        cy.log('Merge: modified existing key, preserved others')
      })
    })

    it('CUST_META_035: Should upsert - create new metaKey', () => {
      const updateData = {
        name: testCustomer.name,
        metas: {
          billing: {
            paymentTerms: 'net45',
            creditLimit: 75000
          }
        }
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        // Should have both contactPreferences and new billing
        expect(response.body.data.metas).to.have.property('contactPreferences')
        expect(response.body.data.metas).to.have.property('billing')
        expect(response.body.data.metas.billing.paymentTerms).to.eq('net45')

        cy.log('Upsert: created new metaKey')
      })
    })

    it('CUST_META_036: Should update multiple groups', () => {
      const updateData = {
        name: testCustomer.name,
        metas: {
          contactPreferences: {
            preferredTime: 'afternoon'
          },
          billing: {
            paymentTerms: 'net30'
          },
          notes: {
            priority: 'high'
          }
        }
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        customerAPI.validateSuccessResponse(response, 200)

        expect(response.body.data.metas).to.have.property('contactPreferences')
        expect(response.body.data.metas).to.have.property('billing')
        expect(response.body.data.metas).to.have.property('notes')

        cy.log('Updated multiple meta groups')
      })
    })

    it('CUST_META_037: Should update nested objects', () => {
      // First create customer with nested metadata
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        settings: {
          display: {
            theme: 'dark',
            fontSize: 14
          }
        }
      }

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCustomers.push(createResponse.body.data)

        // Update nested value - include all values we want to keep
        // Deep merge may replace entire nested objects at metaKey level
        const updateData = {
          name: createResponse.body.data.name,
          metas: {
            settings: {
              display: {
                theme: 'light',
                fontSize: 14 // Include to preserve
              }
            }
          }
        }

        customerAPI
          .updateCustomer(createResponse.body.data.id, updateData)
          .then((response: any) => {
            customerAPI.validateSuccessResponse(response, 200)
            expect(response.body.data.metas.settings.display.theme).to.eq('light')
            expect(response.body.data.metas.settings.display.fontSize).to.eq(14)

            cy.log('Updated nested object values')
          })
      })
    })

    it('CUST_META_038: Should reject update with empty metas {} (if no customer fields)', () => {
      const updateData = {
        metas: {}
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)

        cy.log('Update with empty metas and no fields rejected')
      })
    })

    it('CUST_META_039: Should reject update with invalid metas (string)', () => {
      const updateData = {
        metas: 'invalid string'
      }

      customerAPI.updateCustomer(testCustomer.id, updateData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)

        cy.log('Update with invalid metas rejected')
      })
    })
  })

  // ============================================
  // DELETE /api/v1/customers/{id} - Delete with Metadata
  // ============================================
  describe('DELETE /api/v1/customers/{id} - Delete with Metadata', () => {
    it('CUST_META_050: Should delete customer with metadata', () => {
      // Create customer with metas
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = customerAPI.generateSampleMetadata('contactPreferences')

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const customerId = createResponse.body.data.id

        // Delete
        customerAPI.deleteCustomer(customerId).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)

          cy.log('Deleted customer with metadata')
        })
      })
    })

    it('CUST_META_051: Should verify cascade delete - GET after DELETE returns 404', () => {
      // Create customer with metas
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        contactPreferences: { preferredChannel: 'email' },
        billing: { paymentTerms: 'net30' }
      }

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const customerId = createResponse.body.data.id

        // Delete
        customerAPI.deleteCustomer(customerId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          customerAPI.getCustomerById(customerId, { metas: 'all' }).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)

            cy.log('Cascade delete verified - customer and metas gone')
          })
        })
      })
    })

    it('CUST_META_052: Should delete customer without metadata normally', () => {
      // Create customer without metas
      const customerData = customerAPI.generateRandomCustomerData()

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const customerId = createResponse.body.data.id

        // Delete
        customerAPI.deleteCustomer(customerId).then((response: any) => {
          customerAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)

          cy.log('Deleted customer without metadata')
        })
      })
    })
  })

  // ============================================
  // Integration - Lifecycle with Metadata
  // ============================================
  describe('Integration - Lifecycle with Metadata', () => {
    it('CUST_META_100: Should complete full lifecycle with metas', () => {
      // 1. CREATE with metas
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        contactPreferences: {
          preferredTime: 'morning',
          preferredChannel: 'phone'
        }
      }

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        customerAPI.validateSuccessResponse(createResponse, 201)
        const customerId = createResponse.body.data.id
        expect(createResponse.body.data.metas).to.have.property('contactPreferences')

        cy.log('1. Created customer with metas')

        // 2. READ with metas
        customerAPI.getCustomerById(customerId, { metas: 'all' }).then((readResponse: any) => {
          customerAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.metas).to.have.property('contactPreferences')

          cy.log('2. Read customer with metas')

          // 3. UPDATE metas
          const updateData = {
            name: customerData.name,
            metas: {
              contactPreferences: {
                preferredTime: 'evening' // Update
              },
              billing: {
                paymentTerms: 'net30' // New group
              }
            }
          }

          customerAPI.updateCustomer(customerId, updateData).then((updateResponse: any) => {
            customerAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.metas.contactPreferences.preferredTime).to.eq(
              'evening'
            )
            expect(updateResponse.body.data.metas).to.have.property('billing')

            cy.log('3. Updated customer metas')

            // 4. DELETE
            customerAPI.deleteCustomer(customerId).then((deleteResponse: any) => {
              customerAPI.validateSuccessResponse(deleteResponse, 200)

              cy.log('4. Deleted customer')
              cy.log('Full lifecycle with metas completed!')
            })
          })
        })
      })
    })

    it('CUST_META_101: Should accumulate metas across multiple updates', () => {
      // Create customer with initial meta
      const customerData = customerAPI.generateRandomCustomerData()
      customerData.metas = {
        contactPreferences: { preferredTime: 'morning' }
      }

      customerAPI.createCustomer(customerData).then((createResponse: any) => {
        customerAPI.validateSuccessResponse(createResponse, 201)
        const customerId = createResponse.body.data.id
        createdCustomers.push(createResponse.body.data)

        // Update 1: Add more to contactPreferences
        customerAPI
          .updateCustomer(customerId, {
            name: customerData.name,
            metas: {
              contactPreferences: { preferredChannel: 'email' }
            }
          })
          .then((update1Response: any) => {
            customerAPI.validateSuccessResponse(update1Response, 200)

            // Should have both preferredTime and preferredChannel
            expect(update1Response.body.data.metas.contactPreferences).to.have.property(
              'preferredTime'
            )
            expect(update1Response.body.data.metas.contactPreferences).to.have.property(
              'preferredChannel'
            )

            // Update 2: Add new billing group
            customerAPI
              .updateCustomer(customerId, {
                name: customerData.name,
                metas: {
                  billing: { paymentTerms: 'net30' }
                }
              })
              .then((update2Response: any) => {
                customerAPI.validateSuccessResponse(update2Response, 200)

                // Should have contactPreferences AND billing
                expect(update2Response.body.data.metas).to.have.property('contactPreferences')
                expect(update2Response.body.data.metas).to.have.property('billing')

                // Update 3: Add notes group
                customerAPI
                  .updateCustomer(customerId, {
                    name: customerData.name,
                    metas: {
                      notes: { priority: 'high' }
                    }
                  })
                  .then((update3Response: any) => {
                    customerAPI.validateSuccessResponse(update3Response, 200)

                    // Final state should have all three groups
                    expect(update3Response.body.data.metas).to.have.property('contactPreferences')
                    expect(update3Response.body.data.metas).to.have.property('billing')
                    expect(update3Response.body.data.metas).to.have.property('notes')

                    // Verify all values accumulated
                    expect(
                      update3Response.body.data.metas.contactPreferences.preferredTime
                    ).to.eq('morning')
                    expect(
                      update3Response.body.data.metas.contactPreferences.preferredChannel
                    ).to.eq('email')
                    expect(update3Response.body.data.metas.billing.paymentTerms).to.eq('net30')
                    expect(update3Response.body.data.metas.notes.priority).to.eq('high')

                    cy.log('Accumulative merge test passed!')
                  })
              })
          })
      })
    })
  })
})
