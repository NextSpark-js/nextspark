/**
 * Cypress E2E Support File for Theme
 *
 * This file is used when running tests in npm mode (outside monorepo).
 * In monorepo mode, the core support file is used instead via cypress.config.ts.
 *
 * For documentation video commands, install cypress-slow-down:
 *   pnpm add -D cypress-slow-down
 *   Then uncomment the doc-commands import below.
 */

import '@testing-library/cypress/add-commands'

// Import @cypress/grep for test filtering by tags
import registerCypressGrep from '@cypress/grep'
registerCypressGrep()

// Doc commands are optional (require cypress-slow-down)
// Uncomment if you have cypress-slow-down installed:
// import './doc-commands'

// Global error handling
Cypress.on('uncaught:exception', (err) => {
  // Ignore React hydration errors
  if (err.message.includes('Hydration')) {
    return false
  }
  // Ignore ResizeObserver errors
  if (err.message.includes('ResizeObserver')) {
    return false
  }
  return true
})

// Global before hook
beforeEach(() => {
  cy.clearCookies()
  cy.clearLocalStorage()
})

// Type declarations for @cypress/grep and custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to make API requests with better error handling
       */
      apiRequest(options: Partial<Cypress.RequestOptions>): Chainable<Cypress.Response<any>>

      /**
       * Login command for authenticated tests
       */
      login(email: string, password: string): Chainable<void>
    }
    interface SuiteConfigOverrides {
      tags?: string | string[]
    }
    interface TestConfigOverrides {
      tags?: string | string[]
    }
  }
}

// Custom API request command
Cypress.Commands.add('apiRequest', (options) => {
  const defaultOptions = {
    failOnStatusCode: false,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }
  return cy.request({
    ...defaultOptions,
    ...options
  })
})

// Login command for authenticated tests
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"], input[name="email"]').type(email)
    cy.get('[data-testid="password-input"], input[name="password"]').type(password)
    cy.get('[data-testid="submit-button"], button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
  })
})
