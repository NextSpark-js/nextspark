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
})
