/// <reference types="cypress" />

/**
 * Users API - Metadata Tests
 *
 * Comprehensive test suite for User API endpoints with metadata functionality.
 * Covers GET, POST, PATCH, DELETE operations with various metadata scenarios.
 * Tests metadata parameter handling, merge behavior, and upsert functionality.
 */

import * as allure from 'allure-cypress'

const UsersAPIController = require('../../../../src/controllers/UsersAPIController.js')

describe('Users API - Metadata Tests', {
  tags: ['@api', '@feat-users', '@metas', '@regression']
}, () => {
  let userAPI: any
  let createdUsers: any[] = []

  // Superadmin API key for testing
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    // Initialize API controller with superadmin API key (global entity - no teamId required)
    userAPI = new UsersAPIController(BASE_URL, SUPERADMIN_API_KEY)
    cy.log('UsersAPIController initialized for Metadata tests')
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Users')
    allure.story('Metadata Operations')
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
  // GET /api/v1/users - List Users with Metadata
  // ============================================================
  describe('GET /api/v1/users - List Users with Metadata', () => {
    let userWithMetas: any

    beforeEach(() => {
      // Create a user with metadata for testing
      const userData = userAPI.generateRandomUserData({
        firstName: 'MetaListTest'
      })

      userAPI.createUser(userData).then((response: any) => {
        userWithMetas = response.body.data
        createdUsers.push(userWithMetas)

        // Add metadata to the user
        const metaUpdate = {
          metas: {
            uiPreferences: { theme: 'dark', sidebarCollapsed: false },
            securityPreferences: { twoFactorEnabled: true },
            notificationPreferences: { emailEnabled: true, pushEnabled: false }
          }
        }
        userAPI.updateUser(userWithMetas.id, metaUpdate)
      })
    })

    it('USERS_META_001: Should list users without metas parameter', () => {
      userAPI.getUsers().then((response: any) => {
        userAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')

        // Verify no metas property in user objects
        response.body.data.forEach((user: any) => {
          expect(user).to.not.have.property('metas')
        })

        cy.log('Users listed without metas property')
      })
    })

    it('USERS_META_002: Should list users with metas=all', () => {
      cy.then(() => {
        userAPI.getUsers({ metas: 'all' }).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // Find our user with metadata
          const foundUser = response.body.data.find((u: any) => u.id === userWithMetas.id)
          expect(foundUser).to.exist
          expect(foundUser).to.have.property('metas')
          expect(foundUser.metas).to.have.property('uiPreferences')
          expect(foundUser.metas).to.have.property('securityPreferences')
          expect(foundUser.metas).to.have.property('notificationPreferences')

          cy.log('Users listed with all metas included')
        })
      })
    })

    it('USERS_META_003: Should list users with metas=key1 (single key)', () => {
      cy.then(() => {
        userAPI.getUsers({ metas: 'uiPreferences' }).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)

          const foundUser = response.body.data.find((u: any) => u.id === userWithMetas.id)
          expect(foundUser).to.exist
          expect(foundUser).to.have.property('metas')
          expect(foundUser.metas).to.have.property('uiPreferences')
          expect(foundUser.metas).to.not.have.property('securityPreferences')
          expect(foundUser.metas).to.not.have.property('notificationPreferences')

          cy.log('Users listed with only uiPreferences metas')
        })
      })
    })

    it('USERS_META_004: Should list users with metas=key1,key2 (multiple keys)', () => {
      cy.then(() => {
        userAPI.getUsers({ metas: 'uiPreferences,securityPreferences' }).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)

          const foundUser = response.body.data.find((u: any) => u.id === userWithMetas.id)
          expect(foundUser).to.exist
          expect(foundUser).to.have.property('metas')
          expect(foundUser.metas).to.have.property('uiPreferences')
          expect(foundUser.metas).to.have.property('securityPreferences')
          expect(foundUser.metas).to.not.have.property('notificationPreferences')

          cy.log('Users listed with uiPreferences and securityPreferences metas')
        })
      })
    })

    it('USERS_META_005: Should list users with non-existent metaKey', () => {
      userAPI.getUsers({ metas: 'nonExistentKey' }).then((response: any) => {
        userAPI.validateSuccessResponse(response, 200)

        response.body.data.forEach((user: any) => {
          expect(user).to.have.property('metas')
          // Should return empty metas object for non-existent key
          expect(user.metas).to.not.have.property('nonExistentKey')
        })

        cy.log('Users listed with non-existent metaKey returns empty metas')
      })
    })

    it('USERS_META_006: Should list users with pagination and metas=all', () => {
      cy.then(() => {
        userAPI.getUsers({ page: 1, limit: 5, metas: 'all' }).then((response: any) => {
          userAPI.validatePaginatedResponse(response)
          expect(response.body.info.page).to.eq(1)
          expect(response.body.info.limit).to.eq(5)
          expect(response.body.data.length).to.be.at.most(5)

          // Verify metas property exists for all users
          response.body.data.forEach((user: any) => {
            expect(user).to.have.property('metas')
          })

          cy.log('Paginated users listed with metas=all')
        })
      })
    })
  })

  // ============================================================
  // GET /api/v1/users/{id} - Get Single User with Metadata
  // ============================================================
  describe('GET /api/v1/users/{id} - Get Single User with Metadata', () => {
    let testUser: any

    beforeEach(() => {
      // Create a test user with metadata
      const userData = userAPI.generateRandomUserData({
        firstName: 'MetaGetTest'
      })

      userAPI.createUser(userData).then((response: any) => {
        testUser = response.body.data
        createdUsers.push(testUser)

        // Add metadata to the user
        const metaUpdate = {
          metas: {
            uiPreferences: { theme: 'light', language: 'es' },
            securityPreferences: { twoFactorEnabled: false, sessionTimeout: 3600 },
            customPreferences: { feature1: 'enabled' }
          }
        }
        userAPI.updateUser(testUser.id, metaUpdate)
      })
    })

    it('USERS_META_010: Should get user without metas parameter', () => {
      cy.then(() => {
        userAPI.getUserById(testUser.id).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          userAPI.validateUserObject(response.body.data)
          expect(response.body.data).to.not.have.property('metas')

          cy.log('User retrieved without metas property')
        })
      })
    })

    it('USERS_META_011: Should get user with metas=all', () => {
      cy.then(() => {
        userAPI.getUserById(testUser.id, { metas: 'all' }).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          userAPI.validateUserObject(response.body.data, true)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.have.property('uiPreferences')
          expect(response.body.data.metas).to.have.property('securityPreferences')
          expect(response.body.data.metas).to.have.property('customPreferences')

          cy.log('User retrieved with all metas')
        })
      })
    })

    it('USERS_META_012: Should get user with metas=key1 (single key)', () => {
      cy.then(() => {
        userAPI.getUserById(testUser.id, { metas: 'uiPreferences' }).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.have.property('uiPreferences')
          expect(response.body.data.metas).to.not.have.property('securityPreferences')
          expect(response.body.data.metas).to.not.have.property('customPreferences')

          cy.log('User retrieved with only uiPreferences metas')
        })
      })
    })

    it('USERS_META_013: Should get user with metas=key1,key2 (multiple keys)', () => {
      cy.then(() => {
        userAPI.getUserById(testUser.id, { metas: 'uiPreferences,securityPreferences' }).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.have.property('uiPreferences')
          expect(response.body.data.metas).to.have.property('securityPreferences')
          expect(response.body.data.metas).to.not.have.property('customPreferences')

          cy.log('User retrieved with uiPreferences and securityPreferences metas')
        })
      })
    })

    it('USERS_META_014: Should get user with metas=all when user has no metadata', () => {
      // Create a user without metadata
      const userData = userAPI.generateRandomUserData({
        firstName: 'NoMetaUser'
      })

      userAPI.createUser(userData).then((response: any) => {
        const noMetaUser = response.body.data
        createdUsers.push(noMetaUser)

        userAPI.getUserById(noMetaUser.id, { metas: 'all' }).then((getResponse: any) => {
          userAPI.validateSuccessResponse(getResponse, 200)
          expect(getResponse.body.data).to.have.property('metas')
          expect(Object.keys(getResponse.body.data.metas)).to.have.lengthOf(0)

          cy.log('User without metadata returns empty metas object')
        })
      })
    })

    it('USERS_META_015: Should get user by email with metas=all', () => {
      cy.then(() => {
        userAPI.getUserById(testUser.email, { metas: 'all' }).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.id).to.eq(testUser.id)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.have.property('uiPreferences')

          cy.log('User retrieved by email with metas=all')
        })
      })
    })
  })

  // ============================================================
  // POST /api/v1/users - Create User with Metadata
  // ============================================================
  describe('POST /api/v1/users - Create User with Metadata', () => {

    it('USERS_META_020: Should create user without metas', () => {
      const userData = userAPI.generateRandomUserData({
        firstName: 'NoMetaCreate'
      })

      userAPI.createUser(userData).then((response: any) => {
        userAPI.validateSuccessResponse(response, 201)
        userAPI.validateUserObject(response.body.data)
        expect(response.body.data).to.not.have.property('metas')

        createdUsers.push(response.body.data)
        cy.log('User created without metas in response')
      })
    })

    it('USERS_META_021: Should create user with one metas group', () => {
      const userData = userAPI.generateRandomUserData({
        firstName: 'OneMetaCreate'
      })
      ;(userData as any).metas = {
        uiPreferences: {
          theme: 'dark',
          sidebarCollapsed: true
        }
      }

      userAPI.createUser(userData).then((response: any) => {
        userAPI.validateSuccessResponse(response, 201)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('uiPreferences')
        expect(response.body.data.metas.uiPreferences.theme).to.eq('dark')
        expect(response.body.data.metas.uiPreferences.sidebarCollapsed).to.eq(true)

        createdUsers.push(response.body.data)
        cy.log('User created with one metas group')
      })
    })

    it('USERS_META_022: Should create user with multiple metas groups', () => {
      const userData = userAPI.generateRandomUserData({
        firstName: 'MultiMetaCreate'
      })
      ;(userData as any).metas = {
        uiPreferences: { theme: 'light' },
        securityPreferences: { twoFactorEnabled: true },
        notificationPreferences: { emailEnabled: false }
      }

      userAPI.createUser(userData).then((response: any) => {
        userAPI.validateSuccessResponse(response, 201)
        expect(response.body.data).to.have.property('metas')
        expect(response.body.data.metas).to.have.property('uiPreferences')
        expect(response.body.data.metas).to.have.property('securityPreferences')
        expect(response.body.data.metas).to.have.property('notificationPreferences')

        createdUsers.push(response.body.data)
        cy.log('User created with multiple metas groups')
      })
    })

    it('USERS_META_023: Should create user with nested metas structure', () => {
      const userData = userAPI.generateRandomUserData({
        firstName: 'NestedMetaCreate'
      })
      ;(userData as any).metas = {
        workflowPreferences: {
          stages: {
            review: {
              autoAssign: true,
              notifications: {
                email: true,
                slack: false
              }
            },
            testing: {
              autoAssign: false
            }
          }
        }
      }

      userAPI.createUser(userData).then((response: any) => {
        userAPI.validateSuccessResponse(response, 201)
        expect(response.body.data).to.have.property('metas')
        const workflow = response.body.data.metas.workflowPreferences
        expect(workflow.stages.review.autoAssign).to.eq(true)
        expect(workflow.stages.review.notifications.email).to.eq(true)
        expect(workflow.stages.review.notifications.slack).to.eq(false)
        expect(workflow.stages.testing.autoAssign).to.eq(false)

        createdUsers.push(response.body.data)
        cy.log('User created with nested metas structure')
      })
    })

    it('USERS_META_024: Should reject creation with only metas (no user fields)', () => {
      const invalidData = {
        metas: {
          uiPreferences: { theme: 'dark' }
        }
      }

      userAPI.createUser(invalidData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false

        cy.log('Creation rejected when only metas provided')
      })
    })

    it('USERS_META_025: Should handle creation with invalid metas structure (string)', () => {
      const userData = userAPI.generateRandomUserData({
        firstName: 'InvalidMetaCreate'
      })
      ;(userData as any).metas = 'invalid_string'

      userAPI.createUser(userData).then((response: any) => {
        // API might accept and ignore invalid metas, or reject
        if (response.status === 201) {
          expect(response.body.data).to.not.have.property('metas')
          createdUsers.push(response.body.data)
          cy.log('Invalid metas ignored, user created without metas')
        } else {
          expect(response.status).to.eq(400)
          cy.log('Invalid metas rejected')
        }
      })
    })
  })

  // ============================================================
  // PATCH /api/v1/users/{id} - Update Metadata
  // ============================================================
  describe('PATCH /api/v1/users/{id} - Update Metadata', () => {
    let testUser: any

    beforeEach(() => {
      // Create a test user
      const userData = userAPI.generateRandomUserData({
        firstName: 'MetaUpdateTest'
      })

      userAPI.createUser(userData).then((response: any) => {
        testUser = response.body.data
        createdUsers.push(testUser)
      })
    })

    it('USERS_META_030: Should update only user data (no metas in response)', () => {
      // First add some metadata
      const initialMeta = {
        metas: {
          uiPreferences: { theme: 'dark' }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, initialMeta).then(() => {
          // Now update only user data
          const updateData = { firstName: 'UpdatedNoMeta' }

          userAPI.updateUser(testUser.id, updateData).then((response: any) => {
            userAPI.validateSuccessResponse(response, 200)
            expect(response.body.data.firstName).to.eq('UpdatedNoMeta')
            // Response should NOT include metas when only user data is updated
            expect(response.body.data).to.not.have.property('metas')

            cy.log('User data updated without metas in response')
          })
        })
      })
    })

    it('USERS_META_031: Should update user data and metas together', () => {
      const updateData = {
        firstName: 'UpdatedWithMeta',
        metas: {
          uiPreferences: { theme: 'light' }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, updateData).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.firstName).to.eq('UpdatedWithMeta')
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas.uiPreferences.theme).to.eq('light')

          cy.log('User data and metas updated together')
        })
      })
    })

    it('USERS_META_032: Should update only metas (no user data)', () => {
      const updateData = {
        metas: {
          securityPreferences: { twoFactorEnabled: true }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, updateData).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas.securityPreferences.twoFactorEnabled).to.eq(true)

          cy.log('Only metas updated successfully')
        })
      })
    })

    it('USERS_META_033: Should merge - add new key to existing metas group', () => {
      // First set initial metadata
      const initialMeta = {
        metas: {
          uiPreferences: {
            theme: 'dark',
            sidebar: true
          }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, initialMeta).then(() => {
          // Now add a new key to the same group
          const addKeyUpdate = {
            metas: {
              uiPreferences: {
                newSetting: 'value'
              }
            }
          }

          userAPI.updateUser(testUser.id, addKeyUpdate).then((response: any) => {
            userAPI.validateSuccessResponse(response, 200)
            const prefs = response.body.data.metas.uiPreferences
            expect(prefs.theme).to.eq('dark')       // Preserved
            expect(prefs.sidebar).to.eq(true)       // Preserved
            expect(prefs.newSetting).to.eq('value') // Added

            cy.log('New key added to existing metas group (merge)')
          })
        })
      })
    })

    it('USERS_META_034: Should merge - modify existing key, preserve others', () => {
      // First set initial metadata
      const initialMeta = {
        metas: {
          uiPreferences: {
            theme: 'dark',
            language: 'en',
            sidebar: true
          }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, initialMeta).then(() => {
          // Now modify one key
          const modifyUpdate = {
            metas: {
              uiPreferences: {
                theme: 'light'  // Change this
              }
            }
          }

          userAPI.updateUser(testUser.id, modifyUpdate).then((response: any) => {
            userAPI.validateSuccessResponse(response, 200)
            const prefs = response.body.data.metas.uiPreferences
            expect(prefs.theme).to.eq('light')   // Modified
            expect(prefs.language).to.eq('en')   // Preserved
            expect(prefs.sidebar).to.eq(true)    // Preserved

            cy.log('Existing key modified, others preserved (merge)')
          })
        })
      })
    })

    it('USERS_META_035: Should upsert - create new metaKey if not exists', () => {
      const createNewKeyUpdate = {
        metas: {
          customPreferences: {
            feature1: 'enabled',
            feature2: 'disabled'
          }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, createNewKeyUpdate).then((response: any) => {
          userAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('metas')
          expect(response.body.data.metas).to.have.property('customPreferences')
          expect(response.body.data.metas.customPreferences.feature1).to.eq('enabled')
          expect(response.body.data.metas.customPreferences.feature2).to.eq('disabled')

          cy.log('New metaKey created (upsert)')
        })
      })
    })

    it('USERS_META_036: Should update multiple metas groups simultaneously', () => {
      // First set initial metadata
      const initialMeta = {
        metas: {
          uiPreferences: { theme: 'dark' },
          securityPreferences: { twoFactorEnabled: false }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, initialMeta).then(() => {
          // Update both groups
          const multiUpdate = {
            metas: {
              uiPreferences: { language: 'es' },
              securityPreferences: { sessionTimeout: 7200 }
            }
          }

          userAPI.updateUser(testUser.id, multiUpdate).then((response: any) => {
            userAPI.validateSuccessResponse(response, 200)
            const metas = response.body.data.metas

            expect(metas.uiPreferences.theme).to.eq('dark')       // Preserved
            expect(metas.uiPreferences.language).to.eq('es')       // Added
            expect(metas.securityPreferences.twoFactorEnabled).to.eq(false)  // Preserved
            expect(metas.securityPreferences.sessionTimeout).to.eq(7200)     // Added

            cy.log('Multiple metas groups updated simultaneously')
          })
        })
      })
    })

    it('USERS_META_037: Should handle nested objects update', () => {
      // First set initial nested metadata
      const initialMeta = {
        metas: {
          workflowPreferences: {
            stages: {
              review: {
                autoAssign: true,
                notifications: {
                  email: true
                }
              }
            }
          }
        }
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, initialMeta).then(() => {
          // Update nested structure - Note: API may replace nested objects rather than deep merge
          const nestedUpdate = {
            metas: {
              workflowPreferences: {
                stages: {
                  review: {
                    notifications: {
                      slack: true,
                      email: true  // Include existing to preserve
                    }
                  }
                }
              }
            }
          }

          userAPI.updateUser(testUser.id, nestedUpdate).then((response: any) => {
            userAPI.validateSuccessResponse(response, 200)
            const workflow = response.body.data.metas.workflowPreferences
            expect(workflow.stages.review.notifications.slack).to.eq(true)
            expect(workflow.stages.review.notifications.email).to.eq(true)

            cy.log('Nested objects updated correctly')
          })
        })
      })
    })

    it('USERS_META_038: Should reject update with empty metas object', () => {
      const emptyMetaUpdate = {
        metas: {}
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, emptyMetaUpdate).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false

          cy.log('Empty metas object rejected')
        })
      })
    })

    it('USERS_META_039: Should reject update with invalid metas structure (string)', () => {
      const invalidMetaUpdate = {
        metas: 'invalid_string'
      }

      cy.then(() => {
        userAPI.updateUser(testUser.id, invalidMetaUpdate).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false

          cy.log('Invalid metas structure rejected')
        })
      })
    })
  })

  // ============================================================
  // DELETE /api/v1/users/{id} - Delete with Metadata
  // ============================================================
  describe('DELETE /api/v1/users/{id} - Delete with Metadata', () => {

    it('USERS_META_050: Should delete user with metadata', () => {
      // Create user with metadata
      const userData = userAPI.generateRandomUserData({
        firstName: 'DeleteWithMeta'
      })
      ;(userData as any).metas = {
        uiPreferences: { theme: 'dark' },
        securityPreferences: { twoFactorEnabled: true }
      }

      userAPI.createUser(userData).then((response: any) => {
        const userToDelete = response.body.data

        userAPI.deleteUser(userToDelete.id).then((deleteResponse: any) => {
          userAPI.validateSuccessResponse(deleteResponse, 200)
          expect(deleteResponse.body.data.deleted).to.eq(true)
          expect(deleteResponse.body.data.id).to.eq(userToDelete.id)

          cy.log('User with metadata deleted successfully')
        })
      })
    })

    it('USERS_META_051: Should verify cascade delete (GET returns 404)', () => {
      // Create user with metadata
      const userData = userAPI.generateRandomUserData({
        firstName: 'CascadeDelete'
      })
      ;(userData as any).metas = {
        uiPreferences: { theme: 'dark' }
      }

      userAPI.createUser(userData).then((response: any) => {
        const userId = response.body.data.id

        userAPI.deleteUser(userId).then(() => {
          // Verify user is deleted
          userAPI.getUserById(userId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body.success).to.be.false

            cy.log('Cascade delete verified - user not found')
          })
        })
      })
    })

    it('USERS_META_052: Should delete user without metadata normally', () => {
      // Create user without metadata
      const userData = userAPI.generateRandomUserData({
        firstName: 'DeleteNoMeta'
      })

      userAPI.createUser(userData).then((response: any) => {
        const userToDelete = response.body.data

        userAPI.deleteUser(userToDelete.id).then((deleteResponse: any) => {
          userAPI.validateSuccessResponse(deleteResponse, 200)
          expect(deleteResponse.body.data.deleted).to.eq(true)

          cy.log('User without metadata deleted successfully')
        })
      })
    })
  })

  // ============================================================
  // Integration - Complete CRUD Lifecycle with Metadata
  // ============================================================
  describe('Integration - Complete CRUD Lifecycle with Metadata', () => {

    it('USERS_META_100: Should complete full lifecycle with metas', () => {
      // 1. CREATE with metas
      const userData = userAPI.generateRandomUserData({
        firstName: 'LifecycleMeta',
        lastName: 'TestUser'
      })
      ;(userData as any).metas = {
        uiPreferences: { theme: 'dark', language: 'en' }
      }

      userAPI.createUser(userData).then((createResponse: any) => {
        userAPI.validateSuccessResponse(createResponse, 201)
        const createdUser = createResponse.body.data
        expect(createdUser.metas.uiPreferences.theme).to.eq('dark')
        cy.log('1. Created user with metas')

        // 2. READ with metas=all
        userAPI.getUserById(createdUser.id, { metas: 'all' }).then((readResponse: any) => {
          userAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.metas.uiPreferences.theme).to.eq('dark')
          cy.log('2. Read user with metas=all')

          // 3. UPDATE metas
          const updateData = {
            metas: {
              uiPreferences: { sidebar: true },
              securityPreferences: { twoFactorEnabled: true }
            }
          }

          userAPI.updateUser(createdUser.id, updateData).then((updateResponse: any) => {
            userAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.metas.uiPreferences.theme).to.eq('dark')  // Preserved
            expect(updateResponse.body.data.metas.uiPreferences.sidebar).to.eq(true)  // Added
            expect(updateResponse.body.data.metas.securityPreferences.twoFactorEnabled).to.eq(true)  // New group
            cy.log('3. Updated metas (merge + new group)')

            // 4. DELETE
            userAPI.deleteUser(createdUser.id).then((deleteResponse: any) => {
              userAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data.deleted).to.eq(true)
              cy.log('4. Deleted user')

              // 5. VERIFY deletion
              userAPI.getUserById(createdUser.id).then((finalResponse: any) => {
                expect(finalResponse.status).to.eq(404)
                cy.log('5. Verified deletion (404)')
                cy.log('Full CRUD lifecycle with metas completed successfully')
              })
            })
          })
        })
      })
    })

    it('USERS_META_101: Should handle multiple sequential updates (accumulative merge)', () => {
      // Create user
      const userData = userAPI.generateRandomUserData({
        firstName: 'SequentialMeta'
      })

      userAPI.createUser(userData).then((createResponse: any) => {
        const userId = createResponse.body.data.id
        createdUsers.push(createResponse.body.data)

        // Update 1: Add uiPreferences
        const update1 = {
          metas: {
            uiPreferences: { theme: 'dark' }
          }
        }

        userAPI.updateUser(userId, update1).then((response1: any) => {
          expect(response1.body.data.metas.uiPreferences.theme).to.eq('dark')
          cy.log('Update 1: Added uiPreferences.theme')

          // Update 2: Add more to uiPreferences
          const update2 = {
            metas: {
              uiPreferences: { language: 'es' }
            }
          }

          userAPI.updateUser(userId, update2).then((response2: any) => {
            expect(response2.body.data.metas.uiPreferences.theme).to.eq('dark')    // Still there
            expect(response2.body.data.metas.uiPreferences.language).to.eq('es')  // Added
            cy.log('Update 2: Added uiPreferences.language (theme preserved)')

            // Update 3: Add new group
            const update3 = {
              metas: {
                securityPreferences: { twoFactorEnabled: true }
              }
            }

            userAPI.updateUser(userId, update3).then((response3: any) => {
              expect(response3.body.data.metas.uiPreferences.theme).to.eq('dark')
              expect(response3.body.data.metas.uiPreferences.language).to.eq('es')
              expect(response3.body.data.metas.securityPreferences.twoFactorEnabled).to.eq(true)
              cy.log('Update 3: Added securityPreferences (uiPreferences preserved)')

              // Update 4: Modify existing
              const update4 = {
                metas: {
                  uiPreferences: { theme: 'light' }
                }
              }

              userAPI.updateUser(userId, update4).then((response4: any) => {
                expect(response4.body.data.metas.uiPreferences.theme).to.eq('light')  // Modified
                expect(response4.body.data.metas.uiPreferences.language).to.eq('es') // Preserved
                expect(response4.body.data.metas.securityPreferences.twoFactorEnabled).to.eq(true)  // Preserved
                cy.log('Update 4: Modified uiPreferences.theme (all else preserved)')
                cy.log('Sequential updates completed - accumulative merge verified')
              })
            })
          })
        })
      })
    })
  })
})
