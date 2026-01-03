describe('Smoke Tests', () => {
  it('should load the homepage', () => {
    cy.visit('/')
    cy.get('body').should('be.visible')
  })

  it('should navigate to login', () => {
    cy.visit('/auth/login')
    cy.url().should('include', '/auth/login')
  })
})
