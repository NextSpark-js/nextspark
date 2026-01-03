/**
 * Custom Cypress Commands
 *
 * Add custom commands here that can be used across all tests.
 * Commands are available via cy.commandName()
 *
 * @example
 * // Define a command
 * Cypress.Commands.add('login', (email, password) => { ... })
 *
 * // Use it in tests
 * cy.login('user@example.com', 'password')
 */

// Declare custom commands for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login as owner using session helpers
       */
      loginAsOwner(): Chainable<void>

      /**
       * Login as member using session helpers
       */
      loginAsMember(): Chainable<void>

      /**
       * Login as admin using session helpers
       */
      loginAsAdmin(): Chainable<void>

      /**
       * Login as viewer using session helpers
       */
      loginAsViewer(): Chainable<void>
    }
  }
}

// Import session helpers for login commands
import { loginAsOwner, loginAsMember, loginAsAdmin, loginAsViewer } from '../src/session-helpers'

// Register login commands
Cypress.Commands.add('loginAsOwner', loginAsOwner)
Cypress.Commands.add('loginAsMember', loginAsMember)
Cypress.Commands.add('loginAsAdmin', loginAsAdmin)
Cypress.Commands.add('loginAsViewer', loginAsViewer)

export {}
