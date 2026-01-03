declare global {
  namespace Cypress {
    interface Chainable {
      fillForm(fields: Record<string, string>): Chainable<void>
      submitForm(formSelector?: string): Chainable<void>
      clearForm(formSelector?: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('fillForm', (fields: Record<string, string>) => {
  for (const [name, value] of Object.entries(fields)) {
    cy.get(`[data-cy="${name}-input"], [name="${name}"]`).first().clear().type(value)
  }
})

Cypress.Commands.add('submitForm', (formSelector = 'form') => {
  cy.get(formSelector).submit()
})

Cypress.Commands.add('clearForm', (formSelector = 'form') => {
  cy.get(formSelector).find('input, textarea').each(($el) => {
    cy.wrap($el).clear()
  })
})

export {}
