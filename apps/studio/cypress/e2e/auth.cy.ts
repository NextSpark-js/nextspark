describe('Authentication', () => {
  describe('Login page', () => {
    beforeEach(() => {
      cy.visit('/login')
    })

    it('renders the login form', () => {
      cy.contains('nextspark studio').should('be.visible')
      cy.contains('Sign in to continue').should('be.visible')
      cy.get('input#email').should('be.visible')
      cy.get('input#password').should('be.visible')
      cy.get('button[type="submit"]').contains('Sign in').should('be.visible')
    })

    it('has a link to the register page', () => {
      cy.contains('Create one').should('have.attr', 'href', '/register')
    })

    it('requires email and password fields', () => {
      cy.get('input#email').should('have.attr', 'required')
      cy.get('input#password').should('have.attr', 'required')
    })

    it('email input has correct type', () => {
      cy.get('input#email').should('have.attr', 'type', 'email')
    })

    it('password input has correct type', () => {
      cy.get('input#password').should('have.attr', 'type', 'password')
    })

    it('shows error on invalid credentials', () => {
      // Intercept the auth call to return error
      cy.intercept('POST', '/api/auth/sign-in/email', {
        statusCode: 401,
        body: { error: { message: 'Invalid credentials' } },
      })

      cy.get('input#email').type('bad@example.com')
      cy.get('input#password').type('wrongpassword')
      cy.get('button[type="submit"]').click()

      cy.contains('Invalid credentials').should('be.visible')
    })

    it('disables submit button while loading', () => {
      cy.intercept('POST', '/api/auth/sign-in/email', {
        statusCode: 200,
        body: { session: {}, user: {} },
        delay: 2000,
      })

      cy.get('input#email').type('test@example.com')
      cy.get('input#password').type('Test1234')
      cy.get('button[type="submit"]').click()
      cy.get('button[type="submit"]').should('be.disabled')
    })

    it('redirects to home on successful login', () => {
      cy.intercept('POST', '/api/auth/sign-in/email', {
        statusCode: 200,
        body: { session: { id: 's1', token: 'tok' }, user: { id: 'u1', name: 'Test' } },
      })
      cy.mockSession()
      cy.mockAPIs()

      cy.get('input#email').type('test@example.com')
      cy.get('input#password').type('Test1234')
      cy.get('button[type="submit"]').click()

      cy.url().should('not.include', '/login')
    })
  })

  describe('Register page', () => {
    beforeEach(() => {
      cy.visit('/register')
    })

    it('renders the register form', () => {
      cy.contains('nextspark studio').should('be.visible')
      cy.contains('Create your account').should('be.visible')
      cy.get('input#name').should('be.visible')
      cy.get('input#email').should('be.visible')
      cy.get('input#password').should('be.visible')
      cy.get('button[type="submit"]').contains('Create account').should('be.visible')
    })

    it('has a link to the login page', () => {
      cy.contains('Sign in').should('have.attr', 'href', '/login')
    })

    it('requires all fields', () => {
      cy.get('input#name').should('have.attr', 'required')
      cy.get('input#email').should('have.attr', 'required')
      cy.get('input#password').should('have.attr', 'required')
    })

    it('enforces minimum password length', () => {
      cy.get('input#password').should('have.attr', 'minlength', '8')
    })

    it('shows error on registration failure', () => {
      cy.intercept('POST', '/api/auth/sign-up/email', {
        statusCode: 400,
        body: { error: { message: 'Email already registered' } },
      })

      cy.get('input#name').type('Test User')
      cy.get('input#email').type('existing@example.com')
      cy.get('input#password').type('Test1234')
      cy.get('button[type="submit"]').click()

      cy.contains('Email already registered').should('be.visible')
    })
  })

  describe('Middleware redirect', () => {
    it('redirects unauthenticated users to login', () => {
      cy.visit('/')
      cy.url().should('include', '/login')
    })

    it('includes callbackUrl for protected pages', () => {
      cy.visit('/projects')
      cy.url().should('include', '/login')
      cy.url().should('include', 'callbackUrl')
    })

    it('allows access to login page without auth', () => {
      cy.visit('/login')
      cy.url().should('include', '/login')
      cy.contains('Sign in to continue').should('be.visible')
    })

    it('allows access to register page without auth', () => {
      cy.visit('/register')
      cy.url().should('include', '/register')
      cy.contains('Create your account').should('be.visible')
    })
  })
})
