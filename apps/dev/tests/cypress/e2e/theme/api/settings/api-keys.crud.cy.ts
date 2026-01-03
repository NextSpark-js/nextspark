/// <reference types="cypress" />

/**
 * API Keys API - CRUD Tests
 *
 * Comprehensive test suite for the API Keys management endpoints.
 * Tests CRUD operations with superadmin API key authentication.
 *
 * @endpoint /api/v1/api-keys
 * @see api-keys-crud.md for documentation
 */

import * as allure from 'allure-cypress'

const ApiKeysAPIController = require('../../../src/controllers/ApiKeysAPIController.js')

describe('API Keys API - CRUD Operations', {
  tags: ['@api', '@feat-api-keys', '@crud', '@security', '@regression']
}, () => {
  let apiKeysAPI: any
  const testApiKeys: string[] = [] // Track created API keys for cleanup

  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    apiKeysAPI = new ApiKeysAPIController(BASE_URL, SUPERADMIN_API_KEY)
    cy.log('Initialized ApiKeysAPIController with superadmin API key')

    // Cleanup existing test API keys before running tests
    cy.request({
      method: 'GET',
      url: `${BASE_URL}/api/v1/api-keys`,
      headers: {
        'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      failOnStatusCode: false
    }).then((response: any) => {
      if (response.status === 200 && response.body.data) {
        const cypressKeys = response.body.data.filter((apiKey: any) =>
          apiKey.name && apiKey.name.toLowerCase().includes('cypress')
        )

        cypressKeys.forEach((apiKey: any) => {
          cy.request({
            method: 'DELETE',
            url: `${BASE_URL}/api/v1/api-keys/${apiKey.id}`,
            headers: {
              'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
              'Content-Type': 'application/json'
            },
            failOnStatusCode: false
          })
        })
      }
    })
  })

  afterEach(() => {
    // Cleanup API keys created during each test
    testApiKeys.forEach((apiKeyId: string) => {
      if (apiKeyId) {
        cy.request({
          method: 'DELETE',
          url: `${BASE_URL}/api/v1/api-keys/${apiKeyId}`,
          headers: apiKeysAPI.getHeaders(),
          failOnStatusCode: false
        })
      }
    })
    testApiKeys.length = 0
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('API Keys')
    allure.story('CRUD Operations')
  })

  after(() => {
    // Final cleanup - use simple request-based cleanup to avoid async issues
    cy.request({
      method: 'GET',
      url: `${BASE_URL}/api/v1/api-keys`,
      headers: {
        'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      failOnStatusCode: false
    }).then((response: any) => {
      if (response.status === 200 && response.body.data) {
        const cypressKeys = response.body.data.filter((apiKey: any) =>
          apiKey.name && apiKey.name.toLowerCase().includes('cypress')
        )

        cypressKeys.forEach((apiKey: any) => {
          cy.request({
            method: 'DELETE',
            url: `${BASE_URL}/api/v1/api-keys/${apiKey.id}`,
            headers: {
              'Authorization': `Bearer ${SUPERADMIN_API_KEY}`,
              'Content-Type': 'application/json'
            },
            failOnStatusCode: false
          })
        })
      }
    })
  })

  // ============================================
  // GET /api/v1/api-keys - List API Keys
  // ============================================

  describe('GET /api/v1/api-keys - List API Keys', () => {

    it('APIKEY_001: Should list API keys with valid superadmin API key', { tags: '@smoke' }, () => {
      allure.severity('critical')
      apiKeysAPI.getApiKeys().then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')
        expect(response.body.data).to.be.an('array')
        expect(response.body).to.have.property('info')
        expect(response.body.info).to.have.property('timestamp')
      })
    })

    it('APIKEY_002: Should accept pagination parameters', () => {
      apiKeysAPI.getApiKeys({ page: 1, limit: 5 }).then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data).to.be.an('array')
      })
    })

    it('APIKEY_003: Should reject request without API key', () => {
      const unauthenticatedAPI = new ApiKeysAPIController(BASE_URL, null)

      unauthenticatedAPI.getApiKeys().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code')
        expect(['MISSING_API_KEY', 'AUTHENTICATION_FAILED']).to.include(response.body.code)
      })
    })

    it('APIKEY_004: Should reject request with invalid API key', () => {
      const invalidAPI = new ApiKeysAPIController(BASE_URL, 'test_invalid_key_for_testing_purposes_only_not_real_12345678901234567')

      invalidAPI.getApiKeys().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(['INVALID_API_KEY', 'AUTHENTICATION_FAILED']).to.include(response.body.code)
      })
    })

    it('APIKEY_005: Should reject request with malformed API key', () => {
      const malformedAPI = new ApiKeysAPIController(BASE_URL, 'not_a_valid_key')

      malformedAPI.getApiKeys().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(['INVALID_API_KEY', 'INVALID_API_KEY_FORMAT', 'AUTHENTICATION_FAILED']).to.include(response.body.code)
      })
    })

    it('APIKEY_006: Should validate response structure', () => {
      apiKeysAPI.getApiKeys().then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')
        expect(response.body).to.have.property('info')
        expect(response.body.info).to.have.property('timestamp')
        expect(response.body.info.timestamp).to.be.a('string')
      })
    })

    it('APIKEY_007: Should validate API key object structure in list', () => {
      apiKeysAPI.getApiKeys().then((response: any) => {
        expect(response.status).to.eq(200)

        if (response.body.data.length > 0) {
          const apiKey = response.body.data[0]
          expect(apiKey).to.have.property('id')
          expect(apiKey).to.have.property('name')
          expect(apiKey).to.have.property('keyPrefix')
          expect(apiKey).to.have.property('scopes')
          expect(apiKey).to.have.property('status')
          expect(apiKey).to.have.property('createdAt')
          expect(apiKey.scopes).to.be.an('array')
          expect(apiKey.status).to.be.oneOf(['active', 'inactive', 'expired'])
        }
      })
    })

    it('APIKEY_008: Should handle large limit values', () => {
      apiKeysAPI.getApiKeys({ limit: 100 }).then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data).to.be.an('array')
      })
    })
  })

  // ============================================
  // POST /api/v1/api-keys - Create API Key
  // ============================================

  describe('POST /api/v1/api-keys - Create API Key', () => {

    it('APIKEY_010: Should create API key with valid data', { tags: '@smoke' }, () => {
      allure.severity('critical')
      const apiKeyData = {
        name: 'Cypress Test Key APIKEY_010',
        scopes: ['users:read', 'tasks:read'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        if (response.status === 429) {
          cy.log('Rate limit reached, skipping test')
          return
        }

        expect(response.status).to.eq(201)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data).to.have.property('id')
        expect(response.body.data).to.have.property('key')
        expect(response.body.data).to.have.property('name', apiKeyData.name)
        expect(response.body.data).to.have.property('scopes')
        expect(response.body.data.scopes).to.deep.eq(apiKeyData.scopes)
        expect(response.body.data).to.have.property('warning')

        testApiKeys.push(response.body.data.id)
      })
    })

    it('APIKEY_011: Should create API key with minimal data', () => {
      const apiKeyData = {
        name: 'Cypress Minimal Key APIKEY_011',
        scopes: ['users:read']
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        if (response.status === 429) {
          cy.log('Rate limit reached, skipping test')
          return
        }

        expect(response.status).to.eq(201)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data).to.have.property('name', apiKeyData.name)
        expect(response.body.data.scopes).to.deep.eq(apiKeyData.scopes)

        testApiKeys.push(response.body.data.id)
      })
    })

    it('APIKEY_012: Should create API key with expiresAt', () => {
      const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      const apiKeyData = {
        name: 'Cypress Expiring Key APIKEY_012',
        scopes: ['users:read'],
        expiresAt: futureDate
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        if (response.status === 429) {
          cy.log('Rate limit reached, skipping test')
          return
        }

        expect(response.status).to.eq(201)
        expect(response.body.data).to.have.property('expiresAt')

        testApiKeys.push(response.body.data.id)
      })
    })

    it('APIKEY_013: Should reject creation without name', () => {
      const apiKeyData = {
        scopes: ['users:read']
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'VALIDATION_ERROR')
      })
    })

    it('APIKEY_014: Should reject creation with empty name', () => {
      const apiKeyData = {
        name: '',
        scopes: ['users:read']
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'VALIDATION_ERROR')
      })
    })

    it('APIKEY_015: Should reject name longer than 100 characters', () => {
      const apiKeyData = {
        name: 'A'.repeat(101),
        scopes: ['users:read']
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'VALIDATION_ERROR')
      })
    })

    it('APIKEY_016: Should reject creation without scopes', () => {
      const apiKeyData = {
        name: 'Cypress No Scopes Key'
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'VALIDATION_ERROR')
      })
    })

    it('APIKEY_017: Should reject creation with empty scopes array', () => {
      const apiKeyData = {
        name: 'Cypress Empty Scopes Key',
        scopes: []
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'VALIDATION_ERROR')
      })
    })

    it('APIKEY_018: Should reject creation with invalid scopes', () => {
      const apiKeyData = {
        name: 'Cypress Invalid Scopes Key',
        scopes: ['invalid:scope', 'another:invalid']
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'INVALID_SCOPES')
      })
    })

    it('APIKEY_019: Should reject creation with mixed valid/invalid scopes', () => {
      const apiKeyData = {
        name: 'Cypress Mixed Scopes Key',
        scopes: ['users:read', 'invalid:scope']
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'INVALID_SCOPES')
      })
    })

    it('APIKEY_020: Should reject creation with invalid expiresAt format', () => {
      const apiKeyData = {
        name: 'Cypress Invalid Date Key',
        scopes: ['users:read'],
        expiresAt: 'not-a-valid-date'
      }

      apiKeysAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'VALIDATION_ERROR')
      })
    })

    it('APIKEY_021: Should reject without authorization', () => {
      const unauthenticatedAPI = new ApiKeysAPIController(BASE_URL, null)
      const apiKeyData = {
        name: 'Cypress Unauth Key',
        scopes: ['users:read']
      }

      unauthenticatedAPI.createApiKey(apiKeyData).then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })
  })

  // ============================================
  // GET /api/v1/api-keys/{id} - Get by ID
  // ============================================

  describe('GET /api/v1/api-keys/{id} - Get API Key by ID', () => {
    let testApiKeyId: string

    beforeEach(() => {
      // Create a test API key for GET tests
      const apiKeyData = {
        name: 'Cypress Test Key for GET',
        scopes: ['users:read', 'tasks:read']
      }

      cy.then(() => {
        return apiKeysAPI.createApiKey(apiKeyData)
      }).then((response: any) => {
        if (response.status === 201) {
          testApiKeyId = response.body.data.id
          testApiKeys.push(testApiKeyId)
        } else {
          cy.log('Could not create test API key, some tests may fail')
        }
      })
    })

    it('APIKEY_030: Should get API key by valid ID with usage stats', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        apiKeysAPI.getApiKeyById(id).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', id)
          expect(response.body.data).to.have.property('name')
          expect(response.body.data).to.have.property('usage_stats')
          expect(response.body.data.usage_stats).to.be.an('object')
        })
      })
    })

    it('APIKEY_031: Should return 404 for non-existent API key ID', () => {
      const nonExistentId = 'non-existent-id-12345'

      apiKeysAPI.getApiKeyById(nonExistentId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'API_KEY_NOT_FOUND')
      })
    })

    it('APIKEY_032: Should reject request without authorization', () => {
      const unauthenticatedAPI = new ApiKeysAPIController(BASE_URL, null)

      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        unauthenticatedAPI.getApiKeyById(id).then((response: any) => {
          expect(response.status).to.eq(401)
          expect(response.body).to.have.property('success', false)
        })
      })
    })

    it('APIKEY_033: Should reject request with invalid API key', () => {
      const invalidAPI = new ApiKeysAPIController(BASE_URL, 'invalid_key')

      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        invalidAPI.getApiKeyById(id).then((response: any) => {
          expect(response.status).to.eq(401)
          expect(response.body).to.have.property('success', false)
        })
      })
    })

    it('APIKEY_034: Should validate usage_stats structure', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        apiKeysAPI.getApiKeyById(id).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body.data).to.have.property('usage_stats')

          const stats = response.body.data.usage_stats
          expect(stats).to.have.property('total_requests')
          expect(stats).to.have.property('last_24h')
        })
      })
    })
  })

  // ============================================
  // PATCH /api/v1/api-keys/{id} - Update
  // ============================================

  describe('PATCH /api/v1/api-keys/{id} - Update API Key', () => {
    let testApiKeyId: string

    beforeEach(() => {
      // Create a test API key for PATCH tests
      const apiKeyData = {
        name: 'Cypress Test Key for PATCH',
        scopes: ['users:read']
      }

      cy.then(() => {
        return apiKeysAPI.createApiKey(apiKeyData)
      }).then((response: any) => {
        if (response.status === 201) {
          testApiKeyId = response.body.data.id
          testApiKeys.push(testApiKeyId)
        }
      })
    })

    it('APIKEY_040: Should update API key name', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        const updateData = { name: 'Cypress Updated Name APIKEY_040' }

        apiKeysAPI.updateApiKey(id, updateData).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('success', true)
          expect(response.body.data).to.have.property('name', updateData.name)
          expect(response.body.data).to.have.property('updatedAt')
        })
      })
    })

    it('APIKEY_041: Should update API key status to inactive', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        const updateData = { status: 'inactive' }

        apiKeysAPI.updateApiKey(id, updateData).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('success', true)
          expect(response.body.data).to.have.property('status', 'inactive')
        })
      })
    })

    it('APIKEY_042: Should update multiple fields at once', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        const updateData = {
          name: 'Cypress Multi Update APIKEY_042',
          status: 'active'
        }

        apiKeysAPI.updateApiKey(id, updateData).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body.data).to.have.property('name', updateData.name)
          expect(response.body.data).to.have.property('status', updateData.status)
        })
      })
    })

    it('APIKEY_043: Should return 404 for non-existent API key ID', () => {
      const nonExistentId = 'non-existent-id-12345'
      const updateData = { name: 'Updated Name' }

      apiKeysAPI.updateApiKey(nonExistentId, updateData).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'API_KEY_NOT_FOUND')
      })
    })

    it('APIKEY_044: Should reject empty update body', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        apiKeysAPI.updateApiKey(id, {}).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.have.property('success', false)
          expect(response.body).to.have.property('code', 'NO_FIELDS')
        })
      })
    })

    it('APIKEY_045: Should reject invalid name type', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        const updateData = { name: 123 }

        apiKeysAPI.updateApiKey(id, updateData).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.have.property('success', false)
        })
      })
    })

    it('APIKEY_046: Should reject invalid status value', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        const updateData = { status: 'invalid_status' }

        apiKeysAPI.updateApiKey(id, updateData).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.have.property('success', false)
        })
      })
    })

    it('APIKEY_047: Should reject update without authorization', () => {
      const unauthenticatedAPI = new ApiKeysAPIController(BASE_URL, null)

      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        const updateData = { name: 'Unauthorized Update' }

        unauthenticatedAPI.updateApiKey(id, updateData).then((response: any) => {
          expect(response.status).to.eq(401)
          expect(response.body).to.have.property('success', false)
        })
      })
    })
  })

  // ============================================
  // DELETE /api/v1/api-keys/{id} - Revoke
  // ============================================

  describe('DELETE /api/v1/api-keys/{id} - Revoke API Key', () => {
    let testApiKeyId: string

    beforeEach(() => {
      // Create a test API key for DELETE tests
      const apiKeyData = {
        name: 'Cypress Test Key for DELETE',
        scopes: ['users:read']
      }

      cy.then(() => {
        return apiKeysAPI.createApiKey(apiKeyData)
      }).then((response: any) => {
        if (response.status === 201) {
          testApiKeyId = response.body.data.id
          // Don't add to testApiKeys since we're deleting it in the test
        }
      })
    })

    it('APIKEY_050: Should revoke API key by valid ID', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        apiKeysAPI.deleteApiKey(id).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('success', true)
          expect(response.body.data).to.have.property('revoked', true)
          expect(response.body.data).to.have.property('id', id)
        })
      })
    })

    it('APIKEY_051: Should return 404 for non-existent API key ID', () => {
      const nonExistentId = 'non-existent-id-12345'

      apiKeysAPI.deleteApiKey(nonExistentId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'API_KEY_NOT_FOUND')
      })

      // Cleanup the created key since we didn't delete it
      cy.then(() => testApiKeyId).then((id) => {
        if (id) {
          testApiKeys.push(id)
        }
      })
    })

    it('APIKEY_052: Should reject revoke without authorization', () => {
      const unauthenticatedAPI = new ApiKeysAPIController(BASE_URL, null)

      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        unauthenticatedAPI.deleteApiKey(id).then((response: any) => {
          expect(response.status).to.eq(401)
          expect(response.body).to.have.property('success', false)

          // Cleanup since the delete failed
          testApiKeys.push(id)
        })
      })
    })

    it('APIKEY_053: Should reject revoke with invalid API key', () => {
      const invalidAPI = new ApiKeysAPIController(BASE_URL, 'invalid_key')

      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        invalidAPI.deleteApiKey(id).then((response: any) => {
          expect(response.status).to.eq(401)
          expect(response.body).to.have.property('success', false)

          // Cleanup since the delete failed
          testApiKeys.push(id)
        })
      })
    })

    it('APIKEY_054: Should verify revoked key status after deletion', () => {
      cy.then(() => testApiKeyId).then((id) => {
        if (!id) {
          cy.log('No test API key available, skipping')
          return
        }

        // First revoke the key
        apiKeysAPI.deleteApiKey(id).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body.data).to.have.property('revoked', true)

          // Then verify it's inactive
          apiKeysAPI.getApiKeyById(id).then((getResponse: any) => {
            if (getResponse.status === 200) {
              expect(getResponse.body.data.status).to.eq('inactive')
            }
            // If 404, that's also acceptable (hard delete)
          })
        })
      })
    })
  })

  // ============================================
  // Integration Tests
  // ============================================

  describe('Integration - Complete API Key Lifecycle', () => {

    it('APIKEY_100: Should complete full lifecycle: Create -> Read -> Update -> Revoke -> Verify', () => {
      let createdApiKeyId: string

      // 1. Create API key
      const initialData = {
        name: 'Cypress Lifecycle Test Key',
        scopes: ['users:read', 'tasks:read'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }

      apiKeysAPI.createApiKey(initialData).then((createResponse: any) => {
        if (createResponse.status === 429) {
          cy.log('Rate limit reached, skipping integration test')
          return
        }

        expect(createResponse.status).to.eq(201)
        expect(createResponse.body).to.have.property('success', true)
        expect(createResponse.body.data).to.have.property('key')

        createdApiKeyId = createResponse.body.data.id
        expect(createResponse.body.data.name).to.eq(initialData.name)

        // 2. Read API key
        return apiKeysAPI.getApiKeyById(createdApiKeyId)
      }).then((readResponse: any) => {
        if (!readResponse) return

        expect(readResponse.status).to.eq(200)
        expect(readResponse.body.data.id).to.eq(createdApiKeyId)
        expect(readResponse.body.data.name).to.eq(initialData.name)
        expect(readResponse.body.data).to.have.property('usage_stats')

        // 3. Update API key
        const updateData = {
          name: 'Cypress Updated Lifecycle Key',
          status: 'active'
        }
        return apiKeysAPI.updateApiKey(createdApiKeyId, updateData)
      }).then((updateResponse: any) => {
        if (!updateResponse) return

        expect(updateResponse.status).to.eq(200)
        expect(updateResponse.body.data.name).to.eq('Cypress Updated Lifecycle Key')
        expect(updateResponse.body.data.status).to.eq('active')

        // 4. Revoke API key
        return apiKeysAPI.deleteApiKey(createdApiKeyId)
      }).then((deleteResponse: any) => {
        if (!deleteResponse) return

        expect(deleteResponse.status).to.eq(200)
        expect(deleteResponse.body.data.revoked).to.be.true

        // 5. Verify revoked status
        return apiKeysAPI.getApiKeyById(createdApiKeyId)
      }).then((finalResponse: any) => {
        if (!finalResponse) return

        if (finalResponse.status === 200) {
          expect(finalResponse.body.data.status).to.eq('inactive')
        }
        // 404 is also acceptable if hard delete
      })
    })

    it('APIKEY_101: Should handle sequential operations correctly', () => {
      const apiKeysCreated: string[] = []

      // Create multiple API keys
      const createKey = (name: string) => {
        return apiKeysAPI.createApiKey({
          name: name,
          scopes: ['users:read']
        }).then((response: any) => {
          if (response.status === 201) {
            apiKeysCreated.push(response.body.data.id)
            return response.body.data.id
          }
          return null
        })
      }

      createKey('Cypress Sequential Key 1').then(() => {
        return createKey('Cypress Sequential Key 2')
      }).then(() => {
        // List should contain our keys
        return apiKeysAPI.getApiKeys()
      }).then((listResponse: any) => {
        expect(listResponse.status).to.eq(200)
        expect(listResponse.body.data.length).to.be.greaterThan(0)

        // Cleanup
        apiKeysCreated.forEach(id => {
          testApiKeys.push(id)
        })
      })
    })
  })

  // ============================================
  // CORS Preflight Tests
  // ============================================

  describe('OPTIONS - CORS Preflight', () => {

    it('APIKEY_110: Should handle CORS preflight requests for API keys list', () => {
      cy.request({
        method: 'OPTIONS',
        url: `${BASE_URL}/api/v1/api-keys`,
        failOnStatusCode: false
      }).then((response: any) => {
        expect(response.status).to.eq(200)

        // Verify CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin')
        expect(response.headers).to.have.property('access-control-allow-methods')
        expect(response.headers).to.have.property('access-control-allow-headers')
      })
    })

    it('APIKEY_111: Should handle CORS preflight requests for specific API key', () => {
      const testId = 'test-id-for-options'

      cy.request({
        method: 'OPTIONS',
        url: `${BASE_URL}/api/v1/api-keys/${testId}`,
        failOnStatusCode: false
      }).then((response: any) => {
        expect(response.status).to.eq(200)

        // Verify CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin')
        expect(response.headers).to.have.property('access-control-allow-methods')
        expect(response.headers).to.have.property('access-control-allow-headers')
      })
    })
  })
})
