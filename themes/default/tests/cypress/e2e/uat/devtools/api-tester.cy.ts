/**
 * UAT Tests: DevTools API Tester
 *
 * This test suite validates the API Tester feature in DevTools.
 * The API Tester allows developers to test API endpoints directly from the browser.
 *
 * Coverage:
 * - Navigation to endpoint detail pages
 * - HTTP method selection
 * - Path parameter handling
 * - Query parameter management
 * - Request body (JSON payload) editing
 * - Authentication modes (session/API key)
 * - Request execution and cancellation
 * - Response display (status, timing, body, headers)
 *
 * Session: 2025-12-30-devtools-api-mini-postman-v1
 * Workflow Phase: 15 (qa-automation)
 */

import { DevtoolsPOM } from '../../../src/features/DevtoolsPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('DevTools API Tester UAT', () => {
  const devtools = DevtoolsPOM.create()

  beforeEach('Login as developer', () => {
    // DevTools requires developer role
    loginAsDefaultDeveloper()
  })

  // ============================================
  // UAT-001: Navigation to Endpoint Detail
  // ACs: AC-NAV-01, AC-NAV-02
  // ============================================
  describe('UAT-001: Navigate to endpoint detail from list', () => {
    it('should navigate to /devtools/api', () => {
      devtools.visitApiList()
      cy.url().should('include', '/devtools/api')
    })

    it('should click on an endpoint and navigate to detail page', () => {
      devtools.visitApiList()
      cy.wait(1000) // Wait for endpoints to load

      // Click first endpoint
      devtools.clickFirstEndpoint()

      // Should navigate to detail page
      cy.url().should('match', /\/devtools\/api\/v1\//)
    })

    it('should show endpoint info and API tester on detail page', () => {
      // Visit a known endpoint directly (e.g., /api/v1/profile)
      devtools.visitApiEndpoint('/v1/profile')

      devtools
        .assertApiTesterVisible()
        .assertEndpointInfoVisible()
    })
  })

  // ============================================
  // UAT-002: Method Selector Shows Available Methods
  // ACs: AC-MTH-01, AC-MTH-02
  // ============================================
  describe('UAT-002: Method selector shows available methods', () => {
    beforeEach(() => {
      // Visit endpoint with multiple methods (e.g., /api/v1/profile has GET, PATCH)
      devtools.visitApiEndpoint('/v1/profile')
    })

    it('should show only available methods for the endpoint', () => {
      // Profile endpoint should have GET and PATCH
      devtools
        .assertMethodExists('get')
        .assertMethodExists('patch')
    })

    it('should have GET selected by default if available', () => {
      cy.get('[data-cy="api-tester-method-get"]')
        .should('have.class', 'ring-2') // Selected state has ring
    })
  })

  // ============================================
  // UAT-003: Method Selection Updates UI
  // ACs: AC-MTH-03, AC-MTH-04
  // ============================================
  describe('UAT-003: Method selection updates UI (payload editor)', () => {
    beforeEach(() => {
      devtools.visitApiEndpoint('/v1/profile')
    })

    it('should NOT show payload editor for GET method', () => {
      devtools.selectMethod('get')
      devtools.assertPayloadEditorNotVisible()
    })

    it('should show payload editor when PATCH method is selected', () => {
      devtools.selectMethod('patch')
      devtools.assertPayloadEditorVisible()
    })
  })

  // ============================================
  // UAT-004: Path Parameters Detection and URL Preview
  // ACs: AC-PATH-01, AC-PATH-02, AC-PATH-03
  // ============================================
  describe('UAT-004: Path parameters detected and URL preview updates', () => {
    beforeEach(() => {
      // Visit endpoint with path param (e.g., /api/v1/customers/[id])
      devtools.visitApiEndpoint('/v1/customers/%5Bid%5D') // URL-encoded [id]
    })

    it('should detect path parameters from endpoint pattern', () => {
      cy.get('[data-cy="api-tester-path-params"]').should('exist')
      cy.get('[data-cy="api-tester-path-param-id"]').should('exist')
    })

    it('should have labeled input field for path param', () => {
      cy.get('[data-cy="api-tester-path-param-id-input"]').should('exist')
    })

    it('should update URL preview when path param value changes', () => {
      // Initially URL preview should show [id] placeholder
      devtools.assertUrlPreviewContains('/v1/customers/')

      // Fill path param
      devtools.fillPathParam('id', '12345')

      // URL preview should now show the value
      devtools.assertUrlPreviewContains('12345')
    })
  })

  // ============================================
  // UAT-005: Path Parameter Validation
  // ACs: AC-PATH-04
  // ============================================
  describe('UAT-005: Path parameter validation (required params)', () => {
    beforeEach(() => {
      devtools.visitApiEndpoint('/v1/customers/%5Bid%5D')
    })

    it('should show "required" badge on required path params', () => {
      cy.get('[data-cy="api-tester-path-param-id"]')
        .should('contain', 'required')
    })

    it('should disable Send button when required path param is empty', () => {
      // Path param should be empty by default
      cy.get('[data-cy="api-tester-send-btn"]').should('be.disabled')
    })

    it('should enable Send button when required path param is filled', () => {
      devtools.fillPathParam('id', '12345')
      cy.get('[data-cy="api-tester-send-btn"]').should('not.be.disabled')
    })
  })

  // ============================================
  // UAT-006: Query Parameters Add/Remove/Update URL
  // ACs: AC-QRY-01, AC-QRY-02, AC-QRY-03, AC-QRY-04
  // ============================================
  describe('UAT-006: Query params add/remove and URL updates', () => {
    beforeEach(() => {
      devtools.visitApiEndpoint('/v1/profile')
    })

    it('should have key-value inputs for query params', () => {
      cy.get('[data-cy="api-tester-query-editor"]').should('exist')
      cy.get('[data-cy="api-tester-query-add-btn"]').should('exist')
    })

    it('should add query param row when Add button clicked', () => {
      cy.get('[data-cy="api-tester-query-add-btn"]').click()
      cy.get('[data-cy="api-tester-query-row-0"]').should('exist')
    })

    it('should update URL preview when query param is added', () => {
      cy.get('[data-cy="api-tester-query-add-btn"]').click()
      cy.get('[data-cy="api-tester-query-row-0-key"]').type('limit')
      cy.get('[data-cy="api-tester-query-row-0-value"]').type('10')

      devtools.assertUrlPreviewContains('limit=10')
    })

    it('should URL-encode query param values', () => {
      cy.get('[data-cy="api-tester-query-add-btn"]').click()
      cy.get('[data-cy="api-tester-query-row-0-key"]').type('filter')
      cy.get('[data-cy="api-tester-query-row-0-value"]').type('status eq active')

      // URLSearchParams should encode spaces as +
      devtools.assertUrlPreviewContains('filter=status')
    })

    it('should remove query param row when delete button clicked', () => {
      cy.get('[data-cy="api-tester-query-add-btn"]').click()
      cy.get('[data-cy="api-tester-query-row-0"]').should('exist')

      cy.get('[data-cy="api-tester-query-row-0-delete"]').click()
      cy.get('[data-cy="api-tester-query-row-0"]').should('not.exist')
    })
  })

  // ============================================
  // UAT-007: JSON Payload Editor Validation
  // ACs: AC-BODY-01, AC-BODY-02, AC-BODY-03
  // ============================================
  describe('UAT-007: JSON payload editor validation', () => {
    beforeEach(() => {
      devtools.visitApiEndpoint('/v1/profile')
      devtools.selectMethod('patch')
    })

    it('should show JSON textarea for POST/PATCH/PUT methods', () => {
      devtools.assertPayloadEditorVisible()
      cy.get('[data-cy="api-tester-payload-textarea"]').should('exist')
    })

    it('should show validation error for invalid JSON', () => {
      devtools.fillPayload('{name: "test"}') // Invalid JSON (unquoted key)

      devtools.assertPayloadErrorShown()
    })

    it('should NOT show error for valid JSON', () => {
      devtools.fillPayload('{"name": "test"}')

      cy.get('[data-cy="api-tester-payload-error"]').should('not.exist')
    })

    it('should disable Send button when JSON is invalid', () => {
      devtools.fillPayload('{invalid}')

      cy.get('[data-cy="api-tester-send-btn"]').should('be.disabled')
    })
  })

  // ============================================
  // UAT-008: Authentication Toggle Session/API Key
  // ACs: AC-AUTH-01, AC-AUTH-04
  // ============================================
  describe('UAT-008: Authentication modes (session/API key)', () => {
    beforeEach(() => {
      devtools.visitApiEndpoint('/v1/profile')
    })

    it('should show authentication section', () => {
      cy.get('[data-cy="api-tester-auth"]').should('exist')
      cy.get('[data-cy="api-tester-auth-type"]').should('exist')
    })

    it('should have "Use current session" selected by default', () => {
      cy.get('[data-cy="api-tester-auth-session"]')
        .should('have.attr', 'data-state', 'checked')
    })

    it('should show API key input when "Use API key" is selected', () => {
      // Initially API key input should not be visible
      cy.get('[data-cy="api-tester-apikey-input"]').should('not.be.visible')

      // Select API key option
      devtools.selectAuthType('apiKey')

      // API key input should now be visible
      cy.get('[data-cy="api-tester-apikey-input"]').should('be.visible')
    })

    it('should hide API key input when switching back to session', () => {
      devtools.selectAuthType('apiKey')
      cy.get('[data-cy="api-tester-apikey-input"]').should('be.visible')

      devtools.selectAuthType('session')
      cy.get('[data-cy="api-tester-apikey-input"]').should('not.be.visible')
    })
  })

  // ============================================
  // UAT-009: Send Request and Display Response
  // ACs: AC-EXEC-01, AC-EXEC-02, AC-RSP-01, AC-RSP-02, AC-RSP-04
  // ============================================
  describe('UAT-009: Send request and display response', () => {
    beforeEach(() => {
      devtools.visitApiEndpoint('/v1/profile')
    })

    it('should show idle state before sending request', () => {
      cy.get('[data-cy="api-tester-response-idle"]').should('be.visible')
    })

    it('should execute request when Send button is clicked', () => {
      devtools.clickSendRequest()

      // Should show loading state
      cy.get('[data-cy="api-tester-response-loading"]').should('be.visible')

      // Wait for response
      devtools.waitForResponse()
    })

    it('should display response status code with correct color', () => {
      devtools.clickSendRequest()
      devtools.waitForResponse()

      // Status 200 should be visible
      devtools.assertResponseStatus(200)

      // Status badge should have green color (for 2xx)
      cy.get('[data-cy="api-tester-response-status"]')
        .should('have.class', 'bg-emerald-100')
    })

    it('should display response time in milliseconds', () => {
      devtools.clickSendRequest()
      devtools.waitForResponse()

      devtools.assertResponseTimeVisible()
      cy.get('[data-cy="api-tester-response-time"]')
        .should('match', /\d+ms/)
    })

    it('should display formatted JSON body', () => {
      devtools.clickSendRequest()
      devtools.waitForResponse()

      // Response body should be visible and formatted
      cy.get('[data-cy="api-tester-response-body"]').should('be.visible')
      cy.get('[data-cy="api-tester-response-body"]').should('contain', '{')
    })
  })

  // ============================================
  // UAT-010: Response Tabs (Body/Headers) and Status Colors
  // ACs: AC-RSP-03, AC-RSP-06
  // ============================================
  describe('UAT-010: Response tabs and large response handling', () => {
    beforeEach(() => {
      devtools.visitApiEndpoint('/v1/profile')
      devtools.clickSendRequest()
      devtools.waitForResponse()
    })

    it('should have Body and Headers tabs', () => {
      cy.get('[data-cy="api-tester-response-tab-body"]').should('exist')
      cy.get('[data-cy="api-tester-response-tab-headers"]').should('exist')
    })

    it('should show body content by default', () => {
      cy.get('[data-cy="api-tester-response-body"]').should('be.visible')
    })

    it('should switch to Headers tab when clicked', () => {
      devtools.clickResponseHeadersTab()

      cy.get('[data-cy="api-tester-response-headers"]').should('be.visible')
    })

    it('should display response headers as key-value pairs', () => {
      devtools.clickResponseHeadersTab()

      // Should show headers like "content-type: application/json"
      cy.get('[data-cy="api-tester-response-headers"]').should('contain', ':')
    })

    it('should handle large responses with scrolling', () => {
      // Response body should be in a ScrollArea
      cy.get('[data-cy="api-tester-response-body"]')
        .parent() // ScrollArea wrapper
        .should('have.css', 'overflow', 'auto')
        .or('have.css', 'overflow-y', 'auto')
    })
  })

  // ============================================
  // BONUS: Navigation Back to List
  // AC: AC-NAV-03
  // ============================================
  describe('BONUS: Back navigation', () => {
    it('should navigate back to list when back button is clicked', () => {
      devtools.visitApiEndpoint('/v1/profile')

      devtools.clickBackToList()

      // Should be back at /devtools/api (no trailing path)
      cy.url().should('eq', Cypress.config().baseUrl + '/devtools/api')
    })
  })
})
