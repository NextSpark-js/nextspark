/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Custom command to login via session
     */
    login(email?: string, password?: string): Chainable<void>

    /**
     * Custom command to login via API key
     */
    loginWithApiKey(apiKey: string): Chainable<void>
  }
}
