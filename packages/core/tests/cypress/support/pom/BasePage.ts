export abstract class BasePage {
  protected abstract path: string

  visit(): Cypress.Chainable {
    return cy.visit(this.path)
  }

  getByDataCy(selector: string): Cypress.Chainable {
    return cy.get(`[data-cy="${selector}"]`)
  }

  getByTestId(testId: string): Cypress.Chainable {
    return cy.get(`[data-testid="${testId}"]`)
  }

  shouldBeVisible(): void {
    cy.url().should('include', this.path)
  }

  waitForLoad(): void {
    cy.get('[data-cy="page-loader"]').should('not.exist')
  }
}
