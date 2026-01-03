// @ts-nocheck
/// <reference types="cypress" />

/**
 * Tasks API - CRUD Tests
 *
 * EXAMPLE FILE - This demonstrates how to write API CRUD tests for an entity.
 * Copy and adapt this file for your own entities.
 *
 * Basic CRUD operations for /api/v1/tasks endpoints
 * Uses superadmin API key for full access with team context
 *
 * Location: _examples/tasks/tasks-crud.cy.ts
 */

import * as allure from 'allure-cypress'

// In real tests, import from src/controllers/
// const TaskAPIController = require('../../src/controllers/TaskAPIController.js')
const TaskAPIController = require('./TaskAPIController.js')

describe('Tasks API - CRUD Operations', () => {
  let taskAPI: any
  let createdTasks: any[] = []

  // Superadmin API key for testing
  // NOTE: Replace with your own test API key
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    // Initialize API controller with superadmin API key and team context
    taskAPI = new TaskAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    cy.log('TaskAPIController initialized')
    cy.log(`Base URL: ${BASE_URL}`)
    cy.log(`Team ID: ${TEAM_ID}`)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Tasks')
  })

  afterEach(() => {
    // Cleanup: Delete tasks created during tests
    if (createdTasks.length > 0) {
      createdTasks.forEach((task: any) => {
        if (task && task.id) {
          taskAPI.deleteTask(task.id)
        }
      })
      createdTasks = []
    }
  })

  // ============================================================
  // GET /api/v1/tasks - List Tasks
  // ============================================================
  describe('GET /api/v1/tasks - List Tasks', () => {
    it('TASKS_API_001: Should list tasks with valid API key', () => {
      allure.story('CRUD Operations')
      allure.severity('critical')
      taskAPI.getTasks().then((response: any) => {
        taskAPI.validateSuccessResponse(response, 200)
        taskAPI.validatePaginatedResponse(response)
        expect(response.body.data).to.be.an('array')

        cy.log(`Found ${response.body.data.length} tasks`)
        cy.log(`Total tasks: ${response.body.info.total}`)
      })
    })

    it('TASKS_API_002: Should list tasks with pagination', () => {
      taskAPI.getTasks({ page: 1, limit: 5 }).then((response: any) => {
        taskAPI.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1, Limit 5: Got ${response.body.data.length} tasks`)
      })
    })

    it('TASKS_API_003: Should filter tasks by status', () => {
      // First create a task with known status
      const taskData = taskAPI.generateRandomTaskData({ status: 'done' })

      taskAPI.createTask(taskData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdTasks.push(createResponse.body.data)

        // Now filter by status
        taskAPI.getTasks({ status: 'done' }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)

          // All returned tasks should have status 'done'
          response.body.data.forEach((task: any) => {
            expect(task.status).to.eq('done')
          })

          cy.log(`Found ${response.body.data.length} tasks with status 'done'`)
        })
      })
    })

    it('TASKS_API_004: Should filter tasks by priority', () => {
      // First create a task with known priority
      const taskData = taskAPI.generateRandomTaskData({ priority: 'high' })

      taskAPI.createTask(taskData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdTasks.push(createResponse.body.data)

        // Now filter by priority
        taskAPI.getTasks({ priority: 'high' }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)

          // All returned tasks should have priority 'high'
          response.body.data.forEach((task: any) => {
            expect(task.priority).to.eq('high')
          })

          cy.log(`Found ${response.body.data.length} tasks with priority 'high'`)
        })
      })
    })

    it('TASKS_API_005: Should search tasks by title/description', () => {
      // Create a task with a unique searchable term
      const uniqueTerm = `SearchTest${Date.now()}`
      const taskData = taskAPI.generateRandomTaskData({
        title: `Task with ${uniqueTerm} in title`,
        description: 'Searchable task for testing'
      })

      taskAPI.createTask(taskData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdTasks.push(createResponse.body.data)

        // Search for the unique term
        taskAPI.getTasks({ search: uniqueTerm }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found task contains our search term
          const foundTask = response.body.data.find((t: any) => t.id === createResponse.body.data.id)
          expect(foundTask).to.exist
          expect(foundTask.title).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} tasks matching '${uniqueTerm}'`)
        })
      })
    })

    it('TASKS_API_006: Should return empty array for non-matching search', () => {
      const nonExistentTerm = 'NonExistentSearchTerm123456789'

      taskAPI.getTasks({ search: nonExistentTerm }).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.data.length).to.eq(0)

        cy.log('Search with non-matching term returns empty array')
      })
    })

    it('TASKS_API_007: Should reject request without API key', () => {
      const originalApiKey = taskAPI.apiKey
      taskAPI.setApiKey(null)

      taskAPI.getTasks().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
      })

      taskAPI.setApiKey(originalApiKey)
    })

    it('TASKS_API_008: Should reject request without x-team-id', () => {
      const originalTeamId = taskAPI.teamId
      taskAPI.setTeamId(null)

      taskAPI.getTasks().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.code).to.eq('TEAM_CONTEXT_REQUIRED')
      })

      taskAPI.setTeamId(originalTeamId)
    })
  })

  // ============================================================
  // POST /api/v1/tasks - Create Task
  // ============================================================
  describe('POST /api/v1/tasks - Create Task', () => {
    it('TASKS_API_010: Should create task with valid data', () => {
      allure.story('CRUD Operations')
      allure.severity('critical')
      const taskData = taskAPI.generateRandomTaskData({
        title: 'TestCreate - Full Task',
        description: 'A complete task with all fields',
        status: 'in-progress',
        priority: 'high',
        tags: ['testing', 'cypress'],
        dueDate: '2025-12-31',
        estimatedHours: 8.5
      })

      taskAPI.createTask(taskData).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 201)
        taskAPI.validateTaskObject(response.body.data)

        expect(response.body.data.title).to.eq(taskData.title)
        expect(response.body.data.description).to.eq(taskData.description)
        expect(response.body.data.status).to.eq(taskData.status)
        expect(response.body.data.priority).to.eq(taskData.priority)
        expect(response.body.data.tags).to.deep.eq(taskData.tags)

        // Save for cleanup
        createdTasks.push(response.body.data)

        cy.log(`Created task: ${response.body.data.title}`)
      })
    })

    it('TASKS_API_011: Should create task with minimal data and default values', () => {
      const taskData = {
        title: `Minimal Task ${Date.now()}`
      }

      taskAPI.createTask(taskData).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 201)
        taskAPI.validateTaskObject(response.body.data)

        // Verify default values
        expect(response.body.data.title).to.eq(taskData.title)
        expect(response.body.data.status).to.eq('todo')
        expect(response.body.data.priority).to.eq('medium')
        expect(response.body.data.completed).to.be.false
        expect(response.body.data.tags).to.deep.eq([])

        createdTasks.push(response.body.data)
        cy.log(`Created task with defaults: ${response.body.data.id}`)
      })
    })

    it('TASKS_API_012: Should create task with tags', () => {
      const taskData = taskAPI.generateRandomTaskData({
        tags: ['feature', 'priority', 'v2']
      })

      taskAPI.createTask(taskData).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 201)

        expect(response.body.data.tags).to.be.an('array')
        expect(response.body.data.tags).to.have.length(3)
        expect(response.body.data.tags).to.include('feature')
        expect(response.body.data.tags).to.include('priority')
        expect(response.body.data.tags).to.include('v2')

        createdTasks.push(response.body.data)
        cy.log(`Created task with tags: ${response.body.data.tags.join(', ')}`)
      })
    })

    it('TASKS_API_013: Should reject creation without title', () => {
      const taskData = {
        description: 'Task without title',
        status: 'todo'
      }

      taskAPI.createTask(taskData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
      })
    })

    it('TASKS_API_014: Should reject creation with invalid status', () => {
      const taskData = taskAPI.generateRandomTaskData({
        status: 'invalid-status'
      })

      taskAPI.createTask(taskData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
      })
    })

    it('TASKS_API_015: Should reject creation with invalid priority', () => {
      const taskData = taskAPI.generateRandomTaskData({
        priority: 'invalid-priority'
      })

      taskAPI.createTask(taskData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
      })
    })

    it('TASKS_API_016: Should reject creation without x-team-id', () => {
      const originalTeamId = taskAPI.teamId
      taskAPI.setTeamId(null)

      const taskData = taskAPI.generateRandomTaskData()

      taskAPI.createTask(taskData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.code).to.eq('TEAM_CONTEXT_REQUIRED')
      })

      taskAPI.setTeamId(originalTeamId)
    })
  })

  // ============================================================
  // GET /api/v1/tasks/{id} - Get Task by ID
  // ============================================================
  describe('GET /api/v1/tasks/{id} - Get Task by ID', () => {
    let testTask: any

    beforeEach(() => {
      // Create a test task for each test
      const taskData = taskAPI.generateRandomTaskData({
        title: 'TestGetById Task'
      })

      taskAPI.createTask(taskData).then((response: any) => {
        testTask = response.body.data
        createdTasks.push(testTask)
      })
    })

    it('TASKS_API_020: Should get task by valid ID', () => {
      cy.then(() => {
        taskAPI.getTaskById(testTask.id).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          taskAPI.validateTaskObject(response.body.data)

          expect(response.body.data.id).to.eq(testTask.id)
          expect(response.body.data.title).to.eq(testTask.title)

          cy.log(`Got task by ID: ${testTask.id}`)
        })
      })
    })

    it('TASKS_API_021: Should return 404 for non-existent task', () => {
      const nonExistentId = 'non-existent-task-id-12345'

      taskAPI.getTaskById(nonExistentId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })
    })

    it.skip('TASKS_API_022: Should reject access to other user\'s task', () => {
      /**
       * SKIPPED: This test cannot be completed with current setup
       *
       * Reason:
       * - Superadmin API key bypasses RLS (is_superadmin() function)
       * - Bug documented in pendings.md §1.1: API keys ignore team member roles
       * - Cannot create API key with 'member' role to test userId isolation
       *
       * When the bug is fixed:
       * - Create API key for member user in different team
       * - Attempt to access task created by superadmin
       * - Should return 404 (filtered by userId within team)
       */
      cy.log('SKIPPED: Cannot test user isolation - superadmin bypasses RLS')
    })
  })

  // ============================================================
  // PATCH /api/v1/tasks/{id} - Update Task
  // ============================================================
  describe('PATCH /api/v1/tasks/{id} - Update Task', () => {
    let testTask: any

    beforeEach(() => {
      // Create a test task for each test
      const taskData = taskAPI.generateRandomTaskData({
        title: 'TestUpdate Task',
        status: 'todo',
        priority: 'medium'
      })

      taskAPI.createTask(taskData).then((response: any) => {
        testTask = response.body.data
        createdTasks.push(testTask)
      })
    })

    it('TASKS_API_030: Should update task with valid data', () => {
      const updateData = {
        title: 'Updated Task Title',
        description: 'Updated description'
      }

      cy.then(() => {
        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          taskAPI.validateTaskObject(response.body.data)

          expect(response.body.data.title).to.eq(updateData.title)
          expect(response.body.data.description).to.eq(updateData.description)
          expect(response.body.data.id).to.eq(testTask.id)

          cy.log(`Updated task: ${testTask.id}`)
        })
      })
    })

    it('TASKS_API_031: Should update task status', () => {
      const updateData = {
        status: 'in-progress'
      }

      cy.then(() => {
        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.status).to.eq(updateData.status)

          cy.log(`Updated task status to: ${updateData.status}`)
        })
      })
    })

    it('TASKS_API_032: Should update task priority', () => {
      const updateData = {
        priority: 'urgent'
      }

      cy.then(() => {
        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.priority).to.eq(updateData.priority)

          cy.log(`Updated task priority to: ${updateData.priority}`)
        })
      })
    })

    it('TASKS_API_033: Should update task tags', () => {
      const updateData = {
        tags: ['updated', 'modified', 'test']
      }

      cy.then(() => {
        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.tags).to.deep.eq(updateData.tags)

          cy.log(`Updated task tags: ${updateData.tags.join(', ')}`)
        })
      })
    })

    it('TASKS_API_034: Should return 404 for non-existent task', () => {
      const nonExistentId = 'non-existent-task-id-12345'
      const updateData = { title: 'Updated' }

      taskAPI.updateTask(nonExistentId, updateData).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })
    })

    it('TASKS_API_035: Should reject empty update body', () => {
      cy.then(() => {
        taskAPI.updateTask(testTask.id, {}).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false
        })
      })
    })
  })

  // ============================================================
  // DELETE /api/v1/tasks/{id} - Delete Task
  // ============================================================
  describe('DELETE /api/v1/tasks/{id} - Delete Task', () => {
    let testTask: any

    beforeEach(() => {
      // Create a test task for each test
      const taskData = taskAPI.generateRandomTaskData({
        title: 'TestDelete Task'
      })

      taskAPI.createTask(taskData).then((response: any) => {
        testTask = response.body.data
        // Don't add to createdTasks - we'll delete manually
      })
    })

    it('TASKS_API_040: Should delete task by valid ID', () => {
      cy.then(() => {
        taskAPI.deleteTask(testTask.id).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          // Delete response has data.success and data.id
          expect(response.body.data.success).to.be.true
          expect(response.body.data.id).to.exist

          cy.log(`Deleted task: ${testTask.id}`)

          // Verify task was deleted
          taskAPI.getTaskById(testTask.id).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
          })
        })
      })
    })

    it('TASKS_API_041: Should return 404 for non-existent task', () => {
      const nonExistentId = 'non-existent-task-id-12345'

      taskAPI.deleteTask(nonExistentId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })

      // Add testTask to cleanup since we didn't delete it
      createdTasks.push(testTask)
    })

    it('TASKS_API_042: Should verify deletion persists', () => {
      cy.then(() => {
        // Delete the task
        taskAPI.deleteTask(testTask.id).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Immediate GET should return 404
          taskAPI.getTaskById(testTask.id).then((getResponse1: any) => {
            expect(getResponse1.status).to.eq(404)

            // Second GET should also return 404 (deletion persisted)
            taskAPI.getTaskById(testTask.id).then((getResponse2: any) => {
              expect(getResponse2.status).to.eq(404)
              cy.log('Verified deletion persists: task not found after multiple GET attempts')
            })
          })
        })
      })
    })
  })

  // ============================================================
  // Integration Test - Complete CRUD Lifecycle
  // ============================================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('TASKS_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Lifecycle Test Task',
        description: 'Testing complete CRUD cycle',
        status: 'todo',
        priority: 'medium'
      })

      // 1. CREATE
      taskAPI.createTask(taskData).then((createResponse: any) => {
        taskAPI.validateSuccessResponse(createResponse, 201)
        const createdTask = createResponse.body.data
        cy.log(`1. Created task: ${createdTask.id}`)

        // 2. READ
        taskAPI.getTaskById(createdTask.id).then((readResponse: any) => {
          taskAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.id).to.eq(createdTask.id)
          expect(readResponse.body.data.title).to.eq(taskData.title)
          cy.log(`2. Read task: ${createdTask.id}`)

          // 3. UPDATE
          const updateData = {
            title: 'Updated Lifecycle Task',
            status: 'in-progress',
            priority: 'high'
          }
          taskAPI.updateTask(createdTask.id, updateData).then((updateResponse: any) => {
            taskAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.title).to.eq(updateData.title)
            expect(updateResponse.body.data.status).to.eq(updateData.status)
            expect(updateResponse.body.data.priority).to.eq(updateData.priority)
            cy.log(`3. Updated task: ${updateData.title}`)

            // 4. DELETE
            taskAPI.deleteTask(createdTask.id).then((deleteResponse: any) => {
              taskAPI.validateSuccessResponse(deleteResponse, 200)
              // Delete response has data.success instead of data.deleted
              expect(deleteResponse.body.data.success).to.be.true
              cy.log(`4. Deleted task: ${createdTask.id}`)

              // 5. VERIFY DELETION
              taskAPI.getTaskById(createdTask.id).then((finalResponse: any) => {
                expect(finalResponse.status).to.eq(404)
                cy.log(`5. Verified deletion: task not found (404)`)
                cy.log('Full CRUD lifecycle completed successfully')
              })
            })
          })
        })
      })
    })
  })
})
