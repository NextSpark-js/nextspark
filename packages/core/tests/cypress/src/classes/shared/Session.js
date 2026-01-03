/**
 * Session - Maneja aspectos de sesión y autenticación en tests
 * 
 * Centraliza lógica relacionada con sesiones, cookies, y 
 * configuración de interceptors para tests.
 */
export class Session {
  
  /**
   * Limpia datos de sesión existentes
   */
  static clearSessionData() {
    cy.clearLocalStorage()
    cy.clearCookies()
    
    return this
  }

  /**
   * Configura interceptors para autenticación REAL (sin mocks)
   * Permite que las llamadas reales pasen al servidor Better Auth
   */
  static setupRealAuthenticationTest() {
    // Limpiar estado antes del test
    Session.clearSessionData()
    
    // Permitir que las llamadas reales pasen sin interceptar
    cy.intercept('GET', '/api/auth/get-session', (req) => {
      req.continue() // Let the real request pass through
    }).as('realGetSession')
    
    cy.intercept('POST', '/api/auth/sign-in/email', (req) => {
      req.continue() // Let the real request pass through
    }).as('realSignIn')
    
    cy.intercept('POST', '/api/auth/sign-out', (req) => {
      req.continue() // Let the real logout pass through
    }).as('realSignOut')
    
    cy.log('✅ Real authentication interceptors configured')
    return this
  }

  /**
   * Configura intercept para evitar redirecciones en tests
   * Mockea una sesión válida para bypass del middleware
   */
  static mockValidSession(userEmail = 'user@cypress.com', userRole = 'member') {
    const mockUser = {
      id: 'test-user-id',
      email: userEmail,
      firstName: 'Test',
      lastName: 'User',
      role: userRole,
      emailVerified: true
    }
    
    const mockSession = {
      id: 'test-session-id',
      token: 'test-token-' + Date.now(),
      userId: 'test-user-id',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
    
    // Interceptor para middleware con wrapper 'data'
    cy.intercept('GET', '/api/auth/get-session', {
      statusCode: 200,
      body: {
        data: { user: mockUser, session: mockSession }
      }
    }).as('sessionCheck')
    
    // También interceptor para sign-in
    cy.intercept('POST', '/api/auth/sign-in/email', {
      statusCode: 200,
      body: { user: mockUser, session: mockSession }
    }).as('signIn')
    
    // Configurar cookies
    cy.setCookie('better-auth.session_token', mockSession.token)
    
    // Configurar localStorage
    cy.window().then((win) => {
      win.localStorage.setItem('better-auth.session_token', mockSession.token)
      win.localStorage.setItem('better-auth.user', JSON.stringify(mockUser))
      win.localStorage.setItem('better-auth.session', JSON.stringify(mockSession))
    })
    
    return this
  }

  /**
   * Configura intercept para simular sesión inválida
   */
  static mockInvalidSession() {
    cy.intercept('GET', '/api/auth/get-session', {
      statusCode: 401,
      body: { error: 'No valid session' }
    }).as('sessionCheckFailed')
    
    return this
  }

  /**
   * Configura interceptors para simular logout exitoso
   */
  static setupLogoutInterceptors() {
    // Interceptor para el endpoint de logout
    cy.intercept('POST', '/api/auth/sign-out', {
      statusCode: 200,
      body: { success: true }
    }).as('signOut')
    
    // Interceptor para verificaciones de sesión después del logout
    cy.intercept('GET', '/api/auth/get-session', {
      statusCode: 401,
      body: { error: 'Unauthorized' }
    }).as('sessionCheckAfterLogout')
    
    cy.log('✅ Logout interceptors configured')
    return this
  }

  /**
   * Configuración completa para tests de login mockeado
   */
  static setupLoginTest(userEmail, userRole) {
    Session.clearSessionData()
    Session.mockValidSession(userEmail, userRole)
    
    return this
  }

  /**
   * Configuración para tests que requieren usuario no autenticado
   */
  static setupUnauthenticatedTest() {
    Session.clearSessionData()
    Session.mockInvalidSession()
    
    return this
  }

  /**
   * Limpieza forzada para asegurar estado limpio entre tests
   */
  static forceCleanup() {
    cy.clearLocalStorage()
    cy.clearCookies()
    
    // Limpiar cualquier intercept residual
    cy.window().then((win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
    })
    
    return this
  }

  /**
   * Espera a que se complete la validación de sesión
   */
  static waitForSessionCheck() {
    cy.wait('@sessionCheck')
    
    return this
  }
}
