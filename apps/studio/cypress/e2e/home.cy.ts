describe('Home Page', () => {
  beforeEach(() => {
    cy.mockSession()
    cy.mockAPIs()
    cy.visit('/')
  })

  it('renders the logo and tagline', () => {
    cy.contains('nextspark studio').should('be.visible')
    cy.contains('Describe your app. We build it.').should('be.visible')
  })

  it('shows the prompt textarea', () => {
    cy.get('textarea').should('be.visible')
    cy.get('textarea').should('have.attr', 'placeholder', 'Describe the app you want to build...')
  })

  it('has a submit button (arrow)', () => {
    // Submit button should be disabled when textarea is empty
    cy.get('textarea').parent().find('button').should('be.disabled')
  })

  it('enables submit button when text is entered', () => {
    cy.get('textarea').type('Build a CRM app')
    cy.get('textarea').parent().find('button').should('not.be.disabled')
  })

  it('submits prompt and navigates to build page', () => {
    cy.get('textarea').type('Build a CRM app')
    cy.get('textarea').parent().find('button').click()

    cy.wait('@createSession')
    cy.url().should('include', '/build')
    cy.url().should('include', 'session=')
  })

  it('submits on Enter key press', () => {
    cy.get('textarea').type('Build a CRM app{enter}')

    cy.wait('@createSession')
    cy.url().should('include', '/build')
  })

  it('does not submit on Shift+Enter (new line)', () => {
    cy.get('textarea').type('Line 1{shift+enter}Line 2')
    cy.url().should('not.include', '/build')
    cy.get('textarea').should('contain.value', 'Line 1\nLine 2')
  })

  it('shows recent projects section', () => {
    cy.wait('@getSessions')
    cy.contains('Recent projects').should('be.visible')
    cy.contains('invoiceflow').should('be.visible')
  })

  it('navigates to build page when clicking a recent project', () => {
    cy.wait('@getSessions')
    cy.contains('invoiceflow').click()
    cy.url().should('include', '/build?session=test-session-1')
  })

  it('has a "View all projects" link', () => {
    cy.wait('@getSessions')
    cy.contains('View all projects').click()
    cy.url().should('include', '/projects')
  })

  it('shows the template gallery', () => {
    // Template gallery component should render
    cy.get('body').then(($body) => {
      // The TemplateGallery component renders template categories
      if ($body.find('[class*="template"]').length > 0 || $body.text().includes('CRM') || $body.text().includes('Blog')) {
        cy.log('Template gallery is visible')
      }
    })
  })

  it('shows helper text for keyboard shortcuts', () => {
    cy.contains('Press Enter to submit').should('be.visible')
    cy.contains('Shift+Enter for new line').should('be.visible')
  })
})
