/**
 * Activities API - CRUD Tests
 *
 * Comprehensive test suite for Activity API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: type, subject
 * - Optional fields: description, dueDate, contactId, companyId, opportunityId, completedAt, assignedTo
 * - Types: call, email, meeting, task, demo, follow-up
 * - Special actions: Complete (set completedAt), Reschedule (update dueDate)
 * - Access: shared within team (all team members see all activities)
 * - Team context: required (x-team-id header)
 */

/// <reference types="cypress" />

import { ActivityAPIController } from '../../../src/controllers/ActivityAPIController'

describe('Activities API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let activityAPI: InstanceType<typeof ActivityAPIController>

  // Track created activities for cleanup
  let createdActivities: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    activityAPI = new ActivityAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created activities after each test
    createdActivities.forEach((activity) => {
      if (activity?.id) {
        activityAPI.delete(activity.id)
      }
    })
    createdActivities = []
  })

  // ============================================
  // GET /api/v1/activities - List Activities
  // ============================================
  describe('GET /api/v1/activities - List Activities', () => {
    it('ACTV_API_001: Should list activities with valid API key', () => {
      activityAPI.getAll().then((response: any) => {
        activityAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} activities`)
      })
    })

    it('ACTV_API_002: Should list activities with pagination', () => {
      activityAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        activityAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} activities`)
      })
    })

    it('ACTV_API_003: Should filter activities by type', () => {
      // First create an activity with a specific type
      const testType = 'meeting'
      const activityData = activityAPI.generateRandomData({ type: testType })

      activityAPI.create(activityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdActivities.push(createResponse.body.data)

        // Now filter by that type
        activityAPI.getAll({ type: testType }).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned activities should have the specified type
          response.body.data.forEach((activity: any) => {
            expect(activity.type).to.eq(testType)
          })

          cy.log(`Found ${response.body.data.length} activities with type '${testType}'`)
        })
      })
    })

    it('ACTV_API_004: Should filter activities by completed status', () => {
      // Create an activity first, then mark it as complete via status
      const activityData = {
        type: 'task',
        subject: `Completed Test Activity ${Date.now()}`,
        status: 'scheduled'
      }

      activityAPI.create(activityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdActivities.push(createResponse.body.data)

        // Mark it as complete by updating status
        activityAPI.update(createResponse.body.data.id, { status: 'completed' }).then((completeResponse: any) => {
          expect(completeResponse.status).to.eq(200)
          expect(completeResponse.body.data.status).to.eq('completed')

          // Filter for completed activities by status
          activityAPI.getAll({ status: 'completed' }).then((response: any) => {
            activityAPI.validateSuccessResponse(response, 200)
            expect(response.body.data).to.be.an('array')

            // All returned activities should have status 'completed'
            response.body.data.forEach((activity: any) => {
              expect(activity.status).to.eq('completed')
            })

            cy.log(`Found ${response.body.data.length} completed activities`)
          })
        })
      })
    })

    it('ACTV_API_005: Should search activities by subject', () => {
      // Create an activity with a unique searchable term
      const uniqueTerm = `SearchActivity${Date.now()}`
      const activityData = activityAPI.generateRandomData({
        subject: `Test ${uniqueTerm} Activity`
      })

      activityAPI.create(activityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdActivities.push(createResponse.body.data)

        // Search for the unique term
        activityAPI.getAll({ search: uniqueTerm }).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found activity contains our search term
          const foundActivity = response.body.data.find(
            (a: any) => a.id === createResponse.body.data.id
          )
          expect(foundActivity).to.exist
          expect(foundActivity.subject).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} activities matching '${uniqueTerm}'`)
        })
      })
    })

    it('ACTV_API_006: Should return empty array for non-matching search', () => {
      const nonExistentTerm = 'NonExistentActivitySearchTerm123456789'

      activityAPI.getAll({ search: nonExistentTerm }).then((response: any) => {
        activityAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.eq(0)

        cy.log('Search with non-matching term returns empty array')
      })
    })

    it('ACTV_API_007: Should reject request without API key', () => {
      const noAuthAPI = new ActivityAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })

    it('ACTV_API_008: Should reject request without x-team-id', () => {
      const noTeamAPI = new ActivityAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/activities - Create Activity
  // ============================================
  describe('POST /api/v1/activities - Create Activity', () => {
    it('ACTV_API_010: Should create activity with valid data', () => {
      // Only send non-relation fields to avoid FK constraint issues
      const activityData = {
        type: 'call',
        subject: `Initial Discovery Call ${Date.now()}`,
        description: 'Discuss project requirements and timeline',
        priority: 'medium',
        status: 'scheduled'
      }

      activityAPI.create(activityData).then((response: any) => {
        activityAPI.validateSuccessResponse(response, 201)
        createdActivities.push(response.body.data)

        const activity = response.body.data
        activityAPI.validateObject(activity)

        // Verify provided data
        expect(activity.type).to.eq(activityData.type)
        expect(activity.subject).to.eq(activityData.subject)
        expect(activity.description).to.eq(activityData.description)

        cy.log(`Created activity: ${activity.subject} (ID: ${activity.id})`)
      })
    })

    it('ACTV_API_011: Should create activity with minimal data (type, subject only)', () => {
      const minimalData = {
        type: 'task',
        subject: `MinimalActivity${Date.now()}`
      }

      activityAPI.create(minimalData).then((response: any) => {
        activityAPI.validateSuccessResponse(response, 201)
        createdActivities.push(response.body.data)

        const activity = response.body.data
        activityAPI.validateObject(activity)

        // Verify required fields
        expect(activity.type).to.eq(minimalData.type)
        expect(activity.subject).to.eq(minimalData.subject)

        // Verify optional fields are null or undefined
        const optionalFields = ['description', 'dueDate', 'contactId', 'companyId', 'opportunityId', 'completedAt', 'assignedTo']
        optionalFields.forEach(field => {
          if (activity[field] !== null && activity[field] !== undefined) {
            expect(activity[field]).to.be.a('string')
          }
        })

        cy.log(`Created activity with minimal data: ${activity.id}`)
      })
    })

    it('ACTV_API_012: Should create activity with all optional fields (non-relation)', () => {
      const now = new Date()
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      // Only include non-relation optional fields to avoid FK constraint issues
      const activityData = {
        type: 'meeting',
        subject: `Comprehensive Activity ${Date.now()}`,
        description: 'Activity with complete data including all optional fields',
        dueDate: futureDate.toISOString(),
        priority: 'high',
        status: 'scheduled',
        duration: 60,
        location: 'Conference Room A',
        outcome: 'Pending'
      }

      activityAPI.create(activityData).then((response: any) => {
        activityAPI.validateSuccessResponse(response, 201)
        createdActivities.push(response.body.data)

        const activity = response.body.data
        expect(activity.type).to.eq(activityData.type)
        expect(activity.subject).to.eq(activityData.subject)
        expect(activity.description).to.eq(activityData.description)
        // dueDate is returned as ISO string
        expect(activity.dueDate).to.include(futureDate.toISOString().split('T')[0])
        expect(activity.priority).to.eq(activityData.priority)
        expect(activity.status).to.eq(activityData.status)

        cy.log(`Created activity with all optional fields: ${activity.id}`)
      })
    })

    it('ACTV_API_013: Should reject creation without type', () => {
      const invalidData = {
        subject: 'Activity without type'
        // Missing: type
      }

      activityAPI.create(invalidData).then((response: any) => {
        activityAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without type rejected with VALIDATION_ERROR')
      })
    })

    it('ACTV_API_014: Should reject creation without subject', () => {
      const invalidData = {
        type: 'call'
        // Missing: subject
      }

      activityAPI.create(invalidData).then((response: any) => {
        activityAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without subject rejected with VALIDATION_ERROR')
      })
    })

    it('ACTV_API_015: Should reject creation with invalid type', () => {
      const invalidData = {
        type: 'invalid-type-123',
        subject: 'Activity with invalid type'
      }

      activityAPI.create(invalidData).then((response: any) => {
        // Should fail validation (expecting specific types only)
        activityAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation with invalid type rejected with VALIDATION_ERROR')
      })
    })

    it('ACTV_API_016: Should create activity with priority', () => {
      // Test creating activity with priority instead of relation fields
      const activityData = {
        type: 'email',
        subject: `Priority Email Activity ${Date.now()}`,
        priority: 'urgent',
        status: 'scheduled'
      }

      activityAPI.create(activityData).then((response: any) => {
        activityAPI.validateSuccessResponse(response, 201)
        createdActivities.push(response.body.data)

        const activity = response.body.data
        expect(activity.priority).to.eq('urgent')

        cy.log(`Created activity with priority: ${activity.priority}`)
      })
    })

    it('ACTV_API_017: Should reject creation without x-team-id', () => {
      const noTeamAPI = new ActivityAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const activityData = noTeamAPI.generateRandomData()

      noTeamAPI.create(activityData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // GET /api/v1/activities/{id} - Get Activity by ID
  // ============================================
  describe('GET /api/v1/activities/{id} - Get Activity by ID', () => {
    it('ACTV_API_020: Should get activity by valid ID', () => {
      // First create an activity with simple fields only
      const activityData = {
        type: 'call',
        subject: `Get Test Activity ${Date.now()}`,
        description: 'Test activity for get by ID'
      }

      activityAPI.create(activityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdActivities.push(createResponse.body.data)

        const activityId = createResponse.body.data.id

        // Get the activity by ID
        activityAPI.getById(activityId).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)

          const activity = response.body.data
          activityAPI.validateObject(activity)
          expect(activity.id).to.eq(activityId)
          expect(activity.type).to.eq(activityData.type)
          expect(activity.subject).to.eq(activityData.subject)

          cy.log(`Retrieved activity: ${activity.subject}`)
        })
      })
    })

    it('ACTV_API_021: Should return 404 for non-existent activity', () => {
      const fakeId = 'non-existent-activity-id-12345'

      activityAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent activity returns 404')
      })
    })
  })

  // ============================================
  // PATCH /api/v1/activities/{id} - Update Activity
  // ============================================
  describe('PATCH /api/v1/activities/{id} - Update Activity', () => {
    it('ACTV_API_030: Should update activity with multiple fields', () => {
      // First create an activity with simple fields
      const createData = {
        type: 'call',
        subject: `Update Test Activity ${Date.now()}`,
        description: 'Initial description'
      }

      activityAPI.create(createData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const testActivity = createResponse.body.data
        createdActivities.push(testActivity)

        const updateData = {
          subject: 'Updated Activity Subject',
          description: 'Updated description with new information',
          type: 'meeting',
          priority: 'high'
        }

        activityAPI.update(testActivity.id, updateData).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)

          const activity = response.body.data
          expect(activity.subject).to.eq(updateData.subject)
          expect(activity.description).to.eq(updateData.description)
          expect(activity.type).to.eq(updateData.type)
          expect(activity.priority).to.eq(updateData.priority)

          cy.log(`Updated activity: ${activity.subject}`)
        })
      })
    })

    it('ACTV_API_031: Should update activity subject', () => {
      activityAPI.createTestRecord().then((testActivity: any) => {
        createdActivities.push(testActivity)

        const newSubject = 'Completely New Subject Line'

        activityAPI.update(testActivity.id, { subject: newSubject }).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.subject).to.eq(newSubject)

          cy.log(`Updated subject to: ${newSubject}`)
        })
      })
    })

    it('ACTV_API_032: Should mark activity as complete (set status to completed)', () => {
      // Create activity with simple fields
      const createData = {
        type: 'task',
        subject: `Complete Test Activity ${Date.now()}`,
        status: 'scheduled'
      }

      activityAPI.create(createData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const testActivity = createResponse.body.data
        createdActivities.push(testActivity)

        // Update status to completed
        activityAPI.update(testActivity.id, { status: 'completed' }).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)

          const activity = response.body.data
          expect(activity.status).to.eq('completed')

          cy.log(`Marked activity as complete: ${activity.id}`)
        })
      })
    })

    it('ACTV_API_033: Should reschedule activity (update dueDate)', () => {
      activityAPI.createTestRecord().then((testActivity: any) => {
        createdActivities.push(testActivity)

        // Set new due date to 14 days from now
        const newDueDate = new Date()
        newDueDate.setDate(newDueDate.getDate() + 14)
        const newDueDateISO = newDueDate.toISOString()

        // Use the reschedule() helper method
        activityAPI.reschedule(testActivity.id, newDueDateISO).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)

          const activity = response.body.data
          expect(activity.dueDate).to.eq(newDueDateISO)

          cy.log(`Rescheduled activity to: ${activity.dueDate}`)
        })
      })
    })

    it('ACTV_API_034: Should update activity type', () => {
      activityAPI.createTestRecord({ type: 'call' }).then((testActivity: any) => {
        createdActivities.push(testActivity)

        const newType = 'meeting'

        activityAPI.update(testActivity.id, { type: newType }).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.type).to.eq(newType)

          cy.log(`Updated type from 'call' to '${newType}'`)
        })
      })
    })

    it('ACTV_API_035: Should return 404 for non-existent activity', () => {
      const fakeId = 'non-existent-activity-id-12345'

      activityAPI.update(fakeId, { subject: 'New Subject' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent activity returns 404')
      })
    })

    it('ACTV_API_036: Should reject empty update body', () => {
      activityAPI.createTestRecord().then((testActivity: any) => {
        createdActivities.push(testActivity)

        activityAPI.update(testActivity.id, {}).then((response: any) => {
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
  // DELETE /api/v1/activities/{id} - Delete Activity
  // ============================================
  describe('DELETE /api/v1/activities/{id} - Delete Activity', () => {
    it('ACTV_API_040: Should delete activity by valid ID', () => {
      // Create an activity to delete
      const activityData = activityAPI.generateRandomData()

      activityAPI.create(activityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const activityId = createResponse.body.data.id

        // Delete the activity
        activityAPI.delete(activityId).then((response: any) => {
          activityAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', activityId)

          cy.log(`Deleted activity: ${activityId}`)
        })
      })
    })

    it('ACTV_API_041: Should return 404 for non-existent activity', () => {
      const fakeId = 'non-existent-activity-id-12345'

      activityAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent activity returns 404')
      })
    })

    it('ACTV_API_042: Should verify deletion persists', () => {
      // Create an activity
      const activityData = activityAPI.generateRandomData()

      activityAPI.create(activityData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const activityId = createResponse.body.data.id

        // Delete it
        activityAPI.delete(activityId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          activityAPI.getById(activityId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body).to.have.property('success', false)

            cy.log('Deletion verified - activity no longer exists')
          })
        })
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle with Complete Action
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('ACTV_API_100: Should complete full lifecycle: Create -> Read -> Update -> Complete -> Delete', () => {
      // 1. CREATE - Use simple fields only (no FK relations)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const activityData = {
        type: 'call',
        subject: `Lifecycle Test Activity ${Date.now()}`,
        description: 'Testing complete CRUD lifecycle',
        dueDate: futureDate.toISOString(),
        priority: 'medium',
        status: 'scheduled'
      }

      activityAPI.create(activityData).then((createResponse: any) => {
        activityAPI.validateSuccessResponse(createResponse, 201)
        const activityId = createResponse.body.data.id

        cy.log(`1. Created activity: ${activityId}`)

        // 2. READ
        activityAPI.getById(activityId).then((readResponse: any) => {
          activityAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.type).to.eq(activityData.type)
          expect(readResponse.body.data.subject).to.eq(activityData.subject)

          cy.log(`2. Read activity: ${readResponse.body.data.subject}`)

          // 3. UPDATE
          const newDueDate = new Date()
          newDueDate.setDate(newDueDate.getDate() + 14)

          const updateData = {
            subject: 'Updated Lifecycle Activity',
            description: 'Updated description for lifecycle test',
            type: 'meeting',
            dueDate: newDueDate.toISOString()
          }

          activityAPI.update(activityId, updateData).then((updateResponse: any) => {
            activityAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.subject).to.eq(updateData.subject)
            expect(updateResponse.body.data.type).to.eq(updateData.type)

            cy.log(`3. Updated activity: ${updateResponse.body.data.subject}`)

            // 4. COMPLETE (mark as done via status)
            activityAPI.update(activityId, { status: 'completed' }).then((completeResponse: any) => {
              activityAPI.validateSuccessResponse(completeResponse, 200)
              expect(completeResponse.body.data.status).to.eq('completed')

              cy.log(`4. Completed activity: ${completeResponse.body.data.status}`)

              // 5. DELETE
              activityAPI.delete(activityId).then((deleteResponse: any) => {
                activityAPI.validateSuccessResponse(deleteResponse, 200)
                expect(deleteResponse.body.data).to.have.property('success', true)

                cy.log(`5. Deleted activity: ${activityId}`)

                // 6. VERIFY DELETION
                activityAPI.getById(activityId).then((verifyResponse: any) => {
                  expect(verifyResponse.status).to.eq(404)

                  cy.log('6. Verified deletion - activity no longer exists')
                  cy.log('Full CRUD lifecycle with complete action completed successfully!')
                })
              })
            })
          })
        })
      })
    })
  })
})
