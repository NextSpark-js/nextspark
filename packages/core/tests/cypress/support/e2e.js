// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Add global configuration for API tests
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // This is useful for API tests where we might have network errors
  console.log('Uncaught exception:', err.message);
  return false;
});

// Global before hook for API tests
beforeEach(() => {
  // Clear any previous state
  cy.clearCookies();
  cy.clearLocalStorage();
});

// Add custom commands for API testing
Cypress.Commands.add('apiRequest', (options) => {
  const defaultOptions = {
    failOnStatusCode: false,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  return cy.request({
    ...defaultOptions,
    ...options
  });
});
