/// <reference types="cypress" />

/**
 * DevTools Registries API Tests
 *
 * Tests for the devtools registry endpoints:
 * - GET /api/v1/devtools/features
 * - GET /api/v1/devtools/flows
 * - GET /api/v1/devtools/blocks
 * - GET /api/v1/devtools/testing
 *
 * These endpoints require superadmin or developer user role.
 * Member role users are NOT allowed regardless of team role.
 */

import * as allure from 'allure-cypress'

describe('DevTools Registries API', {
  tags: ['@api', '@feat-devtools', '@security', '@regression']
}, () => {
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Superadmin API key for testing (same as other API tests)
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const INVALID_API_KEY = 'test_invalid_key_placeholder_does_not_exist_00000'

  /**
   * Helper to build headers with API key
   */
  const getHeaders = (apiKey: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    return headers
  }

  beforeEach(() => {
    allure.epic('API')
    allure.feature('DevTools')
  })

  // ============================================================
  // GET /api/v1/devtools/features
  // ============================================================
  describe('GET /api/v1/devtools/features', () => {
    const endpoint = '/api/v1/devtools/features'

    beforeEach(() => {
      allure.story('Features Registry')
    })

    it('DEVTOOLS_API_001: Should return features registry with valid superadmin API key', { tags: '@smoke' }, () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(SUPERADMIN_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')

        // Validate data structure
        const { data } = response.body
        expect(data).to.have.property('features')
        expect(data.features).to.be.an('array')
        expect(data).to.have.property('summary')
        expect(data.summary).to.have.property('total')
        expect(data.summary).to.have.property('withTests')
        expect(data.summary).to.have.property('withoutTests')
        expect(data).to.have.property('meta')
        expect(data.meta).to.have.property('theme')
        expect(data.meta).to.have.property('generatedAt')

        cy.log(`Features: ${data.features.length}, Theme: ${data.meta.theme}`)
      })
    })

    it('DEVTOOLS_API_002: Should return 401 without authentication', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(null),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('error')
        expect(response.body.error).to.have.property('code', 'AUTHENTICATION_REQUIRED')
      })
    })

    it('DEVTOOLS_API_003: Should return 401 with invalid API key', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(INVALID_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })
  })

  // ============================================================
  // GET /api/v1/devtools/flows
  // ============================================================
  describe('GET /api/v1/devtools/flows', () => {
    const endpoint = '/api/v1/devtools/flows'

    beforeEach(() => {
      allure.story('Flows Registry')
    })

    it('DEVTOOLS_API_004: Should return flows registry with valid superadmin API key', { tags: '@smoke' }, () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(SUPERADMIN_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')

        // Validate data structure
        const { data } = response.body
        expect(data).to.have.property('flows')
        expect(data.flows).to.be.an('array')
        expect(data).to.have.property('summary')
        expect(data.summary).to.have.property('total')
        expect(data.summary).to.have.property('withTests')
        expect(data.summary).to.have.property('withoutTests')
        expect(data).to.have.property('meta')

        cy.log(`Flows: ${data.flows.length}`)
      })
    })

    it('DEVTOOLS_API_005: Should return 401 without authentication', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(null),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(response.body.error).to.have.property('code', 'AUTHENTICATION_REQUIRED')
      })
    })

    it('DEVTOOLS_API_006: Should return 401 with invalid API key', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(INVALID_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })
  })

  // ============================================================
  // GET /api/v1/devtools/blocks
  // ============================================================
  describe('GET /api/v1/devtools/blocks', () => {
    const endpoint = '/api/v1/devtools/blocks'

    beforeEach(() => {
      allure.story('Blocks Registry')
    })

    it('DEVTOOLS_API_007: Should return blocks registry with valid superadmin API key', { tags: '@smoke' }, () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(SUPERADMIN_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')

        // Validate data structure
        const { data } = response.body
        expect(data).to.have.property('blocks')
        expect(data.blocks).to.be.an('array')
        expect(data).to.have.property('summary')
        expect(data.summary).to.have.property('total')
        expect(data.summary).to.have.property('withTests')
        expect(data.summary).to.have.property('withoutTests')
        expect(data.summary).to.have.property('categories')
        expect(data.summary.categories).to.be.an('array')
        expect(data).to.have.property('meta')

        // Validate block structure if any blocks exist
        if (data.blocks.length > 0) {
          const block = data.blocks[0]
          expect(block).to.have.property('slug')
          expect(block).to.have.property('name')
          expect(block).to.have.property('category')
          expect(block).to.have.property('testing')
          expect(block.testing).to.have.property('hasTests')
          expect(block.testing).to.have.property('testCount')
          expect(block.testing).to.have.property('tag')
        }

        cy.log(`Blocks: ${data.blocks.length}, Categories: ${data.summary.categories.join(', ')}`)
      })
    })

    it('DEVTOOLS_API_008: Should return 401 without authentication', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(null),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(response.body.error).to.have.property('code', 'AUTHENTICATION_REQUIRED')
      })
    })

    it('DEVTOOLS_API_009: Should return 401 with invalid API key', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(INVALID_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })
  })

  // ============================================================
  // GET /api/v1/devtools/testing
  // ============================================================
  describe('GET /api/v1/devtools/testing', () => {
    const endpoint = '/api/v1/devtools/testing'

    beforeEach(() => {
      allure.story('Testing Registry')
    })

    it('DEVTOOLS_API_010: Should return testing/tags registry with valid superadmin API key', { tags: '@smoke' }, () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(SUPERADMIN_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body).to.have.property('data')

        // Validate data structure
        const { data } = response.body
        expect(data).to.have.property('tags')
        expect(data.tags).to.be.an('object')
        expect(data).to.have.property('summary')
        expect(data.summary).to.have.property('totalTags')
        expect(data.summary).to.have.property('testFiles')
        expect(data.summary).to.have.property('byCategory')
        expect(data.summary.byCategory).to.be.an('object')
        expect(data.summary).to.have.property('features')
        expect(data.summary).to.have.property('flows')
        expect(data).to.have.property('meta')

        cy.log(`Total tags: ${data.summary.totalTags}, Test files: ${data.summary.testFiles}`)
      })
    })

    it('DEVTOOLS_API_011: Should return 401 without authentication', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(null),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
        expect(response.body.error).to.have.property('code', 'AUTHENTICATION_REQUIRED')
      })
    })

    it('DEVTOOLS_API_012: Should return 401 with invalid API key', () => {
      allure.severity('critical')

      cy.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: getHeaders(INVALID_API_KEY),
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)
      })
    })
  })

  // ============================================================
  // Cross-endpoint validation
  // ============================================================
  describe('Response Format Consistency', () => {
    beforeEach(() => {
      allure.story('Response Format')
    })

    const endpoints = [
      '/api/v1/devtools/features',
      '/api/v1/devtools/flows',
      '/api/v1/devtools/blocks',
      '/api/v1/devtools/testing'
    ]

    endpoints.forEach((endpoint) => {
      it(`Should have consistent response format for ${endpoint}`, () => {
        cy.request({
          method: 'GET',
          url: `${BASE_URL}${endpoint}`,
          headers: getHeaders(SUPERADMIN_API_KEY),
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(200)

          // All endpoints should have these common properties
          expect(response.body).to.have.property('success', true)
          expect(response.body).to.have.property('data')
          expect(response.body.data).to.have.property('meta')
          expect(response.body.data.meta).to.have.property('theme')
          expect(response.body.data.meta).to.have.property('generatedAt')
        })
      })
    })
  })
})
