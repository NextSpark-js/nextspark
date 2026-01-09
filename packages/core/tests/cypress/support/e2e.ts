// Cypress E2E support file
import './commands'
import '@testing-library/cypress/add-commands'

// Import Allure reporter
import './allure'

// Import @cypress/grep for test filtering by tags
import '@cypress/grep'

// Configuracion global de error handling
Cypress.on('uncaught:exception', (err) => {
  // Ignorar errores de hidratacion de React
  if (err.message.includes('Hydration')) {
    return false
  }
  // Ignorar errores de ResizeObserver
  if (err.message.includes('ResizeObserver')) {
    return false
  }
  return true
})

// Global before hook for tests
beforeEach(() => {
  // Clear any previous state
  cy.clearCookies()
  cy.clearLocalStorage()
})

// Add custom commands for API testing
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to make API requests with better error handling
       */
      apiRequest(options: Partial<Cypress.RequestOptions>): Chainable<Cypress.Response<any>>
    }

    // @cypress/grep - extend SuiteConfigOverrides to support tags
    interface SuiteConfigOverrides {
      tags?: string | string[]
    }

    interface TestConfigOverrides {
      tags?: string | string[]
    }
  }
}

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