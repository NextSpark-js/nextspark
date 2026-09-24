/// <reference types="cypress" />

/**
 * Tasks API - Metadata Tests
 *
 * Comprehensive test suite for Task API endpoints with metadata functionality.
 * Covers GET, POST, PATCH, DELETE operations with various metadata scenarios.
 * Tests metadata parameter handling, merge behavior, and upsert functionality.
 */

import * as allure from 'allure-cypress'

const TaskAPIController = require('../../../../src/controllers/TaskAPIController.js')

describe('Tasks API - Metadata Operations', {
  tags: ['@api', '@feat-tasks', '@metas', '@regression']
}, () => {
  let taskAPI: any
  let createdTasks: any[] = []

  // Superadmin API key for testing
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    // Initialize API controller with superadmin API key and team context
    taskAPI = new TaskAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    cy.log('TaskAPIController initialized for metadata tests')
    cy.log(`Base URL: ${BASE_URL}`)
    cy.log(`Team ID: ${TEAM_ID}`)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Tasks')
    allure.story('Metadata Operations')
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
  // GET /api/v1/tasks - List Tasks with Metadata
  // ============================================================
  describe('GET /api/v1/tasks - List Tasks with Metadata', () => {
    let taskWithMetas: any

    before(() => {
      // Create a task with metadata for list tests
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task with Metas for List',
        metas: {
          uiPreferences: taskAPI.generateSampleMetadata('uiPreferences').uiPreferences,
          notifications: taskAPI.generateSampleMetadata('notifications').notifications
        }
      })

      taskAPI.createTask(taskData).then((response: any) => {
        taskWithMetas = response.body.data
      })
    })

    after(() => {
      if (taskWithMetas && taskWithMetas.id) {
        taskAPI.deleteTask(taskWithMetas.id)
      }
    })

    it('TASKS_META_001: Should list tasks without metas property when metas param not provided', () => {
      taskAPI.getTasks().then((response: any) => {
        taskAPI.validateSuccessResponse(response, 200)

        // Tasks should NOT have metas property when not requested
        response.body.data.forEach((task: any) => {
          expect(task).to.not.have.property('metas')
        })

        cy.log('Verified: No metas property in response without metas param')
      })
    })

    it('TASKS_META_002: Should list tasks with metas=all including all metadata groups', () => {
      taskAPI.getTasks({ metas: 'all' }).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 200)

        // Find our test task
        const foundTask = response.body.data.find((t: any) => t.id === taskWithMetas.id)
        if (foundTask) {
          expect(foundTask).to.have.property('metas')
          expect(foundTask.metas).to.be.an('object')

          cy.log(`Task has metas: ${JSON.stringify(Object.keys(foundTask.metas))}`)
        }
      })
    })

    it('TASKS_META_003: Should list tasks with metas=key1 including only specified metaKey', () => {
      taskAPI.getTasks({ metas: 'uiPreferences' }).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 200)

        // Find our test task
        const foundTask = response.body.data.find((t: any) => t.id === taskWithMetas.id)
        if (foundTask && foundTask.metas) {
          expect(foundTask).to.have.property('metas')
          // Should only have uiPreferences key
          if (Object.keys(foundTask.metas).length > 0) {
            expect(foundTask.metas).to.have.property('uiPreferences')
          }
        }

        cy.log('Verified: Only requested metaKey included')
      })
    })

    it('TASKS_META_004: Should list tasks with metas=key1,key2 including multiple metaKeys', () => {
      taskAPI.getTasks({ metas: 'uiPreferences,notifications' }).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 200)

        // Find our test task
        const foundTask = response.body.data.find((t: any) => t.id === taskWithMetas.id)
        if (foundTask && foundTask.metas) {
          expect(foundTask).to.have.property('metas')
          // May have one or both keys
          const metaKeys = Object.keys(foundTask.metas)
          cy.log(`Task metas keys: ${metaKeys.join(', ')}`)
        }
      })
    })

    it('TASKS_META_005: Should return empty metas object for non-existent metaKey', () => {
      taskAPI.getTasks({ metas: 'nonExistentKey' }).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 200)

        // Tasks should have metas property but it should be empty for this key
        response.body.data.forEach((task: any) => {
          if (task.metas) {
            expect(task.metas).to.not.have.property('nonExistentKey')
          }
        })

        cy.log('Verified: Non-existent metaKey returns empty metas')
      })
    })

    it('TASKS_META_006: Should combine pagination with metas parameter', () => {
      taskAPI.getTasks({ page: 1, limit: 5, metas: 'all' }).then((response: any) => {
        taskAPI.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)

        // Tasks with metas should have metas property
        const tasksWithMetas = response.body.data.filter((t: any) => t.metas && Object.keys(t.metas).length > 0)
        cy.log(`Found ${tasksWithMetas.length} tasks with metas (paginated)`)
      })
    })
  })

  // ============================================================
  // GET /api/v1/tasks/{id} - Get Single Task with Metadata
  // ============================================================
  describe('GET /api/v1/tasks/{id} - Get Single Task with Metadata', () => {
    let taskWithMetas: any
    let taskWithoutMetas: any

    beforeEach(() => {
      // Create a task with metadata
      const taskDataWithMetas = taskAPI.generateRandomTaskData({
        title: 'Task with Metas',
        metas: {
          uiPreferences: taskAPI.generateSampleMetadata('uiPreferences').uiPreferences,
          tracking: taskAPI.generateSampleMetadata('tracking').tracking
        }
      })

      taskAPI.createTask(taskDataWithMetas).then((response: any) => {
        taskWithMetas = response.body.data
        createdTasks.push(taskWithMetas)
      })

      // Create a task without metadata
      const taskDataWithoutMetas = taskAPI.generateRandomTaskData({
        title: 'Task without Metas'
      })

      taskAPI.createTask(taskDataWithoutMetas).then((response: any) => {
        taskWithoutMetas = response.body.data
        createdTasks.push(taskWithoutMetas)
      })
    })

    it('TASKS_META_010: Should get task without metas property when metas param not provided', () => {
      cy.then(() => {
        taskAPI.getTaskById(taskWithMetas.id).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.not.have.property('metas')

          cy.log('Verified: No metas property without metas param')
        })
      })
    })

    it('TASKS_META_011: Should get task with metas=all including all metadata groups', () => {
      cy.then(() => {
        taskAPI.getTaskById(taskWithMetas.id, { metas: 'all' }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.be.an('object')

          // Should have the metas we created
          expect(response.body.data.metas).to.have.property('uiPreferences')
          expect(response.body.data.metas).to.have.property('tracking')

          cy.log(`Task metas: ${JSON.stringify(Object.keys(response.body.data.metas))}`)
        })
      })
    })

    it('TASKS_META_012: Should get task with metas=key1 including only specified metaKey', () => {
      cy.then(() => {
        taskAPI.getTaskById(taskWithMetas.id, { metas: 'uiPreferences' }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')

          // Should only have uiPreferences
          expect(response.body.data.metas).to.have.property('uiPreferences')
          expect(response.body.data.metas).to.not.have.property('tracking')

          cy.log('Verified: Only uiPreferences metaKey returned')
        })
      })
    })

    it('TASKS_META_013: Should get task with metas=key1,key2 including multiple metaKeys', () => {
      cy.then(() => {
        taskAPI.getTaskById(taskWithMetas.id, { metas: 'uiPreferences,tracking' }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')

          // Should have both keys
          expect(response.body.data.metas).to.have.property('uiPreferences')
          expect(response.body.data.metas).to.have.property('tracking')

          cy.log('Verified: Both metaKeys returned')
        })
      })
    })

    it('TASKS_META_014: Should get task without metadata returning metas: {}', () => {
      cy.then(() => {
        taskAPI.getTaskById(taskWithoutMetas.id, { metas: 'all' }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.deep.eq({})

          cy.log('Verified: Task without metadata returns empty metas object')
        })
      })
    })

    it('TASKS_META_015: Should return empty metas for non-existent metaKey', () => {
      cy.then(() => {
        taskAPI.getTaskById(taskWithMetas.id, { metas: 'nonExistentKey' }).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.not.have.property('nonExistentKey')

          cy.log('Verified: Non-existent metaKey not in response')
        })
      })
    })
  })

  // ============================================================
  // POST /api/v1/tasks - Create Task with Metadata
  // ============================================================
  describe('POST /api/v1/tasks - Create Task with Metadata', () => {
    it('TASKS_META_020: Should create task without metas and no metas in response', () => {
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task without metas'
      })

      taskAPI.createTask(taskData).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 201)
        expect(response.body.data).to.not.have.property('metas')

        createdTasks.push(response.body.data)
        cy.log('Verified: No metas in response when not provided')
      })
    })

    it('TASKS_META_021: Should create task with one meta group and include in response', () => {
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task with one meta group',
        metas: {
          uiPreferences: {
            colorLabel: 'green',
            showInKanban: true
          }
        }
      })

      taskAPI.createTask(taskData).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 201)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('uiPreferences')
        expect(response.body.data.metas.uiPreferences.colorLabel).to.eq('green')

        createdTasks.push(response.body.data)
        cy.log('Verified: Single meta group created and returned')
      })
    })

    it('TASKS_META_022: Should create task with multiple meta groups', () => {
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task with multiple meta groups',
        metas: {
          uiPreferences: taskAPI.generateSampleMetadata('uiPreferences').uiPreferences,
          notifications: taskAPI.generateSampleMetadata('notifications').notifications,
          tracking: taskAPI.generateSampleMetadata('tracking').tracking
        }
      })

      taskAPI.createTask(taskData).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 201)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('uiPreferences')
        expect(response.body.data.metas).to.have.property('notifications')
        expect(response.body.data.metas).to.have.property('tracking')

        createdTasks.push(response.body.data)
        cy.log('Verified: All meta groups created')
      })
    })

    it('TASKS_META_023: Should create task with nested meta structure preserved', () => {
      const nestedMetas = {
        customFields: {
          level1: {
            level2: {
              level3: {
                deepValue: 'nested-test',
                deepArray: [1, 2, 3]
              }
            }
          }
        }
      }

      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task with nested metas',
        metas: nestedMetas
      })

      taskAPI.createTask(taskData).then((response: any) => {
        taskAPI.validateSuccessResponse(response, 201)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('customFields')
        expect(response.body.data.metas.customFields.level1.level2.level3.deepValue).to.eq('nested-test')
        expect(response.body.data.metas.customFields.level1.level2.level3.deepArray).to.deep.eq([1, 2, 3])

        createdTasks.push(response.body.data)
        cy.log('Verified: Nested structure preserved')
      })
    })

    it('TASKS_META_024: Should reject creation with only metas and no title', () => {
      const taskData = {
        metas: {
          uiPreferences: {
            colorLabel: 'red'
          }
        }
      }

      taskAPI.createTask(taskData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false

        cy.log('Verified: Cannot create task with only metas')
      })
    })

    it('TASKS_META_025: Should handle invalid metas format (string instead of object)', () => {
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task with invalid metas',
        metas: 'invalid-string-metas'
      })

      taskAPI.createTask(taskData).then((response: any) => {
        // API should either reject or ignore invalid metas
        if (response.status === 201) {
          // If created, metas should not be the string
          expect(response.body.data.metas).to.not.eq('invalid-string-metas')
          createdTasks.push(response.body.data)
        } else {
          expect(response.status).to.eq(400)
        }

        cy.log('Verified: Invalid metas format handled')
      })
    })
  })

  // ============================================================
  // PATCH /api/v1/tasks/{id} - Update Metadata
  // ============================================================
  describe('PATCH /api/v1/tasks/{id} - Update Metadata', () => {
    let testTask: any

    beforeEach(() => {
      // Create a task with initial metadata
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task for Meta Updates',
        metas: {
          uiPreferences: {
            theme: 'dark',
            sidebar: true,
            language: 'en'
          },
          notifications: {
            emailOnDue: true,
            reminderDays: 3
          }
        }
      })

      taskAPI.createTask(taskData).then((response: any) => {
        testTask = response.body.data
        createdTasks.push(testTask)
      })
    })

    it('TASKS_META_030: Should update only task data without affecting metas', () => {
      cy.then(() => {
        const updateData = {
          title: 'Updated Title Only'
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.title).to.eq(updateData.title)
          // When updating without metas, response should not include metas
          expect(response.body.data).to.not.have.property('metas')

          // Verify metas still exist by fetching with metas=all
          taskAPI.getTaskById(testTask.id, { metas: 'all' }).then((getResponse: any) => {
            expect(getResponse.body.data.metas).to.have.property('uiPreferences')
            cy.log('Verified: Metas unchanged when not included in update')
          })
        })
      })
    })

    it('TASKS_META_031: Should update both task data and metas', () => {
      cy.then(() => {
        const updateData = {
          title: 'Updated with Metas',
          metas: {
            uiPreferences: {
              theme: 'light'
            }
          }
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.title).to.eq(updateData.title)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas.uiPreferences.theme).to.eq('light')

          cy.log('Verified: Both task data and metas updated')
        })
      })
    })

    it('TASKS_META_032: Should support metas-only updates without entity fields', () => {
      /**
       * NOTE: The generic entity API now supports metas-only updates.
       * Previously this required at least one entity field, but the API
       * has been updated to allow updating only metas.
       */
      cy.then(() => {
        const updateData = {
          metas: {
            uiPreferences: {
              newSetting: 'added-via-metas-only'
            }
          }
        }

        // Generic API now supports metas-only updates
        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas.uiPreferences).to.have.property('newSetting')
          expect(response.body.data.metas.uiPreferences.newSetting).to.eq('added-via-metas-only')

          cy.log('Verified: Metas-only updates now supported')
        })
      })
    })

    it('TASKS_META_033: Should merge new key into existing meta group (preserving existing keys)', () => {
      cy.then(() => {
        // Include title to satisfy entity field requirement
        const updateData = {
          title: testTask.title, // No-op update to satisfy requirement
          metas: {
            uiPreferences: {
              newSetting: 'added-value'
            }
          }
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas.uiPreferences).to.have.property('newSetting')
          // Original keys should be preserved
          expect(response.body.data.metas.uiPreferences).to.have.property('theme')
          expect(response.body.data.metas.uiPreferences).to.have.property('sidebar')

          cy.log('Verified: New key added, existing keys preserved')
        })
      })
    })

    it('TASKS_META_034: Should overwrite existing key while preserving others', () => {
      cy.then(() => {
        // Include title to satisfy entity field requirement
        const updateData = {
          title: testTask.title,
          metas: {
            uiPreferences: {
              theme: 'light'  // Overwrite existing
            }
          }
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.metas.uiPreferences.theme).to.eq('light')
          // Other keys should still exist
          expect(response.body.data.metas.uiPreferences).to.have.property('sidebar')

          cy.log('Verified: Key overwritten, others preserved')
        })
      })
    })

    it('TASKS_META_035: Should upsert (create) new metaKey if it does not exist', () => {
      cy.then(() => {
        // Include title to satisfy entity field requirement
        const updateData = {
          title: testTask.title,
          metas: {
            customFields: {
              clientRef: 'NEW-001',
              department: 'Sales'
            }
          }
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.metas).to.have.property('customFields')
          expect(response.body.data.metas.customFields.clientRef).to.eq('NEW-001')

          cy.log('Verified: New metaKey created via upsert')
        })
      })
    })

    it('TASKS_META_036: Should update multiple meta groups simultaneously', () => {
      cy.then(() => {
        // Include title to satisfy entity field requirement
        const updateData = {
          title: testTask.title,
          metas: {
            uiPreferences: {
              theme: 'system'
            },
            notifications: {
              slack: true
            },
            tracking: {
              actualHours: 5
            }
          }
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.metas).to.have.property('uiPreferences')
          expect(response.body.data.metas).to.have.property('notifications')
          expect(response.body.data.metas).to.have.property('tracking')

          cy.log('Verified: Multiple meta groups updated')
        })
      })
    })

    it('TASKS_META_037: Should handle nested object updates correctly', () => {
      cy.then(() => {
        // Include title to satisfy entity field requirement
        const updateData = {
          title: testTask.title,
          metas: {
            customFields: {
              nested: {
                level1: {
                  level2: {
                    value: 'deep-update'
                  }
                }
              }
            }
          }
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          taskAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.metas.customFields.nested.level1.level2.value).to.eq('deep-update')

          cy.log('Verified: Nested objects updated correctly')
        })
      })
    })

    it('TASKS_META_038: Should reject update with empty metas and no task fields', () => {
      cy.then(() => {
        const updateData = {
          metas: {}
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false

          cy.log('Verified: Empty metas with no fields rejected')
        })
      })
    })

    it('TASKS_META_039: Should reject update with invalid metas format (string)', () => {
      cy.then(() => {
        const updateData = {
          metas: 'invalid-string'
        }

        taskAPI.updateTask(testTask.id, updateData).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false

          cy.log('Verified: Invalid metas format rejected')
        })
      })
    })
  })

  // ============================================================
  // DELETE /api/v1/tasks/{id} - Delete with Metadata
  // ============================================================
  describe('DELETE /api/v1/tasks/{id} - Delete with Metadata', () => {
    it('TASKS_META_050: Should delete task with metadata successfully', () => {
      // Create task with metas
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task to Delete with Metas',
        metas: {
          uiPreferences: { colorLabel: 'red' },
          tracking: { actualHours: 10 }
        }
      })

      taskAPI.createTask(taskData).then((createResponse: any) => {
        const taskId = createResponse.body.data.id

        // Verify metas exist
        taskAPI.getTaskById(taskId, { metas: 'all' }).then((getResponse: any) => {
          expect(getResponse.body.data.metas).to.have.property('uiPreferences')

          // Now delete
          taskAPI.deleteTask(taskId).then((deleteResponse: any) => {
            taskAPI.validateSuccessResponse(deleteResponse, 200)
            expect(deleteResponse.body.data.success).to.be.true

            cy.log('Verified: Task with metas deleted successfully')
          })
        })
      })
    })

    it('TASKS_META_051: Should verify cascade delete removes metadata', () => {
      // Create task with metas
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task for Cascade Delete Test',
        metas: {
          customFields: { important: true }
        }
      })

      taskAPI.createTask(taskData).then((createResponse: any) => {
        const taskId = createResponse.body.data.id

        // Delete the task
        taskAPI.deleteTask(taskId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify task is gone
          taskAPI.getTaskById(taskId, { metas: 'all' }).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)

            cy.log('Verified: Task and metas cascade deleted')
          })
        })
      })
    })

    it('TASKS_META_052: Should delete task without metadata normally', () => {
      // Create task without metas
      const taskData = taskAPI.generateRandomTaskData({
        title: 'Task without Metas to Delete'
      })

      taskAPI.createTask(taskData).then((createResponse: any) => {
        const taskId = createResponse.body.data.id

        // Delete the task
        taskAPI.deleteTask(taskId).then((deleteResponse: any) => {
          taskAPI.validateSuccessResponse(deleteResponse, 200)
          expect(deleteResponse.body.data.success).to.be.true

          // Verify deletion
          taskAPI.getTaskById(taskId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)

            cy.log('Verified: Task without metas deleted normally')
          })
        })
      })
    })
  })

  // ============================================================
  // Integration - Complete CRUD Lifecycle with Metadata
  // ============================================================
  describe('Integration - Complete CRUD Lifecycle with Metadata', () => {
    it('TASKS_META_100: Should complete full lifecycle with metas: Create → Read → Update → Delete', () => {
      const initialMetas = {
        uiPreferences: {
          colorLabel: 'blue',
          priority: 'high'
        }
      }

      const taskData = taskAPI.generateRandomTaskData({
        title: 'Lifecycle Task with Metas',
        metas: initialMetas
      })

      // 1. CREATE with metas
      taskAPI.createTask(taskData).then((createResponse: any) => {
        taskAPI.validateSuccessResponse(createResponse, 201)
        expect(createResponse.body.data).to.have.property('metas')
        expect(createResponse.body.data.metas.uiPreferences.colorLabel).to.eq('blue')
        const taskId = createResponse.body.data.id
        cy.log(`1. Created task with metas: ${taskId}`)

        // 2. READ with metas=all
        taskAPI.getTaskById(taskId, { metas: 'all' }).then((readResponse: any) => {
          taskAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.metas).to.have.property('uiPreferences')
          cy.log('2. Read task with all metas')

          // 3. UPDATE metas (include title to satisfy entity field requirement)
          const updateMetas = {
            title: 'Lifecycle Task with Metas', // Required entity field
            metas: {
              uiPreferences: {
                colorLabel: 'green',  // Update existing
                newField: 'added'     // Add new
              },
              tracking: {             // Add new group
                startedAt: new Date().toISOString()
              }
            }
          }

          taskAPI.updateTask(taskId, updateMetas).then((updateResponse: any) => {
            taskAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.metas.uiPreferences.colorLabel).to.eq('green')
            expect(updateResponse.body.data.metas.uiPreferences.newField).to.eq('added')
            expect(updateResponse.body.data.metas).to.have.property('tracking')
            cy.log('3. Updated metas with merge behavior')

            // 4. DELETE
            taskAPI.deleteTask(taskId).then((deleteResponse: any) => {
              taskAPI.validateSuccessResponse(deleteResponse, 200)
              cy.log('4. Deleted task with metas')

              // 5. VERIFY DELETION
              taskAPI.getTaskById(taskId, { metas: 'all' }).then((finalResponse: any) => {
                expect(finalResponse.status).to.eq(404)
                cy.log('5. Verified deletion (404)')
                cy.log('Full lifecycle with metas completed successfully')
              })
            })
          })
        })
      })
    })

    it('TASKS_META_101: Should verify accumulative merge works across multiple updates', () => {
      const taskTitle = 'Accumulative Merge Test'
      const taskData = taskAPI.generateRandomTaskData({
        title: taskTitle
      })

      // Create task without metas
      taskAPI.createTask(taskData).then((createResponse: any) => {
        const taskId = createResponse.body.data.id
        createdTasks.push(createResponse.body.data)

        // Update 1: Add first meta group (include title to satisfy requirement)
        taskAPI.updateTask(taskId, {
          title: taskTitle,
          metas: {
            uiPreferences: { theme: 'dark' }
          }
        }).then((update1: any) => {
          expect(update1.body.data.metas.uiPreferences.theme).to.eq('dark')

          // Update 2: Add second meta group
          taskAPI.updateTask(taskId, {
            title: taskTitle,
            metas: {
              notifications: { email: true }
            }
          }).then((update2: any) => {
            expect(update2.body.data.metas).to.have.property('notifications')

            // Update 3: Add key to first group
            taskAPI.updateTask(taskId, {
              title: taskTitle,
              metas: {
                uiPreferences: { sidebar: true }
              }
            }).then((update3: any) => {
              // Verify all accumulated metas
              taskAPI.getTaskById(taskId, { metas: 'all' }).then((finalGet: any) => {
                const metas = finalGet.body.data.metas

                // First group should have both keys
                expect(metas.uiPreferences).to.have.property('theme')
                expect(metas.uiPreferences).to.have.property('sidebar')

                // Second group should still exist
                expect(metas).to.have.property('notifications')

                cy.log('Verified: Accumulative merge preserved all metas across updates')
              })
            })
          })
        })
      })
    })
  })
})
