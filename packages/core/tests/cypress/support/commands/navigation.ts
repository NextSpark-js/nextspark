declare global {
  namespace Cypress {
    interface Chainable {
      navigateTo(section: string): Chainable<void>
      waitForPageLoad(): Chainable<void>
    }
  }
}

Cypress.Commands.add('navigateTo', (section: string) => {
  cy.get(`[data-cy="nav-${section}"]`).click()
  cy.url().should('include', `/${section}`)
})

Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-cy="page-loader"]').should('not.exist')
})

export {}
