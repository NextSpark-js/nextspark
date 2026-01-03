/**
 * Leads API - CRUD Tests
 *
 * Comprehensive test suite for Lead API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: companyName, contactName, email
 * - Access: shared within team (all team members see all leads)
 * - Team context: required (x-team-id header)
 * - Special: score field, source enum, status enum
 */

/// <reference types="cypress" />

import { LeadAPIController } from '../../../src/controllers'

describe('Leads API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let leadAPI: InstanceType<typeof LeadAPIController>

  // Track created leads for cleanup
  let createdLeads: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    leadAPI = new LeadAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created leads after each test
    createdLeads.forEach((lead) => {
      if (lead?.id) {
        leadAPI.delete(lead.id)
      }
    })
    createdLeads = []
  })

  // ============================================
  // GET /api/v1/leads - List Leads
  // ============================================
  describe('GET /api/v1/leads - List Leads', () => {
    it('LEAD_API_001: Should list leads with valid API key', () => {
      leadAPI.getAll().then((response: any) => {
        leadAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} leads`)
      })
    })

    it('LEAD_API_002: Should list leads with pagination', () => {
      leadAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        leadAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} leads`)
      })
    })

    it('LEAD_API_003: Should filter leads by status', () => {
      // First create a lead with a specific status
      const testStatus = 'new'
      const leadData = leadAPI.generateRandomData({ status: testStatus })

      leadAPI.create(leadData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdLeads.push(createResponse.body.data)

        // Now filter by that status
        leadAPI.getAll({ status: testStatus }).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned leads should have the specified status
          response.body.data.forEach((lead: any) => {
            expect(lead.status).to.eq(testStatus)
          })

          cy.log(`Found ${response.body.data.length} leads with status '${testStatus}'`)
        })
      })
    })

    it('LEAD_API_004: Should filter leads by source', () => {
      // First create a lead with a specific source (valid value from entity config)
      const testSource = 'web'
      const leadData = leadAPI.generateRandomData({ source: testSource })

      leadAPI.create(leadData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdLeads.push(createResponse.body.data)

        // Now filter by that source
        leadAPI.getAll({ source: testSource }).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned leads should have the specified source
          response.body.data.forEach((lead: any) => {
            expect(lead.source).to.eq(testSource)
          })

          cy.log(`Found ${response.body.data.length} leads with source '${testSource}'`)
        })
      })
    })

    it('LEAD_API_005: Should search leads by name/email', () => {
      // Create a lead with a unique searchable term
      const uniqueTerm = `SearchLead${Date.now()}`
      const leadData = leadAPI.generateRandomData({
        companyName: `${uniqueTerm} Corporation`
      })

      leadAPI.create(leadData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdLeads.push(createResponse.body.data)

        // Search for the unique term
        leadAPI.getAll({ search: uniqueTerm }).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found lead contains our search term
          const foundLead = response.body.data.find(
            (l: any) => l.id === createResponse.body.data.id
          )
          expect(foundLead).to.exist
          expect(foundLead.companyName).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} leads matching '${uniqueTerm}'`)
        })
      })
    })

    it('LEAD_API_006: Should return empty array for non-matching search', () => {
      const nonExistentTerm = 'NonExistentLeadSearchTerm123456789'

      leadAPI.getAll({ search: nonExistentTerm }).then((response: any) => {
        leadAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.eq(0)

        cy.log('Search with non-matching term returns empty array')
      })
    })

    it('LEAD_API_007: Should reject request without API key', () => {
      const noAuthAPI = new LeadAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })

    it('LEAD_API_008: Should reject request without x-team-id', () => {
      const noTeamAPI = new LeadAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/leads - Create Lead
  // ============================================
  describe('POST /api/v1/leads - Create Lead', () => {
    it('LEAD_API_010: Should create lead with valid data', () => {
      const leadData = leadAPI.generateRandomData({
        phone: '+1-555-1234',
        website: 'https://www.testcompany.com',
        score: 85,
        industry: 'Technology',
        companySize: '51-200',
        budget: 50000,
        notes: 'High quality lead from tech conference'
      })

      leadAPI.create(leadData).then((response: any) => {
        leadAPI.validateSuccessResponse(response, 201)
        createdLeads.push(response.body.data)

        const lead = response.body.data
        leadAPI.validateObject(lead)

        // Verify provided data
        expect(lead.companyName).to.eq(leadData.companyName)
        expect(lead.contactName).to.eq(leadData.contactName)
        expect(lead.email).to.eq(leadData.email)
        expect(lead.phone).to.eq(leadData.phone)
        expect(lead.website).to.eq(leadData.website)
        expect(Number(lead.score)).to.eq(leadData.score)
        expect(lead.industry).to.eq(leadData.industry)
        expect(lead.companySize).to.eq(leadData.companySize)
        expect(Number(lead.budget)).to.eq(leadData.budget)
        expect(lead.notes).to.eq(leadData.notes)

        cy.log(`Created lead: ${lead.companyName} (ID: ${lead.id})`)
      })
    })

    it('LEAD_API_011: Should create lead with minimal data', () => {
      const minimalData = {
        companyName: `Minimal Company ${Date.now()}`,
        contactName: `Minimal Contact ${Date.now()}`,
        email: `minimal-${Date.now()}@test.com`
      }

      leadAPI.create(minimalData).then((response: any) => {
        leadAPI.validateSuccessResponse(response, 201)
        createdLeads.push(response.body.data)

        const lead = response.body.data
        leadAPI.validateObject(lead)

        // Verify required fields
        expect(lead.companyName).to.eq(minimalData.companyName)
        expect(lead.contactName).to.eq(minimalData.contactName)
        expect(lead.email).to.eq(minimalData.email)

        cy.log(`Created lead with minimal data: ${lead.id}`)
      })
    })

    it('LEAD_API_012: Should create lead with score and all optional fields', () => {
      const leadData = leadAPI.generateRandomData({
        score: 100,
        source: 'social_media',
        status: 'qualified',
        industry: 'Healthcare',
        companySize: '500+',
        budget: 100000,
        notes: 'Top priority lead'
      })

      leadAPI.create(leadData).then((response: any) => {
        leadAPI.validateSuccessResponse(response, 201)
        createdLeads.push(response.body.data)

        const lead = response.body.data
        expect(Number(lead.score)).to.eq(100)
        expect(lead.source).to.eq('social_media')
        expect(lead.status).to.eq('qualified')
        expect(lead.industry).to.eq('Healthcare')
        expect(lead.companySize).to.eq('500+')
        expect(Number(lead.budget)).to.eq(100000)

        cy.log(`Created lead with score: ${lead.score}`)
      })
    })

    it('LEAD_API_013: Should reject creation without companyName', () => {
      const invalidData = {
        contactName: 'Test Contact',
        email: `test-${Date.now()}@test.com`
        // Missing: companyName
      }

      leadAPI.create(invalidData).then((response: any) => {
        leadAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without companyName rejected with VALIDATION_ERROR')
      })
    })

    it('LEAD_API_014: Should reject creation without contactName', () => {
      const invalidData = {
        companyName: 'Test Company',
        email: `test-${Date.now()}@test.com`
        // Missing: contactName
      }

      leadAPI.create(invalidData).then((response: any) => {
        leadAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without contactName rejected with VALIDATION_ERROR')
      })
    })

    it('LEAD_API_015: Should reject creation without email', () => {
      const invalidData = {
        companyName: 'Test Company',
        contactName: 'Test Contact'
        // Missing: email
      }

      leadAPI.create(invalidData).then((response: any) => {
        leadAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without email rejected with VALIDATION_ERROR')
      })
    })

    it('LEAD_API_016: Should reject duplicate email', () => {
      // First create a lead
      const leadData = leadAPI.generateRandomData()

      leadAPI.create(leadData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdLeads.push(createResponse.body.data)

        // Try to create another lead with the same email
        const duplicateData = leadAPI.generateRandomData({
          email: leadData.email // Same email
        })

        leadAPI.create(duplicateData).then((response: any) => {
          // Should fail due to UNIQUE constraint
          expect(response.status).to.be.oneOf([400, 409, 500])
          expect(response.body).to.have.property('success', false)

          cy.log('Duplicate email rejected')
        })
      })
    })

    it('LEAD_API_017: Should reject creation without x-team-id', () => {
      const noTeamAPI = new LeadAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const leadData = noTeamAPI.generateRandomData()

      noTeamAPI.create(leadData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // GET /api/v1/leads/{id} - Get Lead by ID
  // ============================================
  describe('GET /api/v1/leads/{id} - Get Lead by ID', () => {
    it('LEAD_API_020: Should get lead by valid ID', () => {
      // First create a lead
      const leadData = leadAPI.generateRandomData()

      leadAPI.create(leadData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdLeads.push(createResponse.body.data)

        const leadId = createResponse.body.data.id

        // Get the lead by ID
        leadAPI.getById(leadId).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)

          const lead = response.body.data
          leadAPI.validateObject(lead)
          expect(lead.id).to.eq(leadId)
          expect(lead.companyName).to.eq(leadData.companyName)
          expect(lead.email).to.eq(leadData.email)

          cy.log(`Retrieved lead: ${lead.companyName}`)
        })
      })
    })

    it('LEAD_API_021: Should return 404 for non-existent lead', () => {
      const fakeId = 'non-existent-lead-id-12345'

      leadAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent lead returns 404')
      })
    })

    // Note: No LEAD_API_022 test for "access other user's record" because
    // leads entity has shared: true - all team members can see all leads
  })

  // ============================================
  // PATCH /api/v1/leads/{id} - Update Lead
  // ============================================
  describe('PATCH /api/v1/leads/{id} - Update Lead', () => {
    it('LEAD_API_030: Should update lead with valid data', () => {
      // First create a lead
      leadAPI.createTestRecord().then((testLead: any) => {
        createdLeads.push(testLead)

        const updateData = {
          companyName: 'Updated Company Name',
          contactName: 'Updated Contact Name',
          phone: '+1-555-9999'
        }

        leadAPI.update(testLead.id, updateData).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)

          const lead = response.body.data
          expect(lead.companyName).to.eq(updateData.companyName)
          expect(lead.contactName).to.eq(updateData.contactName)
          expect(lead.phone).to.eq(updateData.phone)
          // Original email should be preserved
          expect(lead.email).to.eq(testLead.email)

          cy.log(`Updated lead: ${lead.companyName}`)
        })
      })
    })

    it('LEAD_API_031: Should update lead status', () => {
      leadAPI.createTestRecord().then((testLead: any) => {
        createdLeads.push(testLead)

        const newStatus = 'qualified'

        leadAPI.update(testLead.id, { status: newStatus }).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq(newStatus)

          cy.log(`Updated status to: ${newStatus}`)
        })
      })
    })

    it('LEAD_API_032: Should update lead score', () => {
      leadAPI.createTestRecord().then((testLead: any) => {
        createdLeads.push(testLead)

        const newScore = 95

        leadAPI.update(testLead.id, { score: newScore }).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)
          expect(Number(response.body.data.score)).to.eq(newScore)

          cy.log(`Updated score to: ${newScore}`)
        })
      })
    })

    it('LEAD_API_033: Should update lead source', () => {
      leadAPI.createTestRecord().then((testLead: any) => {
        createdLeads.push(testLead)

        // Valid source value from entity config
        const newSource = 'referral'

        leadAPI.update(testLead.id, { source: newSource }).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.source).to.eq(newSource)

          cy.log(`Updated source to: ${newSource}`)
        })
      })
    })

    it('LEAD_API_034: Should reject update to duplicate email', () => {
      // Create two leads
      leadAPI.createTestRecord().then((lead1: any) => {
        createdLeads.push(lead1)

        leadAPI.createTestRecord().then((lead2: any) => {
          createdLeads.push(lead2)

          // Try to update lead2's email to lead1's email
          leadAPI.update(lead2.id, { email: lead1.email }).then((response: any) => {
            // Should fail due to UNIQUE constraint
            expect(response.status).to.be.oneOf([400, 409, 500])
            expect(response.body).to.have.property('success', false)

            cy.log('Update to duplicate email rejected')
          })
        })
      })
    })

    it('LEAD_API_035: Should return 404 for non-existent lead', () => {
      const fakeId = 'non-existent-lead-id-12345'

      leadAPI.update(fakeId, { companyName: 'New Name' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent lead returns 404')
      })
    })

    it('LEAD_API_036: Should reject empty update body', () => {
      leadAPI.createTestRecord().then((testLead: any) => {
        createdLeads.push(testLead)

        leadAPI.update(testLead.id, {}).then((response: any) => {
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
  // DELETE /api/v1/leads/{id} - Delete Lead
  // ============================================
  describe('DELETE /api/v1/leads/{id} - Delete Lead', () => {
    it('LEAD_API_040: Should delete lead by valid ID', () => {
      // Create a lead to delete
      const leadData = leadAPI.generateRandomData()

      leadAPI.create(leadData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const leadId = createResponse.body.data.id

        // Delete the lead
        leadAPI.delete(leadId).then((response: any) => {
          leadAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', leadId)

          cy.log(`Deleted lead: ${leadId}`)
        })
      })
    })

    it('LEAD_API_041: Should return 404 for non-existent lead', () => {
      const fakeId = 'non-existent-lead-id-12345'

      leadAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent lead returns 404')
      })
    })

    it('LEAD_API_042: Should verify deletion persists', () => {
      // Create a lead
      const leadData = leadAPI.generateRandomData()

      leadAPI.create(leadData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const leadId = createResponse.body.data.id

        // Delete it
        leadAPI.delete(leadId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          leadAPI.getById(leadId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body).to.have.property('success', false)

            cy.log('Deletion verified - lead no longer exists')
          })
        })
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('LEAD_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE - Use valid enum values from entity config
      const leadData = leadAPI.generateRandomData({
        phone: '+1-555-0000',
        website: 'https://www.initialcompany.com',
        source: 'web',
        status: 'new',
        score: 50,
        industry: 'Technology',
        companySize: '11-50',
        budget: 25000,
        notes: 'Initial lead notes'
      })

      leadAPI.create(leadData).then((createResponse: any) => {
        leadAPI.validateSuccessResponse(createResponse, 201)
        const leadId = createResponse.body.data.id

        cy.log(`1. Created lead: ${leadId}`)

        // 2. READ
        leadAPI.getById(leadId).then((readResponse: any) => {
          leadAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.companyName).to.eq(leadData.companyName)
          expect(readResponse.body.data.email).to.eq(leadData.email)

          cy.log(`2. Read lead: ${readResponse.body.data.companyName}`)

          // 3. UPDATE
          const updateData = {
            companyName: 'Updated Lifecycle Company',
            contactName: 'Updated Contact',
            phone: '+1-555-9999',
            status: 'qualified',
            score: 95,
            notes: 'Updated lead notes - now qualified'
          }

          leadAPI.update(leadId, updateData).then((updateResponse: any) => {
            leadAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.companyName).to.eq(updateData.companyName)
            expect(updateResponse.body.data.status).to.eq(updateData.status)
            expect(Number(updateResponse.body.data.score)).to.eq(updateData.score)

            cy.log(`3. Updated lead: ${updateResponse.body.data.companyName}`)

            // 4. DELETE
            leadAPI.delete(leadId).then((deleteResponse: any) => {
              leadAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted lead: ${leadId}`)

              // 5. VERIFY DELETION
              leadAPI.getById(leadId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - lead no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
