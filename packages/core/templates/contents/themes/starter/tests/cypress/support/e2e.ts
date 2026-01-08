/**
 * Cypress E2E Support File for Starter Theme
 *
 * This file is loaded automatically before test files.
 * Use it to load plugins, add global hooks, and import commands.
 */

// Testing Library for better element queries
import '@testing-library/cypress/add-commands'

// Import @cypress/grep for test filtering by tags
import registerCypressGrep from '@cypress/grep'
registerCypressGrep()

// Import custom commands
import './commands'

// Import documentation commands (optional - for demo videos)
// Requires cypress-slow-down: pnpm add -D cypress-slow-down
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
  // Log other errors but don't fail tests
  console.error('Uncaught exception:', err.message)
  return false
})

// Global before hook
beforeEach(() => {
  cy.clearCookies()
  cy.clearLocalStorage()
})

// Type declarations for @cypress/grep
declare global {
  namespace Cypress {
    interface SuiteConfigOverrides {
      tags?: string | string[]
    }
    interface TestConfigOverrides {
      tags?: string | string[]
    }
  }
}
