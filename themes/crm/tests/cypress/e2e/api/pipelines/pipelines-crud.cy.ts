/**
 * Pipelines API - CRUD Tests
 *
 * Comprehensive test suite for Pipeline API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: name
 * - Optional fields: type, description, rottenDays, isActive, isDefault, stages (array)
 * - Access: Only owner can create/update/delete (but all can read)
 * - Team context: required (x-team-id header)
 * - Special: Stages array with name, color, probability, order
 */

/// <reference types="cypress" />

import { PipelineAPIController } from '../../../src/controllers'

describe('Pipelines API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let pipelineAPI: InstanceType<typeof PipelineAPIController>

  // Track created pipelines for cleanup
  let createdPipelines: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    pipelineAPI = new PipelineAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created pipelines after each test
    createdPipelines.forEach((pipeline) => {
      if (pipeline?.id) {
        pipelineAPI.delete(pipeline.id)
      }
    })
    createdPipelines = []
  })

  // ============================================
  // GET /api/v1/pipelines - List Pipelines
  // ============================================
  describe('GET /api/v1/pipelines - List Pipelines', () => {
    it('PIPE_API_001: Should list pipelines with valid API key', () => {
      pipelineAPI.getAll().then((response: any) => {
        pipelineAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} pipelines`)
      })
    })

    it('PIPE_API_002: Should list pipelines with pagination', () => {
      pipelineAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        pipelineAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} pipelines`)
      })
    })

    it('PIPE_API_003: Should list pipelines including stages in response', () => {
      // First create a pipeline with stages
      const pipelineData = pipelineAPI.generateRandomData({
        name: `Pipeline with Stages ${Date.now()}`,
        stages: [
          { name: 'Qualification', probability: 10, order: 1 },
          { name: 'Proposal', probability: 50, order: 2 },
          { name: 'Closed Won', probability: 100, order: 3 }
        ]
      })

      pipelineAPI.create(pipelineData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdPipelines.push(createResponse.body.data)

        // Get all pipelines
        pipelineAPI.getAll().then((response: any) => {
          pipelineAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // Find our created pipeline
          const foundPipeline = response.body.data.find(
            (p: any) => p.id === createResponse.body.data.id
          )

          if (foundPipeline) {
            // Verify stages are included in list response
            expect(foundPipeline).to.have.property('stages')
            expect(foundPipeline.stages).to.be.an('array')
            expect(foundPipeline.stages.length).to.eq(3)

            cy.log(`Pipeline with ${foundPipeline.stages.length} stages found in list`)
          }
        })
      })
    })

    it('PIPE_API_004: Should reject request without x-team-id', () => {
      const noTeamAPI = new PipelineAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/pipelines - Create Pipeline
  // ============================================
  describe('POST /api/v1/pipelines - Create Pipeline', () => {
    it('PIPE_API_010: Should create pipeline with minimal data (name and stages)', () => {
      const minimalData = {
        name: `Minimal Pipeline ${Date.now()}`,
        stages: [
          { name: 'New', probability: 10, order: 1 },
          { name: 'Won', probability: 100, order: 2 }
        ]
      }

      pipelineAPI.create(minimalData).then((response: any) => {
        pipelineAPI.validateSuccessResponse(response, 201)
        createdPipelines.push(response.body.data)

        const pipeline = response.body.data
        pipelineAPI.validateObject(pipeline)

        // Verify required fields
        expect(pipeline.name).to.eq(minimalData.name)
        expect(pipeline.stages).to.be.an('array')

        // Verify optional fields have defaults or are null
        expect(pipeline.isActive).to.satisfy((val: any) =>
          val === true || val === null || val === undefined
        )
        expect(pipeline.isDefault).to.satisfy((val: any) =>
          val === false || val === null || val === undefined
        )

        cy.log(`Created pipeline with minimal data: ${pipeline.id}`)
      })
    })

    it('PIPE_API_011: Should create pipeline with stages array', () => {
      const pipelineData = {
        name: `Pipeline with Stages ${Date.now()}`,
        stages: [
          { name: 'Discovery', probability: 5, order: 1, color: '#3b82f6' },
          { name: 'Qualification', probability: 10, order: 2, color: '#8b5cf6' },
          { name: 'Needs Analysis', probability: 25, order: 3, color: '#ec4899' },
          { name: 'Proposal', probability: 50, order: 4, color: '#f59e0b' },
          { name: 'Negotiation', probability: 75, order: 5, color: '#10b981' },
          { name: 'Closed Won', probability: 100, order: 6, color: '#22c55e' }
        ]
      }

      pipelineAPI.create(pipelineData).then((response: any) => {
        pipelineAPI.validateSuccessResponse(response, 201)
        createdPipelines.push(response.body.data)

        const pipeline = response.body.data
        pipelineAPI.validateObject(pipeline)

        // Verify name
        expect(pipeline.name).to.eq(pipelineData.name)

        // Verify stages array
        expect(pipeline.stages).to.be.an('array')
        expect(pipeline.stages.length).to.eq(6)

        // Verify stage structure
        pipeline.stages.forEach((stage: any, index: number) => {
          expect(stage).to.have.property('name')
          expect(stage).to.have.property('probability')
          expect(stage).to.have.property('order')
          expect(stage.name).to.eq(pipelineData.stages[index].name)
          expect(stage.probability).to.eq(pipelineData.stages[index].probability)
          expect(stage.order).to.eq(pipelineData.stages[index].order)
        })

        cy.log(`Created pipeline with ${pipeline.stages.length} stages`)
      })
    })

    it('PIPE_API_012: Should reject creation without name', () => {
      const invalidData = {
        type: 'sales',
        description: 'Pipeline without name'
        // Missing: name
      }

      pipelineAPI.create(invalidData).then((response: any) => {
        pipelineAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without name rejected with VALIDATION_ERROR')
      })
    })

    it('PIPE_API_013: Should create pipeline with all optional fields', () => {
      const pipelineData = pipelineAPI.generateRandomData({
        name: `Complete Pipeline ${Date.now()}`,
        type: 'sales',
        description: 'Complete pipeline with all fields',
        dealRottenDays: 45,
        isActive: true,
        isDefault: false,
        stages: [
          { name: 'Lead', probability: 5, order: 1 },
          { name: 'Qualified', probability: 20, order: 2 },
          { name: 'Demo', probability: 40, order: 3 },
          { name: 'Proposal', probability: 60, order: 4 },
          { name: 'Closed Won', probability: 100, order: 5 }
        ]
      })

      pipelineAPI.create(pipelineData).then((response: any) => {
        pipelineAPI.validateSuccessResponse(response, 201)
        createdPipelines.push(response.body.data)

        const pipeline = response.body.data

        // Verify all fields
        expect(pipeline.name).to.eq(pipelineData.name)
        expect(pipeline.type).to.eq(pipelineData.type)
        expect(pipeline.description).to.eq(pipelineData.description)

        // dealRottenDays may be returned as number or string
        expect(String(pipeline.dealRottenDays)).to.eq(String(pipelineData.dealRottenDays))

        expect(pipeline.isActive).to.eq(pipelineData.isActive)
        expect(pipeline.isDefault).to.eq(pipelineData.isDefault)
        expect(pipeline.stages).to.be.an('array')
        expect(pipeline.stages.length).to.eq(5)

        cy.log(`Created pipeline with all fields: ${pipeline.id}`)
      })
    })

    it('PIPE_API_014: Should reject creation without x-team-id', () => {
      const noTeamAPI = new PipelineAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const pipelineData = noTeamAPI.generateRandomData()

      noTeamAPI.create(pipelineData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // GET /api/v1/pipelines/{id} - Get Pipeline by ID
  // ============================================
  describe('GET /api/v1/pipelines/{id} - Get Pipeline by ID', () => {
    it('PIPE_API_020: Should get pipeline by valid ID', () => {
      // First create a pipeline
      const pipelineData = pipelineAPI.generateRandomData()

      pipelineAPI.create(pipelineData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdPipelines.push(createResponse.body.data)

        const pipelineId = createResponse.body.data.id

        // Get the pipeline by ID
        pipelineAPI.getById(pipelineId).then((response: any) => {
          pipelineAPI.validateSuccessResponse(response, 200)

          const pipeline = response.body.data
          pipelineAPI.validateObject(pipeline)
          expect(pipeline.id).to.eq(pipelineId)
          expect(pipeline.name).to.eq(pipelineData.name)

          // Verify stages are included
          if (pipelineData.stages) {
            expect(pipeline.stages).to.be.an('array')
            expect(pipeline.stages.length).to.eq(pipelineData.stages.length)
          }

          cy.log(`Retrieved pipeline: ${pipeline.name}`)
        })
      })
    })

    it('PIPE_API_021: Should return 404 for non-existent pipeline', () => {
      const fakeId = 'non-existent-pipeline-id-12345'

      pipelineAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent pipeline returns 404')
      })
    })
  })

  // ============================================
  // PATCH /api/v1/pipelines/{id} - Update Pipeline
  // ============================================
  describe('PATCH /api/v1/pipelines/{id} - Update Pipeline', () => {
    it('PIPE_API_030: Should update pipeline name', () => {
      pipelineAPI.createTestRecord().then((testPipeline: any) => {
        createdPipelines.push(testPipeline)

        const newName = 'Updated Pipeline Name'

        pipelineAPI.update(testPipeline.id, { name: newName }).then((response: any) => {
          pipelineAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.name).to.eq(newName)

          cy.log(`Updated name to: ${newName}`)
        })
      })
    })

    it('PIPE_API_031: Should update pipeline stages array (add stage)', () => {
      // Create pipeline with initial stages
      const initialStages = [
        { name: 'Stage 1', probability: 25, order: 1 },
        { name: 'Stage 2', probability: 50, order: 2 },
        { name: 'Stage 3', probability: 100, order: 3 }
      ]

      pipelineAPI.createTestRecord({ stages: initialStages }).then((testPipeline: any) => {
        createdPipelines.push(testPipeline)

        // Add a new stage
        const updatedStages = [
          ...initialStages,
          { name: 'Stage 4', probability: 75, order: 4 }
        ]

        pipelineAPI.update(testPipeline.id, { stages: updatedStages }).then((response: any) => {
          pipelineAPI.validateSuccessResponse(response, 200)

          const pipeline = response.body.data
          expect(pipeline.stages).to.be.an('array')
          expect(pipeline.stages.length).to.eq(4)

          // Verify new stage was added
          const newStage = pipeline.stages.find((s: any) => s.name === 'Stage 4')
          expect(newStage).to.exist
          expect(newStage.probability).to.eq(75)
          expect(newStage.order).to.eq(4)

          cy.log(`Updated stages array - now has ${pipeline.stages.length} stages`)
        })
      })
    })

    it('PIPE_API_032: Should update pipeline isDefault (set as default)', () => {
      pipelineAPI.createTestRecord({ isDefault: false }).then((testPipeline: any) => {
        createdPipelines.push(testPipeline)

        // Set as default
        pipelineAPI.update(testPipeline.id, { isDefault: true }).then((response: any) => {
          pipelineAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.isDefault).to.eq(true)

          cy.log(`Set pipeline as default`)
        })
      })
    })

    it('PIPE_API_033: Should update pipeline dealRottenDays', () => {
      pipelineAPI.createTestRecord({ dealRottenDays: 30 }).then((testPipeline: any) => {
        createdPipelines.push(testPipeline)

        const newDealRottenDays = 60

        pipelineAPI.update(testPipeline.id, { dealRottenDays: newDealRottenDays }).then((response: any) => {
          pipelineAPI.validateSuccessResponse(response, 200)

          // dealRottenDays may be returned as number or string
          expect(String(response.body.data.dealRottenDays)).to.eq(String(newDealRottenDays))

          cy.log(`Updated dealRottenDays to: ${newDealRottenDays}`)
        })
      })
    })

    it('PIPE_API_034: Should return 404 for non-existent pipeline', () => {
      const fakeId = 'non-existent-pipeline-id-12345'

      pipelineAPI.update(fakeId, { name: 'New Name' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent pipeline returns 404')
      })
    })

    it('PIPE_API_035: Should reject empty update body', () => {
      pipelineAPI.createTestRecord().then((testPipeline: any) => {
        createdPipelines.push(testPipeline)

        pipelineAPI.update(testPipeline.id, {}).then((response: any) => {
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
  // DELETE /api/v1/pipelines/{id} - Delete Pipeline
  // ============================================
  describe('DELETE /api/v1/pipelines/{id} - Delete Pipeline', () => {
    it('PIPE_API_040: Should delete pipeline by valid ID', () => {
      // Create a pipeline to delete
      const pipelineData = pipelineAPI.generateRandomData()

      pipelineAPI.create(pipelineData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const pipelineId = createResponse.body.data.id

        // Delete the pipeline
        pipelineAPI.delete(pipelineId).then((response: any) => {
          pipelineAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', pipelineId)

          cy.log(`Deleted pipeline: ${pipelineId}`)
        })
      })
    })

    it('PIPE_API_041: Should return 404 for non-existent pipeline', () => {
      const fakeId = 'non-existent-pipeline-id-12345'

      pipelineAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent pipeline returns 404')
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('PIPE_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE
      const pipelineData = pipelineAPI.generateRandomData({
        name: 'Lifecycle Test Pipeline',
        type: 'sales',
        description: 'Initial pipeline for lifecycle testing',
        dealRottenDays: 30,
        isActive: true,
        isDefault: false,
        stages: [
          { name: 'Lead', probability: 5, order: 1, color: '#3b82f6' },
          { name: 'Qualified', probability: 20, order: 2, color: '#8b5cf6' },
          { name: 'Demo', probability: 40, order: 3, color: '#ec4899' },
          { name: 'Proposal', probability: 60, order: 4, color: '#f59e0b' },
          { name: 'Closed Won', probability: 100, order: 5, color: '#22c55e' }
        ]
      })

      pipelineAPI.create(pipelineData).then((createResponse: any) => {
        pipelineAPI.validateSuccessResponse(createResponse, 201)
        const pipelineId = createResponse.body.data.id

        cy.log(`1. Created pipeline: ${pipelineId}`)

        // 2. READ
        pipelineAPI.getById(pipelineId).then((readResponse: any) => {
          pipelineAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.name).to.eq(pipelineData.name)
          expect(readResponse.body.data.type).to.eq(pipelineData.type)
          expect(readResponse.body.data.stages.length).to.eq(5)

          cy.log(`2. Read pipeline: ${readResponse.body.data.name}`)

          // 3. UPDATE
          const updateData = {
            name: 'Updated Lifecycle Pipeline',
            description: 'Updated pipeline description',
            dealRottenDays: 60,
            isDefault: true,
            stages: [
              { name: 'Discovery', probability: 10, order: 1, color: '#3b82f6' },
              { name: 'Qualification', probability: 25, order: 2, color: '#8b5cf6' },
              { name: 'Needs Analysis', probability: 40, order: 3, color: '#ec4899' },
              { name: 'Proposal', probability: 60, order: 4, color: '#f59e0b' },
              { name: 'Negotiation', probability: 80, order: 5, color: '#10b981' },
              { name: 'Closed Won', probability: 100, order: 6, color: '#22c55e' }
            ]
          }

          pipelineAPI.update(pipelineId, updateData).then((updateResponse: any) => {
            pipelineAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.name).to.eq(updateData.name)
            expect(updateResponse.body.data.description).to.eq(updateData.description)
            expect(String(updateResponse.body.data.dealRottenDays)).to.eq(String(updateData.dealRottenDays))
            expect(updateResponse.body.data.isDefault).to.eq(updateData.isDefault)
            expect(updateResponse.body.data.stages.length).to.eq(6)

            cy.log(`3. Updated pipeline: ${updateResponse.body.data.name} (${updateResponse.body.data.stages.length} stages)`)

            // 4. DELETE
            pipelineAPI.delete(pipelineId).then((deleteResponse: any) => {
              pipelineAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted pipeline: ${pipelineId}`)

              // 5. VERIFY DELETION
              pipelineAPI.getById(pipelineId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - pipeline no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
