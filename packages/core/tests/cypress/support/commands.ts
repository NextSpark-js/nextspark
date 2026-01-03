// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom commands for API testing

/**
 * Command to wait for API response with retry logic
 */
Cypress.Commands.add('waitForApi', (url: string, expectedStatus: number = 200, retries: number = 3) => {
  const attemptRequest = (attempt: number): Cypress.Chainable<Cypress.Response<any>> => {
    return cy.request({
      url,
      failOnStatusCode: false,
      timeout: 10000
    }).then((response) => {
      if (response.status === expectedStatus) {
        return response;
      } else if (attempt < retries) {
        cy.wait(1000); // Wait 1 second before retry
        return attemptRequest(attempt + 1);
      } else {
        throw new Error(`API request failed after ${retries} attempts. Last status: ${response.status}`);
      }
    });
  };

  return attemptRequest(1);
});

/**
 * Command to clean up test data
 */
Cypress.Commands.add('cleanupTestData', (userIds: string[], apiKey: string) => {
  if (userIds.length === 0) return;

  userIds.forEach((userId) => {
    cy.request({
      method: 'DELETE',
      url: `/api/v1/users/${userId}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        cy.log(`✅ Cleaned up user: ${userId}`);
      } else if (response.status === 404) {
        cy.log(`⚠️ User already deleted: ${userId}`);
      } else {
        cy.log(`❌ Failed to cleanup user: ${userId} (${response.status})`);
      }
    });
  });
});

// Extend Cypress namespace for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      waitForApi(url: string, expectedStatus?: number, retries?: number): Chainable<Cypress.Response<any>>;
      cleanupTestData(userIds: string[], apiKey: string): Chainable<void>;
    }
  }
}