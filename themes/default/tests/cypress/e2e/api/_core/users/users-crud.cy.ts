/// <reference types="cypress" />

/**
 * Users API - CRUD Tests
 *
 * Basic CRUD operations for /api/v1/users endpoints
 * Uses superadmin API key for full access
 */

import * as allure from 'allure-cypress'

const UsersAPIController = require('../../../../src/controllers/UsersAPIController.js')

describe('Users API - CRUD Operations', {
  tags: ['@api', '@feat-users', '@crud', '@regression']
}, () => {
  let userAPI: any
  let createdUsers: any[] = []

  // Superadmin API key for testing
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    // Initialize API controller with superadmin API key (global entity - no teamId required)
    userAPI = new UsersAPIController(BASE_URL, SUPERADMIN_API_KEY)
    cy.log('UsersAPIController initialized (global entity - no team required)')
    cy.log(`Base URL: ${BASE_URL}`)
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Users')
    allure.story('CRUD Operations')
  })

  afterEach(() => {
    // Cleanup: Delete users created during tests
    if (createdUsers.length > 0) {
      createdUsers.forEach((user: any) => {
        if (user && user.id) {
          userAPI.deleteUser(user.id)
        }
      })
      createdUsers = []
    }
  })

  // ============================================================
  // GET /api/v1/users - List Users
  // ============================================================
  describe('GET /api/v1/users - List Users', () => {
    it('USERS_API_001: Should list all users with valid API key', { tags: '@smoke' }, () => {
      allure.severity('critical')
      userAPI.getUsers().then((response: any) => {
        userAPI.validateSuccessResponse(response, 200)
        userAPI.validatePaginatedResponse(response)
        expect(response.body.data).to.be.an('array')

        cy.log(`Found ${response.body.data.length} users`)
        cy.log(`Total users: ${response.body.info.total}`)
      })
    })

    it('USERS_API_002: Should list users with pagination', () => {
      userAPI.getUsers({ page: 1, limit: 5 }).then((response: any) => {
        userAPI.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1, Limit 5: Got ${response.body.data.length} users`)
      })
    })

    it('USERS_API_003: Should filter users by role', () => {
      userAPI.getUsers({ role: 'member' }).then((response: any) => {
        userAPI.validateSuccessResponse(response, 200)

        // All returned users should have role 'member'
        response.body.data.forEach((user: any) => {
          expect(user.role).to.eq('member')
        })

        cy.log(`Found ${response.body.data.length} users with role 'member'`)
      })
    })

    it('USERS_API_004: Should reject request without API key', () => {
      const originalApiKey = userAPI.apiKey
      userAPI.setApiKey(null)

      userAPI.getUsers().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
      })

      userAPI.setApiKey(originalApiKey)
    })

    it('USERS_API_005: Should reject request with invalid API key', () => {
      const originalApiKey = userAPI.apiKey
      userAPI.setApiKey('sk_invalid_key_12345')

      userAPI.getUsers().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
      })

      userAPI.setApiKey(originalApiKey)
    })
  })

  // ============================================================
  // POST /api/v1/users - Create User
  // ============================================================
  describe('POST /api/v1/users - Create User', () => {
    it('USERS_API_010: Should create user with valid data', { tags: '@smoke' }, () => {
      allure.severity('critical')
      const userData = userAPI.generateRandomUserData({
        firstName: 'TestCreate',
        lastName: 'CypressUser',
        role: 'member'
      })

      userAPI.createUser(userData).then((response: any) => {
        userAPI.validateSuccessResponse(response, 201)
        userAPI.validateUserObject(response.body.data)

        expect(response.body.data.email).to.eq(userData.email)
        expect(response.body.data.firstName).to.eq(userData.firstName)
        expect(response.body.data.lastName).to.eq(userData.lastName)
        expect(response.body.data.role).to.eq(userData.role)

        // Save for cleanup
        createdUsers.push(response.body.data)

        cy.log(`Created user: ${response.body.data.email}`)
      })
    })

    it('USERS_API_011: Should create user with minimal data and default values', () => {
      const userData = userAPI.generateRandomUserData({
        firstName: 'MinimalUser'
      })
      delete userData.role // Should default to 'member'

      userAPI.createUser(userData).then((response: any) => {
        userAPI.validateSuccessResponse(response, 201)
        userAPI.validateUserObject(response.body.data)

        // Verify default values
        expect(response.body.data.role).to.eq('member')
        expect(response.body.data.language).to.eq('en')
        expect(response.body.data.timezone).to.eq('UTC')

        // Verify auto-generated name
        expect(response.body.data.name).to.eq(`${userData.firstName} ${userData.lastName}`)

        createdUsers.push(response.body.data)
        cy.log(`Created user with defaults: ${response.body.data.email}`)
      })
    })

    it('USERS_API_012: Should reject creation with invalid email format', () => {
      const userData = userAPI.generateRandomUserData({
        email: 'invalid-email-format'
      })

      userAPI.createUser(userData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
      })
    })

    it('USERS_API_013: Should reject creation without required fields', () => {
      const userData = {
        email: `test_${Date.now()}@nextspark.dev`
        // Missing firstName, lastName, country
      }

      userAPI.createUser(userData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
      })
    })

    it('USERS_API_014: Should reject duplicate email', () => {
      const userData = userAPI.generateRandomUserData()

      // Create first user
      userAPI.createUser(userData).then((firstResponse: any) => {
        expect(firstResponse.status).to.eq(201)
        createdUsers.push(firstResponse.body.data)

        // Try to create second user with same email
        userAPI.createUser(userData).then((secondResponse: any) => {
          expect(secondResponse.status).to.eq(409)
          expect(secondResponse.body.success).to.be.false
        })
      })
    })
  })

  // ============================================================
  // GET /api/v1/users/{id} - Get User by ID
  // ============================================================
  describe('GET /api/v1/users/{id} - Get User by ID', () => {
    let testUser: any

    beforeEach(() => {
      // Create a test user for each test
      const userData = userAPI.generateRandomUserData({
        firstName: 'TestGetById'
      })

      userAPI.createUser(userData).then((response: any) => {
        testUser = response.body.data
        createdUsers.push(testUser)
      })
    })

    it('USERS_API_020: Should get user by valid ID', () => {
      cy.then(() => {
        userAPI.getUserById(testUser.id).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          userAPI.validateUserObject(response.body.data)

          expect(response.body.data.id).to.eq(testUser.id)
          expect(response.body.data.email).to.eq(testUser.email)

          cy.log(`Got user by ID: ${testUser.id}`)
        })
      })
    })

    it('USERS_API_021: Should get user by valid email', () => {
      cy.then(() => {
        userAPI.getUserById(testUser.email).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          userAPI.validateUserObject(response.body.data)

          expect(response.body.data.id).to.eq(testUser.id)
          expect(response.body.data.email).to.eq(testUser.email)

          cy.log(`Got user by email: ${testUser.email}`)
        })
      })
    })

    it('USERS_API_022: Should return 404 for non-existent user', () => {
      const nonExistentId = 'non-existent-user-id-12345'

      userAPI.getUserById(nonExistentId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })
    })
  })

  // ============================================================
  // PATCH /api/v1/users/{id} - Update User
  // ============================================================
  describe('PATCH /api/v1/users/{id} - Update User', () => {
    let testUser: any

    beforeEach(() => {
      // Create a test user for each test
      const userData = userAPI.generateRandomUserData({
        firstName: 'TestUpdate'
      })

      userAPI.createUser(userData).then((response: any) => {
        testUser = response.body.data
        createdUsers.push(testUser)
      })
    })

    it('USERS_API_030: Should update user with valid data', () => {
      const updateData = {
        firstName: 'UpdatedFirstName',
        lastName: 'UpdatedLastName'
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, updateData).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          userAPI.validateUserObject(response.body.data)

          expect(response.body.data.firstName).to.eq(updateData.firstName)
          expect(response.body.data.lastName).to.eq(updateData.lastName)
          expect(response.body.data.id).to.eq(testUser.id)

          // Name should be auto-updated
          expect(response.body.data.name).to.eq(`${updateData.firstName} ${updateData.lastName}`)

          cy.log(`Updated user: ${testUser.id}`)
        })
      })
    })

    it('USERS_API_031: Should update user by email', () => {
      const updateData = {
        firstName: 'UpdatedViaEmail'
      }

      cy.then(() => {
        userAPI.updateUser(testUser.email, updateData).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)

          expect(response.body.data.firstName).to.eq(updateData.firstName)
          expect(response.body.data.email).to.eq(testUser.email)

          cy.log(`Updated user by email: ${testUser.email}`)
        })
      })
    })

    it('USERS_API_032: Should update user role', () => {
      // Note: User-level roles are only 'member' or 'superadmin'
      // Team-specific roles (admin, collaborator, etc.) are managed via team_members API
      const updateData = {
        role: 'superadmin'
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, updateData).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.role).to.eq(updateData.role)

          cy.log(`Updated user role to: ${updateData.role}`)
        })
      })
    })

    it('USERS_API_033: Should return 404 for non-existent user', () => {
      const nonExistentId = 'non-existent-user-id-12345'
      const updateData = { firstName: 'Updated' }

      userAPI.updateUser(nonExistentId, updateData).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })
    })

    it('USERS_API_034: Should reject empty update body', () => {
      cy.then(() => {
        userAPI.updateUser(testUser.id, {}).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false
        })
      })
    })
  })

  // ============================================================
  // DELETE /api/v1/users/{id} - Delete User
  // ============================================================
  describe('DELETE /api/v1/users/{id} - Delete User', () => {
    let testUser: any

    beforeEach(() => {
      // Create a test user for each test
      const userData = userAPI.generateRandomUserData({
        firstName: 'TestDelete'
      })

      userAPI.createUser(userData).then((response: any) => {
        testUser = response.body.data
        // Don't add to createdUsers - we'll delete manually
      })
    })

    it('USERS_API_040: Should delete user by valid ID', () => {
      cy.then(() => {
        userAPI.deleteUser(testUser.id).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.deleted).to.be.true
          expect(response.body.data.id).to.exist

          cy.log(`Deleted user: ${testUser.id}`)

          // Verify user was deleted
          userAPI.getUserById(testUser.id).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
          })
        })
      })
    })

    it('USERS_API_041: Should delete user by valid email', () => {
      cy.then(() => {
        userAPI.deleteUser(testUser.email).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.deleted).to.be.true

          cy.log(`Deleted user by email: ${testUser.email}`)

          // Verify user was deleted
          userAPI.getUserById(testUser.email).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
          })
        })
      })
    })

    it('USERS_API_042: Should return 404 for non-existent user', () => {
      const nonExistentId = 'non-existent-user-id-12345'

      userAPI.deleteUser(nonExistentId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      })

      // Add testUser to cleanup since we didn't delete it
      createdUsers.push(testUser)
    })
  })

  // ============================================================
  // Integration Test - Complete CRUD Lifecycle
  // ============================================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('USERS_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      const userData = userAPI.generateRandomUserData({
        firstName: 'Lifecycle',
        lastName: 'TestUser',
        role: 'member'
      })

      // 1. CREATE
      userAPI.createUser(userData).then((createResponse: any) => {
        userAPI.validateSuccessResponse(createResponse, 201)
        const createdUser = createResponse.body.data
        cy.log(`1. Created user: ${createdUser.email}`)

        // 2. READ
        userAPI.getUserById(createdUser.id).then((readResponse: any) => {
          userAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.id).to.eq(createdUser.id)
          expect(readResponse.body.data.email).to.eq(userData.email)
          cy.log(`2. Read user: ${createdUser.id}`)

          // 3. UPDATE
          const updateData = { firstName: 'UpdatedLifecycle' }
          userAPI.updateUser(createdUser.id, updateData).then((updateResponse: any) => {
            userAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.firstName).to.eq(updateData.firstName)
            cy.log(`3. Updated user firstName to: ${updateData.firstName}`)

            // 4. DELETE
            userAPI.deleteUser(createdUser.id).then((deleteResponse: any) => {
              userAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data.deleted).to.be.true
              cy.log(`4. Deleted user: ${createdUser.id}`)

              // 5. VERIFY DELETION
              userAPI.getUserById(createdUser.id).then((finalResponse: any) => {
                expect(finalResponse.status).to.eq(404)
                cy.log(`5. Verified deletion: user not found (404)`)
                cy.log('Full CRUD lifecycle completed successfully')
              })
            })
          })
        })
      })
    })
  })
})
