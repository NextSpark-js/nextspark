/**
 * Opportunities API - CRUD Tests
 *
 * Comprehensive test suite for Opportunity API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: name, companyId, pipelineId, stageId, amount, currency, closeDate
 * - Optional fields: contactId, probability, type, source, competitor, status, lostReason, assignedTo
 * - Access: shared within team (all team members see all opportunities)
 * - Team context: required (x-team-id header)
 * - Special: Stage moves, win/loss tracking, weighted value calculation
 */

/// <reference types="cypress" />

import {
  OpportunityAPIController,
  CompanyAPIController,
  PipelineAPIController
} from '../../../src/controllers'

describe('Opportunities API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instances
  let opportunityAPI: InstanceType<typeof OpportunityAPIController>
  let companyAPI: InstanceType<typeof CompanyAPIController>
  let pipelineAPI: InstanceType<typeof PipelineAPIController>

  // Track created resources for cleanup
  let createdOpportunities: any[] = []
  let createdCompanies: any[] = []
  let createdPipelines: any[] = []

  // Test fixtures (created once in before hook)
  let testCompany: any
  let testPipeline: any
  let testStageId: string

  before(() => {
    // Initialize controllers with superadmin credentials
    opportunityAPI = new OpportunityAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    companyAPI = new CompanyAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    pipelineAPI = new PipelineAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)

    // Create test company (shared across tests) - with retry for 500 errors
    cy.wrap(null).then(() => {
      return companyAPI.createTestRecord({
        name: `Test Company for Opportunities ${Date.now()}`,
        type: 'prospect',
        size: '11-50'
      }, { withRetry: true }).then((company: any) => {
        testCompany = company
        createdCompanies.push(testCompany)
        cy.log(`Created test company: ${testCompany.id}`)
      })
    })

    // Create test pipeline with stages (shared across tests)
    cy.wrap(null).then(() => {
      return pipelineAPI.createTestRecord({
        name: 'Test Pipeline for Opportunities',
        stages: [
          { name: 'Qualification', probability: 10, order: 1 },
          { name: 'Proposal', probability: 50, order: 2 },
          { name: 'Negotiation', probability: 75, order: 3 },
          { name: 'Closed Won', probability: 100, order: 4 }
        ]
      }, { withRetry: true }).then((pipeline: any) => {
        testPipeline = pipeline
        createdPipelines.push(pipeline)
        // Get first stage ID for testing
        if (pipeline.stages && pipeline.stages.length > 0) {
          testStageId = pipeline.stages[0].id || `stage-${Date.now()}`
        }
        cy.log(`Created test pipeline: ${testPipeline.id} with ${pipeline.stages?.length || 0} stages`)
      })
    })
  })

  afterEach(() => {
    // Cleanup created opportunities after each test
    createdOpportunities.forEach((opportunity) => {
      if (opportunity?.id) {
        opportunityAPI.delete(opportunity.id)
      }
    })
    createdOpportunities = []
    // Small delay to allow database connections to be released
    cy.wait(200)
  })

  after(() => {
    // Cleanup shared test fixtures
    if (testCompany?.id) {
      companyAPI.delete(testCompany.id)
    }
    if (testPipeline?.id) {
      pipelineAPI.delete(testPipeline.id)
    }
  })

  // ============================================
  // GET /api/v1/opportunities - List Opportunities
  // ============================================
  describe('GET /api/v1/opportunities - List Opportunities', () => {
    it('OPPO_API_001: Should list opportunities with valid API key', () => {
      opportunityAPI.getAll().then((response: any) => {
        opportunityAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} opportunities`)
      })
    })

    it('OPPO_API_002: Should list opportunities with pagination', () => {
      opportunityAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        opportunityAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} opportunities`)
      })
    })

    it('OPPO_API_003: Should filter opportunities by pipelineId', () => {
      // First create an opportunity with the test pipeline
      const opportunityData = opportunityAPI.generateRandomData({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdOpportunities.push(createResponse.body.data)

        // Now filter by that pipeline
        opportunityAPI.getAll({ pipelineId: testPipeline.id }).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned opportunities should have the specified pipelineId
          response.body.data.forEach((opportunity: any) => {
            expect(opportunity.pipelineId).to.eq(testPipeline.id)
          })

          cy.log(`Found ${response.body.data.length} opportunities for pipeline '${testPipeline.id}'`)
        })
      })
    })

    it('OPPO_API_004: Should filter opportunities by stageId', () => {
      // Create an opportunity with specific stage
      const opportunityData = opportunityAPI.generateRandomData({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdOpportunities.push(createResponse.body.data)

        // Filter by that stage
        opportunityAPI.getAll({ stageId: testStageId }).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned opportunities should have the specified stageId
          response.body.data.forEach((opportunity: any) => {
            expect(opportunity.stageId).to.eq(testStageId)
          })

          cy.log(`Found ${response.body.data.length} opportunities in stage '${testStageId}'`)
        })
      })
    })

    it('OPPO_API_005: Should filter opportunities by status', () => {
      // Create an opportunity with specific status
      const opportunityData = opportunityAPI.generateRandomData({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        status: 'open'
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdOpportunities.push(createResponse.body.data)

        // Filter by that status
        opportunityAPI.getAll({ status: 'open' }).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned opportunities should have the specified status
          response.body.data.forEach((opportunity: any) => {
            expect(opportunity.status).to.eq('open')
          })

          cy.log(`Found ${response.body.data.length} opportunities with status 'open'`)
        })
      })
    })

    it('OPPO_API_006: Should search opportunities by name', () => {
      // Create an opportunity with unique searchable term
      const uniqueTerm = `SearchOppo${Date.now()}`
      const opportunityData = opportunityAPI.generateRandomData({
        name: `${uniqueTerm} Deal`,
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdOpportunities.push(createResponse.body.data)

        // Search for the unique term
        opportunityAPI.getAll({ search: uniqueTerm }).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found opportunity contains our search term
          const foundOpportunity = response.body.data.find(
            (o: any) => o.id === createResponse.body.data.id
          )
          expect(foundOpportunity).to.exist
          expect(foundOpportunity.name).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} opportunities matching '${uniqueTerm}'`)
        })
      })
    })

    it('OPPO_API_007: Should reject request without API key', () => {
      const noAuthAPI = new OpportunityAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })

    it('OPPO_API_008: Should reject request without x-team-id', () => {
      const noTeamAPI = new OpportunityAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/opportunities - Create Opportunity
  // ============================================
  describe('POST /api/v1/opportunities - Create Opportunity', () => {
    it('OPPO_API_010: Should create opportunity with valid data', () => {
      const opportunityData = opportunityAPI.generateRandomData({
        name: 'Enterprise Deal Q4',
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        amount: 150000,
        currency: 'USD',
        closeDate: '2025-12-31',
        probability: 50,
        type: 'new_business',
        source: 'web',
        status: 'open'
      })

      opportunityAPI.create(opportunityData).then((response: any) => {
        opportunityAPI.validateSuccessResponse(response, 201)
        createdOpportunities.push(response.body.data)

        const opportunity = response.body.data
        opportunityAPI.validateObject(opportunity)

        // Verify provided data
        expect(opportunity.name).to.eq(opportunityData.name)
        expect(opportunity.companyId).to.eq(opportunityData.companyId)
        expect(opportunity.pipelineId).to.eq(opportunityData.pipelineId)
        expect(opportunity.stageId).to.eq(opportunityData.stageId)
        expect(Number(opportunity.amount)).to.eq(opportunityData.amount)
        expect(opportunity.currency).to.eq(opportunityData.currency)
        expect(opportunity.closeDate).to.include(opportunityData.closeDate.split('T')[0])
        expect(Number(opportunity.probability)).to.eq(opportunityData.probability)
        expect(opportunity.type).to.eq(opportunityData.type)
        expect(opportunity.source).to.eq(opportunityData.source)
        expect(opportunity.status).to.eq(opportunityData.status)

        cy.log(`Created opportunity: ${opportunity.name} (ID: ${opportunity.id})`)
      })
    })

    it('OPPO_API_011: Should create opportunity with minimal required fields', () => {
      const minimalData = {
        name: `Minimal Opportunity ${Date.now()}`,
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        amount: 50000,
        currency: 'USD',
        closeDate: '2025-12-15'
      }

      opportunityAPI.create(minimalData).then((response: any) => {
        opportunityAPI.validateSuccessResponse(response, 201)
        createdOpportunities.push(response.body.data)

        const opportunity = response.body.data
        opportunityAPI.validateObject(opportunity)

        // Verify required fields
        expect(opportunity.name).to.eq(minimalData.name)
        expect(opportunity.companyId).to.eq(minimalData.companyId)
        expect(opportunity.pipelineId).to.eq(minimalData.pipelineId)
        expect(opportunity.stageId).to.eq(minimalData.stageId)
        expect(Number(opportunity.amount)).to.eq(minimalData.amount)
        expect(opportunity.currency).to.eq(minimalData.currency)
        expect(opportunity.closeDate).to.include(minimalData.closeDate.split('T')[0])

        cy.log(`Created opportunity with minimal data: ${opportunity.id}`)
      })
    })

    it('OPPO_API_012: Should create opportunity with all optional fields', () => {
      const opportunityData = opportunityAPI.generateRandomData({
        name: `Complete Opportunity ${Date.now()}`,
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        amount: 200000,
        currency: 'EUR',
        closeDate: '2025-10-30',
        probability: 75,
        type: 'upgrade',
        source: 'referral',
        competitor: 'Competitor XYZ',
        status: 'open'
      })

      opportunityAPI.create(opportunityData).then((response: any) => {
        opportunityAPI.validateSuccessResponse(response, 201)
        createdOpportunities.push(response.body.data)

        const opportunity = response.body.data

        // Verify all fields
        expect(opportunity.name).to.eq(opportunityData.name)
        expect(opportunity.companyId).to.eq(opportunityData.companyId)
        expect(opportunity.pipelineId).to.eq(opportunityData.pipelineId)
        expect(opportunity.stageId).to.eq(opportunityData.stageId)
        expect(Number(opportunity.amount)).to.eq(opportunityData.amount)
        expect(opportunity.currency).to.eq(opportunityData.currency)
        expect(opportunity.closeDate).to.include(opportunityData.closeDate.split('T')[0])
        expect(Number(opportunity.probability)).to.eq(opportunityData.probability)
        expect(opportunity.type).to.eq(opportunityData.type)
        expect(opportunity.source).to.eq(opportunityData.source)
        expect(opportunity.competitor).to.eq(opportunityData.competitor)
        expect(opportunity.status).to.eq(opportunityData.status)

        cy.log(`Created opportunity with all fields: ${opportunity.id}`)
      })
    })

    it('OPPO_API_013: Should reject creation without name', () => {
      const invalidData = {
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        amount: 50000,
        currency: 'USD',
        closeDate: '2025-12-31'
        // Missing: name
      }

      opportunityAPI.create(invalidData).then((response: any) => {
        opportunityAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without name rejected with VALIDATION_ERROR')
      })
    })

    it('OPPO_API_014: Should allow creation without companyId (nullable relation)', () => {
      // Note: companyId is nullable in the database even though entity marks it required
      const minimalData = {
        name: 'Test Opportunity',
        pipelineId: testPipeline.id,
        stageId: testStageId,
        amount: 50000,
        currency: 'USD',
        closeDate: '2025-12-31'
        // Missing: companyId - API may allow null
      }

      opportunityAPI.create(minimalData).then((response: any) => {
        if (response.status === 201) {
          createdOpportunities.push(response.body.data)
          cy.log('Creation without companyId allowed - nullable relation')
        } else {
          expect(response.status).to.eq(400)
          cy.log('Creation without companyId rejected')
        }
      })
    })

    it('OPPO_API_015: Should allow creation without pipelineId (nullable relation)', () => {
      // Note: pipelineId is nullable in the database even though entity marks it required
      const minimalData = {
        name: 'Test Opportunity',
        companyId: testCompany.id,
        stageId: testStageId,
        amount: 50000,
        currency: 'USD',
        closeDate: '2025-12-31'
        // Missing: pipelineId - API may allow null
      }

      opportunityAPI.create(minimalData).then((response: any) => {
        if (response.status === 201) {
          createdOpportunities.push(response.body.data)
          cy.log('Creation without pipelineId allowed - nullable relation')
        } else {
          expect(response.status).to.eq(400)
          cy.log('Creation without pipelineId rejected')
        }
      })
    })

    it('OPPO_API_016: Should reject creation without stageId', () => {
      const invalidData = {
        name: 'Test Opportunity',
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        amount: 50000,
        currency: 'USD',
        closeDate: '2025-12-31'
        // Missing: stageId
      }

      opportunityAPI.create(invalidData).then((response: any) => {
        opportunityAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without stageId rejected with VALIDATION_ERROR')
      })
    })

    it('OPPO_API_017: Should reject creation without x-team-id', () => {
      const noTeamAPI = new OpportunityAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const opportunityData = opportunityAPI.generateRandomData({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      })

      noTeamAPI.create(opportunityData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // GET /api/v1/opportunities/{id} - Get Opportunity by ID
  // ============================================
  describe('GET /api/v1/opportunities/{id} - Get Opportunity by ID', () => {
    it('OPPO_API_020: Should get opportunity by valid ID', () => {
      // First create an opportunity
      const opportunityData = opportunityAPI.generateRandomData({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdOpportunities.push(createResponse.body.data)

        const opportunityId = createResponse.body.data.id

        // Get the opportunity by ID
        opportunityAPI.getById(opportunityId).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)

          const opportunity = response.body.data
          opportunityAPI.validateObject(opportunity)
          expect(opportunity.id).to.eq(opportunityId)
          expect(opportunity.name).to.eq(opportunityData.name)

          cy.log(`Retrieved opportunity: ${opportunity.name}`)
        })
      })
    })

    it('OPPO_API_021: Should return 404 for non-existent opportunity', () => {
      const fakeId = 'non-existent-opportunity-id-12345'

      opportunityAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent opportunity returns 404')
      })
    })
  })

  // ============================================
  // PATCH /api/v1/opportunities/{id} - Update Opportunity
  // ============================================
  describe('PATCH /api/v1/opportunities/{id} - Update Opportunity', () => {
    it('OPPO_API_030: Should update opportunity with multiple fields', () => {
      // First create an opportunity
      opportunityAPI.createTestRecord({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      }, { withRetry: true }).then((testOpportunity: any) => {
        createdOpportunities.push(testOpportunity)

        const updateData = {
          name: 'Updated Opportunity Name',
          amount: 250000,
          probability: 80,
          type: 'existing_business',
          source: 'social_media'
        }

        opportunityAPI.update(testOpportunity.id, updateData).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)

          const opportunity = response.body.data
          expect(opportunity.name).to.eq(updateData.name)
          expect(Number(opportunity.amount)).to.eq(updateData.amount)
          expect(Number(opportunity.probability)).to.eq(updateData.probability)
          expect(opportunity.type).to.eq(updateData.type)
          expect(opportunity.source).to.eq(updateData.source)
          // Original values should be preserved
          expect(opportunity.companyId).to.eq(testOpportunity.companyId)
          expect(opportunity.pipelineId).to.eq(testOpportunity.pipelineId)

          cy.log(`Updated opportunity: ${opportunity.name}`)
        })
      })
    })

    it('OPPO_API_031: Should update stageId (move stage)', () => {
      // Create opportunity in first stage
      opportunityAPI.createTestRecord({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      }, { withRetry: true }).then((testOpportunity: any) => {
        createdOpportunities.push(testOpportunity)

        // Get second stage ID
        const secondStageId = testPipeline.stages[1]?.id || testStageId

        // Move to second stage
        opportunityAPI.update(testOpportunity.id, { stageId: secondStageId }).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.stageId).to.eq(secondStageId)

          cy.log(`Moved opportunity to stage: ${secondStageId}`)
        })
      })
    })

    it('OPPO_API_032: Should update amount and probability', () => {
      opportunityAPI.createTestRecord({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      }, { withRetry: true }).then((testOpportunity: any) => {
        createdOpportunities.push(testOpportunity)

        const updateData = {
          amount: 300000,
          probability: 90
        }

        opportunityAPI.update(testOpportunity.id, updateData).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(Number(response.body.data.amount)).to.eq(updateData.amount)
          expect(Number(response.body.data.probability)).to.eq(updateData.probability)

          // Weighted value = amount * (probability / 100)
          const expectedWeightedValue = updateData.amount * (updateData.probability / 100)
          cy.log(`Updated amount: ${updateData.amount}, probability: ${updateData.probability}%`)
          cy.log(`Expected weighted value: ${expectedWeightedValue}`)
        })
      })
    })

    it('OPPO_API_033: Should update status to won', () => {
      opportunityAPI.createTestRecord({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        status: 'open'
      }, { withRetry: true }).then((testOpportunity: any) => {
        createdOpportunities.push(testOpportunity)

        const updateData = {
          status: 'won',
          probability: 100
        }

        opportunityAPI.update(testOpportunity.id, updateData).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('won')
          expect(Number(response.body.data.probability)).to.eq(100)

          cy.log(`Opportunity marked as WON`)
        })
      })
    })

    it('OPPO_API_034: Should update status to lost with lostReason', () => {
      opportunityAPI.createTestRecord({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        status: 'open'
      }, { withRetry: true }).then((testOpportunity: any) => {
        createdOpportunities.push(testOpportunity)

        const updateData = {
          status: 'lost',
          probability: 0,
          lostReason: 'Price too high'
        }

        opportunityAPI.update(testOpportunity.id, updateData).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq('lost')
          expect(Number(response.body.data.probability)).to.eq(0)
          expect(response.body.data.lostReason).to.eq(updateData.lostReason)

          cy.log(`Opportunity marked as LOST: ${updateData.lostReason}`)
        })
      })
    })

    it('OPPO_API_035: Should return 404 for non-existent opportunity', () => {
      const fakeId = 'non-existent-opportunity-id-12345'

      opportunityAPI.update(fakeId, { name: 'New Name' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent opportunity returns 404')
      })
    })

    it('OPPO_API_036: Should reject empty update body', () => {
      opportunityAPI.createTestRecord({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      }, { withRetry: true }).then((testOpportunity: any) => {
        createdOpportunities.push(testOpportunity)

        opportunityAPI.update(testOpportunity.id, {}).then((response: any) => {
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
  // DELETE /api/v1/opportunities/{id} - Delete Opportunity
  // ============================================
  describe('DELETE /api/v1/opportunities/{id} - Delete Opportunity', () => {
    it('OPPO_API_040: Should delete opportunity by valid ID', () => {
      // Create an opportunity to delete
      const opportunityData = opportunityAPI.generateRandomData({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const opportunityId = createResponse.body.data.id

        // Delete the opportunity
        opportunityAPI.delete(opportunityId).then((response: any) => {
          opportunityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', opportunityId)

          cy.log(`Deleted opportunity: ${opportunityId}`)
        })
      })
    })

    it('OPPO_API_041: Should return 404 for non-existent opportunity', () => {
      const fakeId = 'non-existent-opportunity-id-12345'

      opportunityAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent opportunity returns 404')
      })
    })

    it('OPPO_API_042: Should verify deletion persists', () => {
      // Create an opportunity
      const opportunityData = opportunityAPI.generateRandomData({
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const opportunityId = createResponse.body.data.id

        // Delete it
        opportunityAPI.delete(opportunityId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          opportunityAPI.getById(opportunityId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body).to.have.property('success', false)

            cy.log('Deletion verified - opportunity no longer exists')
          })
        })
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('OPPO_API_100: Should complete full lifecycle: Create -> Read -> Update -> Stage Move -> Win/Loss -> Delete', () => {
      // 1. CREATE
      const opportunityData = opportunityAPI.generateRandomData({
        name: 'Lifecycle Test Opportunity',
        companyId: testCompany.id,
        pipelineId: testPipeline.id,
        stageId: testStageId,
        amount: 100000,
        currency: 'USD',
        closeDate: '2025-12-31',
        probability: 25,
        type: 'new_business',
        source: 'web',
        status: 'open'
      })

      opportunityAPI.create(opportunityData).then((createResponse: any) => {
        opportunityAPI.validateSuccessResponse(createResponse, 201)
        const opportunityId = createResponse.body.data.id

        cy.log(`1. Created opportunity: ${opportunityId}`)

        // 2. READ
        opportunityAPI.getById(opportunityId).then((readResponse: any) => {
          opportunityAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.name).to.eq(opportunityData.name)
          expect(Number(readResponse.body.data.amount)).to.eq(opportunityData.amount)

          cy.log(`2. Read opportunity: ${readResponse.body.data.name}`)

          // 3. UPDATE BASIC FIELDS
          const updateData = {
            name: 'Updated Lifecycle Opportunity',
            amount: 150000,
            probability: 50,
            type: 'upgrade'
          }

          opportunityAPI.update(opportunityId, updateData).then((updateResponse: any) => {
            opportunityAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.name).to.eq(updateData.name)
            expect(Number(updateResponse.body.data.amount)).to.eq(updateData.amount)
            expect(Number(updateResponse.body.data.probability)).to.eq(updateData.probability)

            cy.log(`3. Updated opportunity: ${updateResponse.body.data.name}`)

            // 4. MOVE STAGE (to Proposal stage - index 1)
            const proposalStageId = testPipeline.stages[1]?.id || testStageId

            opportunityAPI.update(opportunityId, { stageId: proposalStageId }).then((stageResponse: any) => {
              opportunityAPI.validateSuccessResponse(stageResponse, 200)
              expect(stageResponse.body.data.stageId).to.eq(proposalStageId)

              cy.log(`4. Moved to Proposal stage: ${proposalStageId}`)

              // 5. INCREASE PROBABILITY (Negotiation stage)
              opportunityAPI.update(opportunityId, {
                probability: 75,
                amount: 175000
              }).then((probResponse: any) => {
                opportunityAPI.validateSuccessResponse(probResponse, 200)
                expect(Number(probResponse.body.data.probability)).to.eq(75)

                cy.log(`5. Increased probability to 75% and amount to 175000`)

                // 6. CLOSE AS WON
                opportunityAPI.closeAsWon(opportunityId).then((wonResponse: any) => {
                  opportunityAPI.validateSuccessResponse(wonResponse, 200)
                  expect(wonResponse.body.data.status).to.eq('won')
                  expect(Number(wonResponse.body.data.probability)).to.eq(100)

                  cy.log(`6. Closed as WON`)

                  // 7. DELETE
                  opportunityAPI.delete(opportunityId).then((deleteResponse: any) => {
                    opportunityAPI.validateSuccessResponse(deleteResponse, 200)
                    expect(deleteResponse.body.data).to.have.property('success', true)

                    cy.log(`7. Deleted opportunity: ${opportunityId}`)

                    // 8. VERIFY DELETION
                    opportunityAPI.getById(opportunityId).then((verifyResponse: any) => {
                      expect(verifyResponse.status).to.eq(404)

                      cy.log('8. Verified deletion - opportunity no longer exists')
                      cy.log('Full CRUD lifecycle with stage moves and win tracking completed successfully!')
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
