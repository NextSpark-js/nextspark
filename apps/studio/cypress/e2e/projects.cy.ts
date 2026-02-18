describe('Projects Page', () => {
  beforeEach(() => {
    cy.mockSession()
    cy.mockAPIs()
  })

  it('renders the header with title', () => {
    cy.visit('/projects')
    cy.contains('Projects').should('be.visible')
  })

  it('shows project count', () => {
    cy.visit('/projects')
    cy.wait('@getSessions')
    cy.contains('2 projects').should('be.visible')
  })

  it('renders project cards with names', () => {
    cy.visit('/projects')
    cy.wait('@getSessions')
    cy.contains('invoiceflow').should('be.visible')
    cy.contains('CRM for freelancers').should('be.visible')
  })

  it('shows entity count on project card', () => {
    cy.visit('/projects')
    cy.wait('@getSessions')
    cy.contains('2 entities').should('be.visible')
  })

  it('shows page count on project card', () => {
    cy.visit('/projects')
    cy.wait('@getSessions')
    cy.contains('1 page').should('be.visible')
  })

  it('shows status indicators', () => {
    cy.visit('/projects')
    cy.wait('@getSessions')
    // Complete status icon (CheckCircle2 = success color)
    cy.get('svg.text-success').should('exist')
    // Pending status icon (Clock = accent color)
    cy.get('svg.text-accent').should('exist')
  })

  it('navigates to build page when clicking a project', () => {
    cy.visit('/projects')
    cy.wait('@getSessions')
    cy.contains('invoiceflow').click()
    cy.url().should('include', '/build?session=test-session-1')
  })

  it('has a "New project" button', () => {
    cy.visit('/projects')
    cy.contains('New project').should('be.visible')
  })

  it('navigates home when clicking "New project"', () => {
    cy.visit('/projects')
    cy.contains('New project').click()
    cy.url().should('eq', Cypress.config('baseUrl') + '/')
  })

  it('has a back button', () => {
    cy.visit('/projects')
    cy.get('button[title="Back to home"]').should('be.visible')
  })

  it('deletes a project when clicking trash icon', () => {
    cy.intercept('DELETE', '/api/sessions/*', {
      statusCode: 200,
      body: { success: true },
    }).as('deleteSession')

    cy.visit('/projects')
    cy.wait('@getSessions')

    // Hover to reveal delete button, then click
    cy.contains('invoiceflow').parents('button').first().within(() => {
      cy.get('[title="Delete project"]').click({ force: true })
    })

    cy.wait('@deleteSession')
    // After delete, the card should be removed
    cy.contains('invoiceflow').should('not.exist')
  })

  describe('empty state', () => {
    it('shows empty state when no projects exist', () => {
      cy.intercept('GET', '/api/sessions*', {
        statusCode: 200,
        body: { sessions: [] },
      }).as('getEmptySessions')

      cy.visit('/projects')
      cy.wait('@getEmptySessions')

      cy.contains('No projects yet').should('be.visible')
      cy.contains('Create your first app').should('be.visible')
    })

    it('empty state button navigates to home', () => {
      cy.intercept('GET', '/api/sessions*', {
        statusCode: 200,
        body: { sessions: [] },
      }).as('getEmptySessions')

      cy.visit('/projects')
      cy.wait('@getEmptySessions')

      cy.contains('Create your first app').click()
      cy.url().should('eq', Cypress.config('baseUrl') + '/')
    })
  })
})
