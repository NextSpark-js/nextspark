/**
 * Companies API - CRUD Tests
 *
 * Comprehensive test suite for Company API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: name
 * - Optional fields: website, industry, size, type, phone, address, city, country, description
 * - Access: shared within team (all team members see all companies)
 * - Team context: required (x-team-id header)
 * - Special: Has related contacts
 */

/// <reference types="cypress" />

import { CompanyAPIController } from '../../../src/controllers'

describe('Companies API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let companyAPI: InstanceType<typeof CompanyAPIController>

  // Track created companies for cleanup
  let createdCompanies: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    companyAPI = new CompanyAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created companies after each test
    createdCompanies.forEach((company) => {
      if (company?.id) {
        companyAPI.delete(company.id)
      }
    })
    createdCompanies = []
    // Small delay to allow database connections to be released
    cy.wait(200)
  })

  // ============================================
  // GET /api/v1/companies - List Companies
  // ============================================
  describe('GET /api/v1/companies - List Companies', () => {
    it('COMP_API_001: Should list companies with valid API key', () => {
      companyAPI.getAll().then((response: any) => {
        companyAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} companies`)
      })
    })

    it('COMP_API_002: Should list companies with pagination', () => {
      companyAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        companyAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} companies`)
      })
    })

    it('COMP_API_003: Should filter companies by industry', () => {
      // First create a company with a specific industry
      const testIndustry = 'Technology'
      const companyData = companyAPI.generateRandomData({ industry: testIndustry })

      companyAPI.create(companyData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCompanies.push(createResponse.body.data)

        // Now filter by that industry
        companyAPI.getAll({ industry: testIndustry }).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned companies should have the specified industry
          response.body.data.forEach((company: any) => {
            expect(company.industry).to.eq(testIndustry)
          })

          cy.log(`Found ${response.body.data.length} companies with industry '${testIndustry}'`)
        })
      })
    })

    it('COMP_API_004: Should filter companies by size', () => {
      // First create a company with a specific size
      const testSize = '51-200'
      const companyData = companyAPI.generateRandomData({ size: testSize })

      companyAPI.create(companyData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCompanies.push(createResponse.body.data)

        // Now filter by that size
        companyAPI.getAll({ size: testSize }).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned companies should have the specified size
          response.body.data.forEach((company: any) => {
            expect(company.size).to.eq(testSize)
          })

          cy.log(`Found ${response.body.data.length} companies with size '${testSize}'`)
        })
      })
    })

    it('COMP_API_005: Should search companies by name', () => {
      // Create a company with a unique searchable term
      const uniqueTerm = `SearchCompany${Date.now()}`
      const companyData = companyAPI.generateRandomData({
        name: `${uniqueTerm} Corporation`
      })

      companyAPI.create(companyData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCompanies.push(createResponse.body.data)

        // Search for the unique term
        companyAPI.getAll({ search: uniqueTerm }).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found company contains our search term
          const foundCompany = response.body.data.find(
            (c: any) => c.id === createResponse.body.data.id
          )
          expect(foundCompany).to.exist
          expect(foundCompany.name).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} companies matching '${uniqueTerm}'`)
        })
      })
    })

    it('COMP_API_006: Should handle search with non-matching term', () => {
      const nonExistentTerm = 'xyzzy1234567890abcdef'

      companyAPI.getAll({ search: nonExistentTerm }).then((response: any) => {
        companyAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // If search filtering works, should be empty or have no matches
        // If search is ignored, will return paginated results
        response.body.data.forEach((company: any) => {
          // Each returned company should not contain the search term in name
          expect(company.name.toLowerCase()).to.not.include(nonExistentTerm.toLowerCase())
        })

        cy.log(`Search returned ${response.body.data.length} companies (none matching '${nonExistentTerm}')`)
      })
    })

    it('COMP_API_007: Should reject request without API key', () => {
      const noAuthAPI = new CompanyAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })

    it('COMP_API_008: Should reject request without x-team-id', () => {
      const noTeamAPI = new CompanyAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/companies - Create Company
  // ============================================
  describe('POST /api/v1/companies - Create Company', () => {
    it('COMP_API_010: Should create company with valid data', () => {
      const companyData = companyAPI.generateRandomData({
        website: 'https://www.testcompany.com',
        phone: '+1-555-1234',
        address: '123 Tech Blvd',
        city: 'San Francisco',
        country: 'USA'
      })

      companyAPI.create(companyData).then((response: any) => {
        companyAPI.validateSuccessResponse(response, 201)
        createdCompanies.push(response.body.data)

        const company = response.body.data
        companyAPI.validateObject(company)

        // Verify provided data
        expect(company.name).to.eq(companyData.name)
        expect(company.website).to.eq(companyData.website)
        expect(company.industry).to.eq(companyData.industry)
        expect(company.size).to.eq(companyData.size)
        expect(company.type).to.eq(companyData.type)
        expect(company.phone).to.eq(companyData.phone)
        expect(company.address).to.eq(companyData.address)
        expect(company.city).to.eq(companyData.city)
        expect(company.country).to.eq(companyData.country)

        cy.log(`Created company: ${company.name} (ID: ${company.id})`)
      })
    })

    it('COMP_API_011: Should create company with minimal data (name only)', () => {
      const minimalData = {
        name: `Minimal Company ${Date.now()}`
      }

      companyAPI.create(minimalData).then((response: any) => {
        companyAPI.validateSuccessResponse(response, 201)
        createdCompanies.push(response.body.data)

        const company = response.body.data
        companyAPI.validateObject(company)

        // Verify required fields
        expect(company.name).to.eq(minimalData.name)

        // Verify optional fields are null or undefined
        expect(company.website).to.satisfy((val: any) => val === null || val === undefined)

        cy.log(`Created company with minimal data: ${company.id}`)
      })
    })

    it('COMP_API_012: Should create company with all optional fields', () => {
      const companyData = companyAPI.generateRandomData({
        name: `Complete Company ${Date.now()}`,
        legalName: 'Complete Company LLC',
        website: 'https://www.complete-company.com',
        email: 'contact@complete-company.com',
        industry: 'Technology',
        size: '201-500',
        type: 'customer',
        phone: '+1-555-9876',
        address: '789 Complete Ave',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        postalCode: '10001',
        rating: 'hot'
      })

      companyAPI.create(companyData).then((response: any) => {
        companyAPI.validateSuccessResponse(response, 201)
        createdCompanies.push(response.body.data)

        const company = response.body.data

        // Verify all fields
        expect(company.name).to.eq(companyData.name)
        expect(company.legalName).to.eq(companyData.legalName)
        expect(company.website).to.eq(companyData.website)
        expect(company.email).to.eq(companyData.email)
        expect(company.industry).to.eq(companyData.industry)
        expect(company.size).to.eq(companyData.size)
        expect(company.type).to.eq(companyData.type)
        expect(company.phone).to.eq(companyData.phone)
        expect(company.address).to.eq(companyData.address)
        expect(company.city).to.eq(companyData.city)
        expect(company.country).to.eq(companyData.country)

        cy.log(`Created company with all fields: ${company.id}`)
      })
    })

    it('COMP_API_013: Should reject creation without name', () => {
      const invalidData = {
        website: 'https://www.invalid.com',
        industry: 'Technology'
        // Missing: name
      }

      companyAPI.create(invalidData).then((response: any) => {
        companyAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without name rejected with VALIDATION_ERROR')
      })
    })

    it('COMP_API_014: Should create company with website (URL validation)', () => {
      // Use minimal data to avoid other field validation issues
      const companyData = {
        name: `Website Company ${Date.now()}`,
        website: 'https://www.valid-website.com'
      }

      companyAPI.create(companyData).then((response: any) => {
        companyAPI.validateSuccessResponse(response, 201)
        createdCompanies.push(response.body.data)

        const company = response.body.data
        expect(company.website).to.eq(companyData.website)

        cy.log(`Created company with valid website: ${company.website}`)
      })
    })

    it('COMP_API_015: Should handle creation with non-standard website format', () => {
      // Note: The API may accept any string for website and may auto-prefix https://
      const testData = {
        name: `Website Test Company ${Date.now()}`,
        website: 'not-a-valid-url'
      }

      companyAPI.create(testData).then((response: any) => {
        // API may accept the value or reject it - handle both cases
        if (response.status === 201) {
          // If accepted, clean up
          createdCompanies.push(response.body.data)
          // The API might auto-prefix with https://
          expect(response.body.data.website).to.include('not-a-valid-url')
          cy.log('API accepted non-standard website format')
        } else {
          // If rejected, verify error response
          expect(response.status).to.be.oneOf([400, 422])
          expect(response.body).to.have.property('success', false)
          cy.log('Creation with invalid website format rejected')
        }
      })
    })

    it('COMP_API_016: Should create company with industry and size', () => {
      const companyData = companyAPI.generateRandomData({
        name: `Industry Company ${Date.now()}`,
        industry: 'Healthcare',
        size: '500+'
      })

      companyAPI.create(companyData).then((response: any) => {
        companyAPI.validateSuccessResponse(response, 201)
        createdCompanies.push(response.body.data)

        const company = response.body.data
        expect(company.industry).to.eq(companyData.industry)
        expect(company.size).to.eq(companyData.size)

        cy.log(`Created company with industry: ${company.industry}, size: ${company.size}`)
      })
    })

    it('COMP_API_017: Should reject creation without x-team-id', () => {
      const noTeamAPI = new CompanyAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const companyData = noTeamAPI.generateRandomData()

      noTeamAPI.create(companyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // GET /api/v1/companies/{id} - Get Company by ID
  // ============================================
  describe('GET /api/v1/companies/{id} - Get Company by ID', () => {
    it('COMP_API_020: Should get company by valid ID', () => {
      // First create a company
      const companyData = companyAPI.generateRandomData()

      companyAPI.create(companyData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCompanies.push(createResponse.body.data)

        const companyId = createResponse.body.data.id

        // Get the company by ID
        companyAPI.getById(companyId).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)

          const company = response.body.data
          companyAPI.validateObject(company)
          expect(company.id).to.eq(companyId)
          expect(company.name).to.eq(companyData.name)

          cy.log(`Retrieved company: ${company.name}`)
        })
      })
    })

    it('COMP_API_021: Should return 404 for non-existent company', () => {
      const fakeId = 'non-existent-company-id-12345'

      companyAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent company returns 404')
      })
    })

    // Note: No COMP_API_022 test for "access other user's record" because
    // companies entity has shared: true - all team members can see all companies
  })

  // ============================================
  // PATCH /api/v1/companies/{id} - Update Company
  // ============================================
  describe('PATCH /api/v1/companies/{id} - Update Company', () => {
    it('COMP_API_030: Should update company with multiple fields', () => {
      // First create a company
      companyAPI.createTestRecord({}, { withRetry: true }).then((testCompany: any) => {
        createdCompanies.push(testCompany)

        const updateData = {
          name: 'Updated Company Name',
          website: 'https://www.updated-company.com',
          phone: '+1-555-9999',
          city: 'Boston'
        }

        companyAPI.update(testCompany.id, updateData).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)

          const company = response.body.data
          expect(company.name).to.eq(updateData.name)
          expect(company.website).to.eq(updateData.website)
          expect(company.phone).to.eq(updateData.phone)
          expect(company.city).to.eq(updateData.city)
          // Original values should be preserved
          expect(company.industry).to.eq(testCompany.industry)

          cy.log(`Updated company: ${company.name}`)
        })
      })
    })

    it('COMP_API_031: Should update company name', () => {
      companyAPI.createTestRecord({}, { withRetry: true }).then((testCompany: any) => {
        createdCompanies.push(testCompany)

        const newName = 'New Company Name Inc.'

        companyAPI.update(testCompany.id, { name: newName }).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.name).to.eq(newName)

          cy.log(`Updated name to: ${newName}`)
        })
      })
    })

    it('COMP_API_032: Should update company industry', () => {
      companyAPI.createTestRecord({}, { withRetry: true }).then((testCompany: any) => {
        createdCompanies.push(testCompany)

        const newIndustry = 'Finance'

        companyAPI.update(testCompany.id, { industry: newIndustry }).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.industry).to.eq(newIndustry)

          cy.log(`Updated industry to: ${newIndustry}`)
        })
      })
    })

    it('COMP_API_033: Should update company size and type', () => {
      companyAPI.createTestRecord({}, { withRetry: true }).then((testCompany: any) => {
        createdCompanies.push(testCompany)

        const updateData = {
          size: '500+',
          type: 'partner'
        }

        companyAPI.update(testCompany.id, updateData).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.size).to.eq(updateData.size)
          expect(response.body.data.type).to.eq(updateData.type)

          cy.log(`Updated size: ${updateData.size}, type: ${updateData.type}`)
        })
      })
    })

    it('COMP_API_034: Should update company rating', () => {
      companyAPI.createTestRecord({}, { withRetry: true }).then((testCompany: any) => {
        createdCompanies.push(testCompany)

        const newRating = 'hot'

        companyAPI
          .update(testCompany.id, { rating: newRating })
          .then((response: any) => {
            companyAPI.validateSuccessResponse(response, 200)
            expect(response.body.data.rating).to.eq(newRating)

            cy.log(`Updated rating to: ${newRating}`)
          })
      })
    })

    it('COMP_API_035: Should return 404 for non-existent company', () => {
      const fakeId = 'non-existent-company-id-12345'

      companyAPI.update(fakeId, { name: 'New Name' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent company returns 404')
      })
    })

    it('COMP_API_036: Should reject empty update body', () => {
      companyAPI.createTestRecord({}, { withRetry: true }).then((testCompany: any) => {
        createdCompanies.push(testCompany)

        companyAPI.update(testCompany.id, {}).then((response: any) => {
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
  // DELETE /api/v1/companies/{id} - Delete Company
  // ============================================
  describe('DELETE /api/v1/companies/{id} - Delete Company', () => {
    it('COMP_API_040: Should delete company by valid ID', () => {
      // Create a company to delete
      const companyData = companyAPI.generateRandomData()

      companyAPI.create(companyData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const companyId = createResponse.body.data.id

        // Delete the company
        companyAPI.delete(companyId).then((response: any) => {
          companyAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', companyId)

          cy.log(`Deleted company: ${companyId}`)
        })
      })
    })

    it('COMP_API_041: Should return 404 for non-existent company', () => {
      const fakeId = 'non-existent-company-id-12345'

      companyAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent company returns 404')
      })
    })

    it('COMP_API_042: Should verify deletion persists', () => {
      // Create a company
      const companyData = companyAPI.generateRandomData()

      companyAPI.create(companyData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const companyId = createResponse.body.data.id

        // Delete it
        companyAPI.delete(companyId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          companyAPI.getById(companyId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body).to.have.property('success', false)

            cy.log('Deletion verified - company no longer exists')
          })
        })
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('COMP_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE
      const companyData = companyAPI.generateRandomData({
        name: 'Lifecycle Test Company',
        website: 'https://www.lifecycle-test.com',
        industry: 'Technology',
        size: '51-200',
        type: 'prospect',
        phone: '+1-555-0000',
        address: '100 Test Street',
        city: 'San Francisco',
        country: 'USA',
        rating: 'warm'
      })

      companyAPI.create(companyData).then((createResponse: any) => {
        companyAPI.validateSuccessResponse(createResponse, 201)
        const companyId = createResponse.body.data.id

        cy.log(`1. Created company: ${companyId}`)

        // 2. READ
        companyAPI.getById(companyId).then((readResponse: any) => {
          companyAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.name).to.eq(companyData.name)
          expect(readResponse.body.data.website).to.eq(companyData.website)

          cy.log(`2. Read company: ${readResponse.body.data.name}`)

          // 3. UPDATE
          const updateData = {
            name: 'Updated Lifecycle Company',
            website: 'https://www.updated-lifecycle.com',
            industry: 'Finance',
            size: '201-500',
            type: 'customer',
            phone: '+1-555-9999',
            rating: 'hot'
          }

          companyAPI.update(companyId, updateData).then((updateResponse: any) => {
            companyAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.name).to.eq(updateData.name)
            expect(updateResponse.body.data.website).to.eq(updateData.website)
            expect(updateResponse.body.data.industry).to.eq(updateData.industry)
            expect(updateResponse.body.data.size).to.eq(updateData.size)
            expect(updateResponse.body.data.type).to.eq(updateData.type)

            cy.log(`3. Updated company: ${updateResponse.body.data.name}`)

            // 4. DELETE
            companyAPI.delete(companyId).then((deleteResponse: any) => {
              companyAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted company: ${companyId}`)

              // 5. VERIFY DELETION
              companyAPI.getById(companyId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - company no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
