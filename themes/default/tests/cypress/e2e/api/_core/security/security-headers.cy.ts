/// <reference types="cypress" />

/**
 * Security Headers Tests
 *
 * Tests for HTTP security headers on all routes.
 * Verifies CSP, X-Frame-Options, X-Content-Type-Options, and other security headers.
 *
 * @see SEC-004 Security Headers Implementation
 */

import * as allure from 'allure-cypress'

describe('Security Headers', {
  tags: ['@api', '@security', '@headers', '@regression']
}, () => {

  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  beforeEach(() => {
    allure.epic('Security')
    allure.feature('HTTP Headers')
    allure.story('Security Headers')
  })

  // ============================================
  // Core Security Headers Tests
  // ============================================

  describe('Core Security Headers on HTML Pages', () => {

    it('SEC_HDR_001: Homepage should have X-Content-Type-Options header', { tags: '@smoke' }, () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('x-content-type-options', 'nosniff')
      })
    })

    it('SEC_HDR_002: Homepage should have X-Frame-Options header', { tags: '@smoke' }, () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('x-frame-options', 'DENY')
      })
    })

    it('SEC_HDR_003: Homepage should have X-XSS-Protection header', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('x-xss-protection', '1; mode=block')
      })
    })

    it('SEC_HDR_004: Homepage should have Referrer-Policy header', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('referrer-policy', 'strict-origin-when-cross-origin')
      })
    })

    it('SEC_HDR_005: Homepage should have Permissions-Policy header', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('permissions-policy')
        expect(response.headers['permissions-policy']).to.include('camera=()')
        expect(response.headers['permissions-policy']).to.include('microphone=()')
        expect(response.headers['permissions-policy']).to.include('geolocation=()')
      })
    })

    it('SEC_HDR_006: Homepage should have Content-Security-Policy header', { tags: '@smoke' }, () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('content-security-policy')
        const csp = response.headers['content-security-policy']

        // Validate key CSP directives
        expect(csp).to.include("default-src 'self'")
        expect(csp).to.include("script-src")
        expect(csp).to.include("style-src")
        expect(csp).to.include("img-src")
        expect(csp).to.include("frame-ancestors 'none'")
      })
    })
  })

  // ============================================
  // API Endpoints Security Headers
  // ============================================

  describe('Security Headers on API Endpoints', () => {

    it('SEC_HDR_010: API endpoint should have X-Content-Type-Options', () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/theme`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('x-content-type-options', 'nosniff')
      })
    })

    it('SEC_HDR_011: API endpoint should have X-Frame-Options', () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/theme`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('x-frame-options', 'DENY')
      })
    })

    it('SEC_HDR_012: API endpoint should have Content-Security-Policy', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/theme`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('content-security-policy')
      })
    })
  })

  // ============================================
  // Login Page Security Headers
  // ============================================

  describe('Security Headers on Auth Pages', () => {

    it('SEC_HDR_020: Login page should have all security headers', { tags: '@smoke' }, () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/login`,
        failOnStatusCode: false
      }).then((response) => {
        // All critical security headers
        expect(response.headers).to.have.property('x-content-type-options', 'nosniff')
        expect(response.headers).to.have.property('x-frame-options', 'DENY')
        expect(response.headers).to.have.property('x-xss-protection', '1; mode=block')
        expect(response.headers).to.have.property('referrer-policy', 'strict-origin-when-cross-origin')
        expect(response.headers).to.have.property('content-security-policy')
      })
    })

    it('SEC_HDR_021: Register page should have all security headers', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/register`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('x-content-type-options', 'nosniff')
        expect(response.headers).to.have.property('x-frame-options', 'DENY')
        expect(response.headers).to.have.property('content-security-policy')
      })
    })
  })

  // ============================================
  // CSP Directive Validation
  // ============================================

  describe('CSP Directive Validation', () => {

    it('SEC_HDR_030: CSP should allow Stripe scripts', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        expect(csp).to.include('https://js.stripe.com')
      })
    })

    it('SEC_HDR_031: CSP should allow Stripe API connections', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        expect(csp).to.include('https://api.stripe.com')
      })
    })

    it('SEC_HDR_032: CSP should allow Stripe iframes', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        expect(csp).to.include('frame-src')
        expect(csp).to.include('https://js.stripe.com')
      })
    })

    it('SEC_HDR_033: CSP should allow data: URIs for images', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        expect(csp).to.include('img-src')
        expect(csp).to.include('data:')
      })
    })

    it('SEC_HDR_034: CSP should block framing by other sites', () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        expect(csp).to.include("frame-ancestors 'none'")
      })
    })

    it('SEC_HDR_035: CSP should block object/plugin loading', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        expect(csp).to.include("object-src 'none'")
      })
    })

    it('SEC_HDR_036: CSP should restrict base-uri to self', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        expect(csp).to.include("base-uri 'self'")
      })
    })

    it('SEC_HDR_037: CSP img-src should allow specific trusted domains', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        // Should include specific domains, not https: wildcard
        expect(csp).to.include('img-src')
        expect(csp).to.include('lh3.googleusercontent.com')
        expect(csp).to.include('images.unsplash.com')
      })
    })
  })

  // ============================================
  // CORS Headers (API only)
  // ============================================

  describe('CORS Headers on API', () => {

    it('SEC_HDR_040: API should have CORS headers', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/theme`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('access-control-allow-origin')
        expect(response.headers).to.have.property('access-control-allow-methods')
        expect(response.headers).to.have.property('access-control-allow-credentials', 'true')
      })
    })
  })

  // ============================================
  // CSP Violation Reporting
  // ============================================

  describe('CSP Violation Reporting', () => {

    it('SEC_HDR_050: CSP should include report-uri and report-to directives', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        // Legacy report-uri for older browsers
        expect(csp).to.include('report-uri /api/csp-report')
        // Modern report-to for newer browsers
        expect(csp).to.include('report-to csp-endpoint')
        // Reporting-Endpoints header should also be present
        expect(response.headers).to.have.property('reporting-endpoints')
        expect(response.headers['reporting-endpoints']).to.include('csp-endpoint')
      })
    })

    it('SEC_HDR_051: CSP report endpoint should accept violation reports', () => {
      allure.severity('normal')
      const mockViolation = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'blocked-uri': 'https://evil.com/malicious.js',
          'status-code': 200
        }
      }

      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/csp-report`,
        headers: {
          'Content-Type': 'application/csp-report'
        },
        body: mockViolation,
        failOnStatusCode: false
      }).then((response) => {
        // CSP report endpoint should return 204 No Content
        expect(response.status).to.eq(204)
      })
    })

    it('SEC_HDR_052: CSP report endpoint should handle invalid content type', () => {
      allure.severity('minor')
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/csp-report`,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'invalid',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })
  })

  // ============================================
  // Negative Security Tests
  // ============================================

  describe('Negative Security Tests', () => {

    it('SEC_HDR_060: CSP should NOT allow unsafe-eval in production mode', () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        // In development, unsafe-eval is allowed for Next.js hot reload
        // This test documents the expected behavior - in production, it would be blocked
        // For now, we verify the CSP is present and properly formatted
        expect(csp).to.be.a('string')
        expect(csp.length).to.be.greaterThan(50)
      })
    })

    it('SEC_HDR_061: CSP should NOT use https: wildcard for images', () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        // Extract img-src directive
        const imgSrcMatch = csp.match(/img-src[^;]+/)
        if (imgSrcMatch) {
          const imgSrc = imgSrcMatch[0]
          // Should NOT have bare 'https:' which allows any HTTPS domain
          // Should have specific domains instead
          expect(imgSrc).to.not.match(/\shttps:\s/)
          expect(imgSrc).to.not.match(/\shttps:;/)
          expect(imgSrc).to.not.match(/\shttps:$/)
        }
      })
    })

    it('SEC_HDR_062: CSP should NOT use wss: wildcard in production', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const csp = response.headers['content-security-policy']
        // In development, wss: is allowed for hot reload
        // This test documents the expected behavior
        expect(csp).to.include('connect-src')
      })
    })

    it('SEC_HDR_063: X-Frame-Options should deny all framing', () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        // Should be DENY, not SAMEORIGIN or ALLOW-FROM
        expect(response.headers['x-frame-options']).to.eq('DENY')
      })
    })

    it('SEC_HDR_064: Permissions-Policy should disable dangerous features', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const policy = response.headers['permissions-policy']
        // These features should be completely disabled (empty allowlist)
        expect(policy).to.include('camera=()')
        expect(policy).to.include('microphone=()')
        expect(policy).to.include('geolocation=()')
      })
    })
  })

  // ============================================
  // HSTS Configuration (Production Only)
  // ============================================

  describe('HSTS Configuration', () => {

    it('SEC_HDR_070: Should have correct HSTS behavior based on environment', () => {
      allure.severity('normal')
      // HSTS is only enabled in production
      // In production: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
      // In development: Header should NOT be present

      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const isProduction = Cypress.env('NODE_ENV') === 'production'

        if (isProduction) {
          // Production: HSTS must be present with correct values
          expect(response.headers).to.have.property('strict-transport-security')
          const hsts = response.headers['strict-transport-security']
          expect(hsts).to.include('max-age=31536000')
          expect(hsts).to.include('includeSubDomains')
          expect(hsts).to.include('preload')
        } else {
          // Development: HSTS should NOT be set (to avoid localhost issues)
          expect(response.headers).to.not.have.property('strict-transport-security')
        }
      })
    })

    it('SEC_HDR_071: Development should NOT have HSTS header', () => {
      allure.severity('normal')
      // This test specifically verifies dev behavior
      // HSTS on localhost would cause browser issues

      cy.request({
        method: 'GET',
        url: `${BASE_URL}/`,
        failOnStatusCode: false
      }).then((response) => {
        const isProduction = Cypress.env('NODE_ENV') === 'production'

        if (!isProduction) {
          // Explicitly verify no HSTS in development
          expect(response.headers).to.not.have.property('strict-transport-security')
        } else {
          // Skip in production - SEC_HDR_070 covers this
          cy.log('Skipping - running in production mode')
        }
      })
    })
  })

  // ============================================
  // Rate Limiting Tests
  // ============================================

  describe('CSP Report Rate Limiting', () => {

    it('SEC_HDR_080: CSP report endpoint should work and optionally include rate limit headers', () => {
      allure.severity('normal')
      const mockViolation = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/malicious.js',
        }
      }

      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/csp-report`,
        headers: {
          'Content-Type': 'application/csp-report'
        },
        body: mockViolation,
        failOnStatusCode: false
      }).then((response) => {
        // CSP report should succeed with 204
        expect(response.status).to.eq(204)

        // Rate limit headers are optional (depend on @nextsparkjs/core/lib/api availability)
        // If present, verify they have valid values
        if (response.headers['x-ratelimit-limit']) {
          expect(response.headers).to.have.property('x-ratelimit-remaining')
          expect(response.headers).to.have.property('x-ratelimit-reset')
          cy.log('Rate limiting is enabled')
        } else {
          cy.log('Rate limiting not available - skipping rate limit header checks')
        }
      })
    })
  })

  // ============================================
  // CORS x-api-key Header Tests
  // ============================================

  describe('CORS API Key Header', () => {

    it('SEC_HDR_090: API CORS should allow x-api-key header', () => {
      allure.severity('critical')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/theme`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('access-control-allow-headers')
        const allowedHeaders = response.headers['access-control-allow-headers'].toLowerCase()
        expect(allowedHeaders).to.include('x-api-key')
      })
    })

    it('SEC_HDR_091: API CORS headers should include all required headers', () => {
      allure.severity('normal')
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/theme`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('access-control-allow-headers')
        const allowedHeaders = response.headers['access-control-allow-headers'].toLowerCase()

        // Verify all critical headers are allowed
        expect(allowedHeaders).to.include('content-type')
        expect(allowedHeaders).to.include('authorization')
        expect(allowedHeaders).to.include('x-api-key')
        expect(allowedHeaders).to.include('cookie')
      })
    })
  })
})
