// Theme/Project-specific Cypress commands

declare global {
  namespace Cypress {
    interface Chainable {
      visitLandingPage(): Chainable<void>
      openPricingModal(): Chainable<void>
    }
  }
}

Cypress.Commands.add('visitLandingPage', () => {
  cy.visit('/')
  cy.get('[data-cy="landing-hero"]').should('be.visible')
})

Cypress.Commands.add('openPricingModal', () => {
  cy.get('[data-cy="pricing-button"]').click()
  cy.get('[data-cy="pricing-modal"]').should('be.visible')
})

export {}
