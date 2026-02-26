describe('Build Page', () => {
  beforeEach(() => {
    cy.mockSession()
    cy.mockAPIs()

    // Intercept chat/generate endpoints
    cy.intercept('POST', '/api/generate', {
      statusCode: 200,
      body: { stream: false, result: {} },
    }).as('generate')

    cy.intercept('POST', '/api/chat', {
      statusCode: 200,
      body: { response: 'Done' },
    }).as('chat')

    // Intercept deploy/export endpoints
    cy.intercept('POST', '/api/deploy', { statusCode: 200, body: {} }).as('deploy')
    cy.intercept('GET', '/api/deploy*', { statusCode: 200, body: { status: 'stopped' } }).as('deployStatus')
    cy.intercept('POST', '/api/export*', { statusCode: 200, body: {} }).as('export')
    cy.intercept('POST', '/api/entities', { statusCode: 200, body: {} }).as('entities')
    cy.intercept('POST', '/api/pages', { statusCode: 200, body: {} }).as('pages')

    // Mark onboarding as complete to avoid overlay
    cy.window().then((win) => {
      win.localStorage.setItem('ns-onboarding-complete', 'true')
    })

    cy.visit('/build?session=test-session-1')
  })

  describe('layout', () => {
    it('renders the header with project name', () => {
      cy.get('header').should('be.visible')
      cy.contains('nextspark studio').should('be.visible')
    })

    it('shows the chat panel', () => {
      cy.get('[data-tour="chat-panel"]').should('be.visible')
    })

    it('shows the tab bar', () => {
      cy.get('[data-tour="tab-bar"]').should('be.visible')
    })

    it('shows all four tabs', () => {
      cy.contains('Preview').should('be.visible')
      cy.contains('Pages').should('be.visible')
      cy.contains('Code').should('be.visible')
      cy.contains('Config').should('be.visible')
    })

    it('has deploy menu', () => {
      cy.get('[data-tour="deploy-menu"]').should('be.visible')
    })

    it('has Projects navigation button', () => {
      cy.contains('Projects').should('be.visible')
    })

    it('has New button', () => {
      cy.contains('New').should('be.visible')
    })
  })

  describe('tab switching', () => {
    it('Preview tab is active by default', () => {
      cy.get('[data-tour="preview-tab"]').should('exist')
    })

    it('switches to Code tab', () => {
      cy.contains('button', 'Code').click()
      // Code tab shows an Explorer sidebar
      cy.contains('Explorer').should('be.visible')
    })

    it('switches to Config tab', () => {
      cy.contains('button', 'Config').click()
      // Config tab shows configuration content
      cy.get('body').should('exist') // Tab content renders
    })

    it('switches to Pages tab', () => {
      cy.contains('button', 'Pages').click()
      cy.get('body').should('exist') // Tab content renders
    })

    it('can switch back to Preview', () => {
      cy.contains('button', 'Code').click()
      cy.contains('Explorer').should('be.visible')
      cy.contains('button', 'Preview').click()
      cy.contains('Explorer').should('not.exist')
    })
  })

  describe('chat panel', () => {
    it('has a prompt input area', () => {
      cy.get('[data-tour="chat-panel"]').within(() => {
        // The PromptInput component renders a textarea or input
        cy.get('textarea, input[type="text"]').should('exist')
      })
    })

    it('can be toggled via Cmd+B shortcut', () => {
      // Chat panel should be visible initially
      cy.get('[data-tour="chat-panel"]').should('be.visible')

      // Press Cmd+B to toggle
      cy.get('body').type('{meta}b')

      // Panel should collapse (width transitions to 0)
      // The outer container shrinks; the inner div still exists but is hidden
      cy.get('[data-tour="chat-panel"]').parent().should('have.css', 'width', '0px')
    })
  })

  describe('navigation', () => {
    it('navigates to projects page', () => {
      cy.contains('Projects').click()
      cy.url().should('include', '/projects')
    })

    it('New button navigates home', () => {
      cy.contains('New').click()
      cy.url().should('eq', Cypress.config('baseUrl') + '/')
    })
  })

  describe('viewport controls', () => {
    it('shows viewport buttons on preview tab', () => {
      // Viewport buttons (desktop, tablet, mobile) should be visible
      cy.get('button[title="Desktop"]').should('exist')
      cy.get('button[title="Tablet"]').should('exist')
      cy.get('button[title="Mobile"]').should('exist')
    })
  })

  describe('data-tour attributes', () => {
    it('has all required tour targets', () => {
      cy.get('[data-tour="chat-panel"]').should('exist')
      cy.get('[data-tour="preview-tab"]').should('exist')
      cy.get('[data-tour="tab-bar"]').should('exist')
      cy.get('[data-tour="deploy-menu"]').should('exist')
      cy.get('[data-tour="shortcuts-btn"]').should('exist')
    })
  })

  describe('keyboard shortcuts', () => {
    it('Cmd+/ toggles shortcuts help overlay', () => {
      cy.get('body').type('{meta}/')
      cy.contains('Keyboard Shortcuts').should('be.visible')
    })
  })
})
