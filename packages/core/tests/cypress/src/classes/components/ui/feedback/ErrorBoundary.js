/**
 * ErrorBoundary - Page Object Model Class
 * 
 * Encapsula funcionalidad del manejo de errores y error boundaries
 * Mapea test cases: ERROR_BOUND_001-008 de error-boundaries.cy.md
 */
export class ErrorBoundary {
  static selectors = {
    // Error boundary components
    errorFallback: '[data-cy="error-fallback"]',
    errorBoundary: '[data-cy="error-boundary"]',
    errorContainer: '[data-cy="error-container"]',
    
    // Error display elements
    errorTitle: '[data-cy="error-title"]',
    errorMessage: '[data-cy="error-message"]',
    errorDetails: '[data-cy="error-details"]',
    errorStack: '[data-cy="error-stack"]',
    
    // Action buttons
    errorRetry: '[data-cy="error-retry"]',
    errorReset: '[data-cy="error-reset"]',
    errorRefresh: '[data-cy="error-refresh"]',
    errorReport: '[data-cy="error-report"]',
    
    // Error types
    componentError: '[data-cy="component-error"]',
    networkError: '[data-cy="network-error"]',
    routeError: '[data-cy="route-error"]',
    chunkError: '[data-cy="chunk-error"]',
    
    // Error states
    criticalError: '[data-cy="critical-error"]',
    recoveryError: '[data-cy="recovery-error"]',
    nonCriticalError: '[data-cy="non-critical-error"]',
    
    // Loading and recovery states
    errorRecovering: '[data-cy="error-recovering"]',
    errorRetrying: '[data-cy="error-retrying"]',
    errorRecovered: '[data-cy="error-recovered"]',
    
    // User feedback elements
    errorFeedback: '[data-cy="error-feedback"]',
    feedbackForm: '[data-cy="feedback-form"]',
    feedbackSubmit: '[data-cy="feedback-submit"]',
    
    // Debug information (development mode)
    debugInfo: '[data-cy="debug-info"]',
    debugToggle: '[data-cy="debug-toggle"]',
    componentStack: '[data-cy="component-stack"]',
    
    // Navigation fallbacks
    backHome: '[data-cy="back-home"]',
    backDashboard: '[data-cy="back-dashboard"]',
    contactSupport: '[data-cy="contact-support"]',
    
    // Error prevention indicators
    loadingFallback: '[data-cy="loading-fallback"]',
    suspenseFallback: '[data-cy="suspense-fallback"]',
    
    // Global error elements
    globalErrorHandler: '[data-cy="global-error"]',
    unhandledError: '[data-cy="unhandled-error"]',
    consoleError: '[data-cy="console-error"]',
  }

  /**
   * Dispara un error de componente para testing
   */
  triggerComponentError() {
    cy.window().then((win) => {
      win.postMessage({ type: 'TRIGGER_ERROR' }, '*')
    })
    
    return this
  }

  /**
   * Simula un error de red
   */
  simulateNetworkError() {
    cy.intercept('**/*', { forceNetworkError: true })
    
    return this
  }

  /**
   * Simula un error de chunk loading (dynamic imports)
   */
  simulateChunkError() {
    cy.intercept('**/*.js', { statusCode: 404 })
    
    return this
  }

  /**
   * Valida que el error boundary está funcionando
   */
  validateErrorBoundaryActive() {
    cy.get(ErrorBoundary.selectors.errorFallback).should('be.visible')
    cy.get(ErrorBoundary.selectors.errorRetry).should('be.visible')
    
    return this
  }

  /**
   * Valida la UI de error fallback
   */
  validateErrorFallbackUI() {
    cy.get(ErrorBoundary.selectors.errorFallback).within(() => {
      cy.get(ErrorBoundary.selectors.errorTitle).should('be.visible')
      cy.get(ErrorBoundary.selectors.errorMessage).should('be.visible')
      cy.get(ErrorBoundary.selectors.errorRetry).should('be.visible')
    })
    
    return this
  }

  /**
   * Intenta recuperarse del error
   */
  retryAfterError() {
    cy.get(ErrorBoundary.selectors.errorRetry).click()
    
    return this
  }

  /**
   * Resetea el error boundary
   */
  resetErrorBoundary() {
    cy.get(ErrorBoundary.selectors.errorReset).click()
    
    return this
  }

  /**
   * Refresca la página desde el error
   */
  refreshFromError() {
    cy.get(ErrorBoundary.selectors.errorRefresh).click()
    
    return this
  }

  /**
   * Reporta el error
   */
  reportError(description = 'Test error report') {
    cy.get(ErrorBoundary.selectors.errorReport).click()
    
    cy.get(ErrorBoundary.selectors.feedbackForm).then(($form) => {
      if ($form.length > 0) {
        cy.wrap($form).should('be.visible')
        cy.get('[data-cy="error-description"]').type(description)
        cy.get(ErrorBoundary.selectors.feedbackSubmit).click()
      }
    })
    
    return this
  }

  /**
   * Valida mensaje de error específico
   */
  validateErrorMessage(expectedMessage) {
    cy.get(ErrorBoundary.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', expectedMessage)
    
    return this
  }

  /**
   * Valida detalles del error
   */
  validateErrorDetails() {
    cy.get(ErrorBoundary.selectors.errorDetails).then(($details) => {
      if ($details.length > 0) {
        cy.wrap($details).should('be.visible')
        cy.wrap($details).should('not.be.empty')
      }
    })
    
    return this
  }

  /**
   * Valida stack trace del error (modo desarrollo)
   */
  validateErrorStack() {
    cy.get(ErrorBoundary.selectors.errorStack).then(($stack) => {
      if ($stack.length > 0) {
        cy.wrap($stack).should('be.visible')
        cy.wrap($stack).should('contain.text', 'at ')
      }
    })
    
    return this
  }

  /**
   * Activa/desactiva información de debug
   */
  toggleDebugInfo() {
    cy.get(ErrorBoundary.selectors.debugToggle).then(($toggle) => {
      if ($toggle.length > 0) {
        cy.wrap($toggle).click()
        cy.get(ErrorBoundary.selectors.debugInfo).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida component stack
   */
  validateComponentStack() {
    cy.get(ErrorBoundary.selectors.componentStack).then(($stack) => {
      if ($stack.length > 0) {
        cy.wrap($stack).should('be.visible')
        cy.wrap($stack).should('contain.text', 'in ')
      }
    })
    
    return this
  }

  /**
   * Navega al home desde error
   */
  navigateToHome() {
    cy.get(ErrorBoundary.selectors.backHome).click()
    cy.url().should('eq', Cypress.config().baseUrl + '/')
    
    return this
  }

  /**
   * Navega al dashboard desde error
   */
  navigateToDashboard() {
    cy.get(ErrorBoundary.selectors.backDashboard).click()
    cy.url().should('include', '/dashboard')
    
    return this
  }

  /**
   * Contacta soporte desde error
   */
  contactSupport() {
    cy.get(ErrorBoundary.selectors.contactSupport).click()
    // Verificar que abre modal o navega a soporte
    cy.get('[data-cy="support-modal"]').should('be.visible')
      .or(() => {
        cy.url().should('include', '/support')
      })
    
    return this
  }

  /**
   * Valida error de tipo específico
   */
  validateErrorType(errorType) {
    const typeSelectors = {
      component: ErrorBoundary.selectors.componentError,
      network: ErrorBoundary.selectors.networkError,
      route: ErrorBoundary.selectors.routeError,
      chunk: ErrorBoundary.selectors.chunkError
    }
    
    if (typeSelectors[errorType]) {
      cy.get(typeSelectors[errorType]).should('be.visible')
    }
    
    return this
  }

  /**
   * Valida severidad del error
   */
  validateErrorSeverity(severity) {
    const severitySelectors = {
      critical: ErrorBoundary.selectors.criticalError,
      recovery: ErrorBoundary.selectors.recoveryError,
      nonCritical: ErrorBoundary.selectors.nonCriticalError
    }
    
    if (severitySelectors[severity]) {
      cy.get(severitySelectors[severity]).should('be.visible')
    }
    
    return this
  }

  /**
   * Valida estado de recuperación
   */
  validateRecoveryState() {
    cy.get(ErrorBoundary.selectors.errorRecovering).should('be.visible')
    
    // Esperar a que termine la recuperación
    cy.get(ErrorBoundary.selectors.errorRecovering).should('not.exist')
    cy.get(ErrorBoundary.selectors.errorRecovered).should('be.visible')
    
    return this
  }

  /**
   * Valida estado de reintento
   */
  validateRetryState() {
    cy.get(ErrorBoundary.selectors.errorRetrying).should('be.visible')
    
    // Esperar a que termine el reintento
    cy.get(ErrorBoundary.selectors.errorRetrying).should('not.exist')
    
    return this
  }

  /**
   * Valida manejo de errores globales
   */
  validateGlobalErrorHandling() {
    cy.get(ErrorBoundary.selectors.globalErrorHandler).then(($global) => {
      if ($global.length > 0) {
        cy.wrap($global).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida captura de errores no manejados
   */
  validateUnhandledErrorCapture() {
    // Disparar error no manejado
    cy.window().then((win) => {
      win.dispatchEvent(new ErrorEvent('error', {
        error: new Error('Unhandled test error'),
        message: 'Unhandled test error'
      }))
    })
    
    cy.get(ErrorBoundary.selectors.unhandledError).then(($unhandled) => {
      if ($unhandled.length > 0) {
        cy.wrap($unhandled).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida logging de errores en consola
   */
  validateConsoleErrorLogging() {
    cy.window().then((win) => {
      const consoleSpy = cy.spy(win.console, 'error')
      
      this.triggerComponentError()
      
      cy.wrap(consoleSpy).should('have.been.called')
    })
    
    return this
  }

  /**
   * Valida fallbacks de loading
   */
  validateLoadingFallbacks() {
    cy.get(ErrorBoundary.selectors.loadingFallback).then(($loading) => {
      if ($loading.length > 0) {
        cy.wrap($loading).should('be.visible')
        cy.wrap($loading).should('contain.text', 'Loading...')
      }
    })
    
    return this
  }

  /**
   * Valida fallbacks de suspense
   */
  validateSuspenseFallbacks() {
    cy.get(ErrorBoundary.selectors.suspenseFallback).then(($suspense) => {
      if ($suspense.length > 0) {
        cy.wrap($suspense).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida recuperación automática
   */
  validateAutoRecovery() {
    this.triggerComponentError()
    this.validateErrorBoundaryActive()
    
    // Esperar recuperación automática (si está configurada)
    cy.wait(5000)
    
    cy.get(ErrorBoundary.selectors.errorFallback).then(($fallback) => {
      if ($fallback.length === 0) {
        // Se recuperó automáticamente
        cy.log('Auto recovery successful')
      }
    })
    
    return this
  }

  /**
   * Valida accesibilidad del error boundary
   */
  validateAccessibility() {
    cy.get(ErrorBoundary.selectors.errorFallback).within(() => {
      // Verificar roles ARIA
      cy.root().should('have.attr', 'role', 'alert')
        .or('have.attr', 'aria-live')
      
      // Verificar que los botones tienen labels
      cy.get(ErrorBoundary.selectors.errorRetry)
        .should('have.attr', 'aria-label')
        .or('have.text')
      
      // Navegación por teclado
      cy.get(ErrorBoundary.selectors.errorRetry).focus()
      cy.tab()
      cy.focused().should('exist')
    })
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    this.triggerComponentError()
    
    // Mobile
    cy.viewport(375, 667)
    cy.get(ErrorBoundary.selectors.errorFallback).should('be.visible')
    
    // Desktop
    cy.viewport(1200, 800)
    cy.get(ErrorBoundary.selectors.errorFallback).should('be.visible')
    
    return this
  }

  /**
   * Valida que la aplicación no se rompe completamente
   */
  validateGracefulDegradation() {
    this.triggerComponentError()
    this.validateErrorBoundaryActive()
    
    // Verificar que la navegación principal sigue funcionando
    cy.get('[data-cy="topnav-header"]').then(($topnav) => {
      if ($topnav.length > 0) {
        cy.wrap($topnav).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida integración con sistemas de monitoreo
   */
  validateErrorMonitoring() {
    // Verificar que los errores se reportan a sistemas externos
    cy.window().then((win) => {
      // Verificar llamadas a servicios de error tracking
      cy.intercept('POST', '**/errors', { statusCode: 200 }).as('errorReport')
      
      this.triggerComponentError()
      
      // Verificar que se reportó el error
      cy.wait('@errorReport').then((interception) => {
        expect(interception.request.body).to.have.property('error')
      })
    })
    
    return this
  }

  /**
   * Valida prevención de errores en cascade
   */
  validateErrorIsolation() {
    // Disparar error en un componente
    this.triggerComponentError()
    this.validateErrorBoundaryActive()
    
    // Verificar que otros componentes siguen funcionando
    cy.get('[data-cy="sidebar-main"]').then(($sidebar) => {
      if ($sidebar.length > 0) {
        cy.wrap($sidebar).should('be.visible')
        cy.wrap($sidebar).should('be.accessible')
      }
    })
    
    return this
  }

  /**
   * Valida limpieza después de la recuperación
   */
  validateCleanupAfterRecovery() {
    this.triggerComponentError()
    this.validateErrorBoundaryActive()
    this.retryAfterError()
    
    // Verificar que el error se limpió
    cy.get(ErrorBoundary.selectors.errorFallback).should('not.exist')
    
    // Verificar que la aplicación funciona normalmente
    cy.get('body').should('not.have.class', 'error-state')
    
    return this
  }
}
