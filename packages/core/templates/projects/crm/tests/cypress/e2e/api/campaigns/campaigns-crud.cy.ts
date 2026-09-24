/**
 * Campaigns API - CRUD Tests
 *
 * Comprehensive test suite for Campaign API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: name, type, status
 * - Optional fields: startDate, endDate, budget, actualCost, expectedRevenue, description
 * - Access: shared within team (all team members see all campaigns)
 * - Team context: required (x-team-id header)
 */

/// <reference types="cypress" />

import { CampaignAPIController } from '../../../src/controllers'

describe('Campaigns API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let campaignAPI: InstanceType<typeof CampaignAPIController>

  // Track created campaigns for cleanup
  let createdCampaigns: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    campaignAPI = new CampaignAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created campaigns after each test
    createdCampaigns.forEach((campaign) => {
      if (campaign?.id) {
        campaignAPI.delete(campaign.id)
      }
    })
    createdCampaigns = []
    // Small delay to allow database connections to be released
    cy.wait(200)
  })

  // ============================================
  // GET /api/v1/campaigns - List Campaigns
  // ============================================
  describe('GET /api/v1/campaigns - List Campaigns', () => {
    it('CAMP_API_001: Should list campaigns with valid API key', () => {
      campaignAPI.getAll().then((response: any) => {
        campaignAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} campaigns`)
      })
    })

    it('CAMP_API_002: Should list campaigns with pagination', () => {
      campaignAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        campaignAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} campaigns`)
      })
    })

    it('CAMP_API_003: Should filter campaigns by type', () => {
      // First create a campaign with a specific type
      const testType = 'email'
      const campaignData = campaignAPI.generateRandomData({ type: testType })

      campaignAPI.create(campaignData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCampaigns.push(createResponse.body.data)

        // Now filter by that type
        campaignAPI.getAll({ type: testType }).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned campaigns should have the specified type
          response.body.data.forEach((campaign: any) => {
            expect(campaign.type).to.eq(testType)
          })

          cy.log(`Found ${response.body.data.length} campaigns with type '${testType}'`)
        })
      })
    })

    it('CAMP_API_004: Should filter campaigns by status', () => {
      // First create a campaign with a specific status
      const testStatus = 'active'
      const campaignData = campaignAPI.generateRandomData({ status: testStatus })

      campaignAPI.create(campaignData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCampaigns.push(createResponse.body.data)

        // Now filter by that status
        campaignAPI.getAll({ status: testStatus }).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned campaigns should have the specified status
          response.body.data.forEach((campaign: any) => {
            expect(campaign.status).to.eq(testStatus)
          })

          cy.log(`Found ${response.body.data.length} campaigns with status '${testStatus}'`)
        })
      })
    })

    it('CAMP_API_005: Should search campaigns by name/description', () => {
      // Create a campaign with a unique searchable term
      const uniqueTerm = `SearchCampaign${Date.now()}`
      const campaignData = campaignAPI.generateRandomData({
        name: `${uniqueTerm} Campaign`,
        description: `Campaign with searchable term ${uniqueTerm}`
      })

      campaignAPI.create(campaignData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCampaigns.push(createResponse.body.data)

        // Search for the unique term
        campaignAPI.getAll({ search: uniqueTerm }).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found campaign contains our search term
          const foundCampaign = response.body.data.find(
            (c: any) => c.id === createResponse.body.data.id
          )
          expect(foundCampaign).to.exist
          expect(foundCampaign.name + foundCampaign.description).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} campaigns matching '${uniqueTerm}'`)
        })
      })
    })

    it('CAMP_API_006: Should return empty array for non-matching search', () => {
      const nonExistentTerm = 'NonExistentCampaignSearchTerm123456789'

      campaignAPI.getAll({ search: nonExistentTerm }).then((response: any) => {
        campaignAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.eq(0)

        cy.log('Search with non-matching term returns empty array')
      })
    })

    it('CAMP_API_007: Should reject request without API key', () => {
      const noAuthAPI = new CampaignAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })

    it('CAMP_API_008: Should reject request without x-team-id', () => {
      const noTeamAPI = new CampaignAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/campaigns - Create Campaign
  // ============================================
  describe('POST /api/v1/campaigns - Create Campaign', () => {
    it('CAMP_API_010: Should create campaign with valid data', () => {
      const campaignData = campaignAPI.generateRandomData({
        name: 'Q4 Launch Campaign',
        type: 'email',
        status: 'planned',
        budget: 50000,
        expectedRevenue: 250000,
        description: 'Major product launch campaign'
      })

      campaignAPI.create(campaignData).then((response: any) => {
        campaignAPI.validateSuccessResponse(response, 201)
        createdCampaigns.push(response.body.data)

        const campaign = response.body.data
        campaignAPI.validateObject(campaign)

        // Verify provided data
        expect(campaign.name).to.eq(campaignData.name)
        expect(campaign.type).to.eq(campaignData.type)
        expect(campaign.status).to.eq(campaignData.status)
        expect(campaign.budget).to.satisfy((val: any) =>
          typeof val === 'number' ? val === campaignData.budget : parseFloat(val) === campaignData.budget
        )
        expect(campaign.description).to.eq(campaignData.description)

        cy.log(`Created campaign: ${campaign.name} (ID: ${campaign.id})`)
      })
    })

    it('CAMP_API_011: Should create campaign with minimal data (name and required dates)', () => {
      // Note: campaigns require name, startDate, and endDate as required fields
      const minimalData = {
        name: `Minimal Campaign ${Date.now()}`,
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      }

      campaignAPI.create(minimalData).then((response: any) => {
        campaignAPI.validateSuccessResponse(response, 201)
        createdCampaigns.push(response.body.data)

        const campaign = response.body.data
        campaignAPI.validateObject(campaign)

        // Verify required fields
        expect(campaign.name).to.eq(minimalData.name)
        // Dates are returned as ISO strings
        expect(campaign.startDate).to.include('2025-01-01')
        expect(campaign.endDate).to.include('2025-01-31')

        cy.log(`Created campaign with minimal data: ${campaign.id}`)
      })
    })

    it('CAMP_API_012: Should create campaign with all optional fields', () => {
      const campaignData = campaignAPI.generateRandomData({
        name: `Complete Campaign ${Date.now()}`,
        type: 'webinar',
        status: 'active',
        startDate: '2025-01-15',
        endDate: '2025-03-31',
        budget: 75000,
        actualCost: 50000,
        expectedRevenue: 500000,
        description: 'Campaign with all fields populated'
      })

      campaignAPI.create(campaignData).then((response: any) => {
        campaignAPI.validateSuccessResponse(response, 201)
        createdCampaigns.push(response.body.data)

        const campaign = response.body.data

        // Verify all fields
        expect(campaign.name).to.eq(campaignData.name)
        expect(campaign.type).to.eq(campaignData.type)
        expect(campaign.status).to.eq(campaignData.status)
        // Dates are returned as ISO strings, use include() for partial match
        expect(campaign.startDate).to.include('2025-01-15')
        expect(campaign.endDate).to.include('2025-03-31')
        expect(campaign.description).to.eq(campaignData.description)

        cy.log(`Created campaign with all fields: ${campaign.id}`)
      })
    })

    it('CAMP_API_013: Should reject creation without name', () => {
      const invalidData = {
        type: 'email',
        status: 'planned'
        // Missing: name
      }

      campaignAPI.create(invalidData).then((response: any) => {
        campaignAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without name rejected with VALIDATION_ERROR')
      })
    })

    it('CAMP_API_014: Should reject creation without type', () => {
      const invalidData = {
        name: 'No Type Campaign',
        status: 'planned'
        // Missing: type
      }

      campaignAPI.create(invalidData).then((response: any) => {
        campaignAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without type rejected with VALIDATION_ERROR')
      })
    })

    it('CAMP_API_015: Should reject creation without status', () => {
      const invalidData = {
        name: 'No Status Campaign',
        type: 'email'
        // Missing: status
      }

      campaignAPI.create(invalidData).then((response: any) => {
        campaignAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without status rejected with VALIDATION_ERROR')
      })
    })
  })

  // ============================================
  // GET /api/v1/campaigns/{id} - Get Campaign by ID
  // ============================================
  describe('GET /api/v1/campaigns/{id} - Get Campaign by ID', () => {
    it('CAMP_API_020: Should get campaign by valid ID', () => {
      // First create a campaign
      const campaignData = campaignAPI.generateRandomData()

      campaignAPI.create(campaignData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdCampaigns.push(createResponse.body.data)

        const campaignId = createResponse.body.data.id

        // Get the campaign by ID
        campaignAPI.getById(campaignId).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)

          const campaign = response.body.data
          campaignAPI.validateObject(campaign)
          expect(campaign.id).to.eq(campaignId)
          expect(campaign.name).to.eq(campaignData.name)
          expect(campaign.type).to.eq(campaignData.type)

          cy.log(`Retrieved campaign: ${campaign.name}`)
        })
      })
    })

    it('CAMP_API_021: Should return 404 for non-existent campaign', () => {
      const fakeId = 'non-existent-campaign-id-12345'

      campaignAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent campaign returns 404')
      })
    })
  })

  // ============================================
  // PATCH /api/v1/campaigns/{id} - Update Campaign
  // ============================================
  describe('PATCH /api/v1/campaigns/{id} - Update Campaign', () => {
    it('CAMP_API_030: Should update campaign with multiple fields', () => {
      // First create a campaign
      campaignAPI.createTestRecord().then((testCampaign: any) => {
        createdCampaigns.push(testCampaign)

        const updateData = {
          name: 'Updated Campaign Name',
          type: 'event',
          status: 'active',
          budget: 100000,
          description: 'Updated campaign description'
        }

        campaignAPI.update(testCampaign.id, updateData).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)

          const campaign = response.body.data
          expect(campaign.name).to.eq(updateData.name)
          expect(campaign.type).to.eq(updateData.type)
          expect(campaign.status).to.eq(updateData.status)
          expect(campaign.description).to.eq(updateData.description)

          cy.log(`Updated campaign: ${campaign.name}`)
        })
      })
    })

    it('CAMP_API_031: Should update campaign status', () => {
      campaignAPI.createTestRecord().then((testCampaign: any) => {
        createdCampaigns.push(testCampaign)

        const newStatus = 'completed'

        campaignAPI.update(testCampaign.id, { status: newStatus }).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq(newStatus)

          cy.log(`Updated status to: ${newStatus}`)
        })
      })
    })

    it('CAMP_API_032: Should update campaign budget and revenue', () => {
      campaignAPI.createTestRecord().then((testCampaign: any) => {
        createdCampaigns.push(testCampaign)

        const updateData = {
          budget: 150000,
          actualCost: 125000,
          expectedRevenue: 750000
        }

        campaignAPI.update(testCampaign.id, updateData).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)
          const campaign = response.body.data

          // Handle numeric fields that might be returned as strings or numbers
          expect(campaign.budget).to.satisfy((val: any) =>
            typeof val === 'number' ? val === updateData.budget : parseFloat(val) === updateData.budget
          )

          cy.log(`Updated budget and revenue`)
        })
      })
    })

    it('CAMP_API_033: Should update campaign dates', () => {
      campaignAPI.createTestRecord().then((testCampaign: any) => {
        createdCampaigns.push(testCampaign)

        const updateData = {
          startDate: '2025-02-01',
          endDate: '2025-04-30'
        }

        campaignAPI.update(testCampaign.id, updateData).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)
          // Dates are returned as ISO strings, use include() for partial match
          expect(response.body.data.startDate).to.include('2025-02-01')
          expect(response.body.data.endDate).to.include('2025-04-30')

          cy.log(`Updated campaign dates`)
        })
      })
    })

    it('CAMP_API_034: Should return 404 for non-existent campaign', () => {
      const fakeId = 'non-existent-campaign-id-12345'

      campaignAPI.update(fakeId, { name: 'New Name' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent campaign returns 404')
      })
    })
  })

  // ============================================
  // DELETE /api/v1/campaigns/{id} - Delete Campaign
  // ============================================
  describe('DELETE /api/v1/campaigns/{id} - Delete Campaign', () => {
    it('CAMP_API_040: Should delete campaign by valid ID', () => {
      // Create a campaign to delete
      const campaignData = campaignAPI.generateRandomData()

      campaignAPI.create(campaignData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const campaignId = createResponse.body.data.id

        // Delete the campaign
        campaignAPI.delete(campaignId).then((response: any) => {
          campaignAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', campaignId)

          cy.log(`Deleted campaign: ${campaignId}`)
        })
      })
    })

    it('CAMP_API_041: Should return 404 for non-existent campaign', () => {
      const fakeId = 'non-existent-campaign-id-12345'

      campaignAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent campaign returns 404')
      })
    })

    it('CAMP_API_042: Should verify deletion persists', () => {
      // Create a campaign
      const campaignData = campaignAPI.generateRandomData()

      campaignAPI.create(campaignData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const campaignId = createResponse.body.data.id

        // Delete it
        campaignAPI.delete(campaignId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          campaignAPI.getById(campaignId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body).to.have.property('success', false)

            cy.log('Deletion verified - campaign no longer exists')
          })
        })
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('CAMP_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE
      const campaignData = campaignAPI.generateRandomData({
        name: 'Lifecycle Test Campaign',
        type: 'email',
        status: 'planned',
        budget: 50000,
        expectedRevenue: 250000,
        description: 'Initial campaign for lifecycle testing'
      })

      campaignAPI.create(campaignData).then((createResponse: any) => {
        campaignAPI.validateSuccessResponse(createResponse, 201)
        const campaignId = createResponse.body.data.id

        cy.log(`1. Created campaign: ${campaignId}`)

        // 2. READ
        campaignAPI.getById(campaignId).then((readResponse: any) => {
          campaignAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.name).to.eq(campaignData.name)
          expect(readResponse.body.data.type).to.eq(campaignData.type)

          cy.log(`2. Read campaign: ${readResponse.body.data.name}`)

          // 3. UPDATE
          const updateData = {
            name: 'Updated Lifecycle Campaign',
            type: 'webinar',
            status: 'active',
            budget: 100000,
            actualCost: 75000,
            expectedRevenue: 500000,
            description: 'Updated campaign description'
          }

          campaignAPI.update(campaignId, updateData).then((updateResponse: any) => {
            campaignAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.name).to.eq(updateData.name)
            expect(updateResponse.body.data.type).to.eq(updateData.type)
            expect(updateResponse.body.data.status).to.eq(updateData.status)

            cy.log(`3. Updated campaign: ${updateResponse.body.data.name}`)

            // 4. DELETE
            campaignAPI.delete(campaignId).then((deleteResponse: any) => {
              campaignAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted campaign: ${campaignId}`)

              // 5. VERIFY DELETION
              campaignAPI.getById(campaignId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - campaign no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
