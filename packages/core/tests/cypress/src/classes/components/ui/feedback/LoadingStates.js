/**
 * LoadingStates - Page Object Model Class
 */
export class LoadingStates {
  static selectors = {
    loadingSpinner: '.animate-spin',
    skeletonLoader: '.skeleton',
    loadingOverlay: '.loading-overlay',
    progressBar: '.progress-bar',
    loadingText: '.loading-text'
  }

  validateLoadingSpinner() {
    cy.get(LoadingStates.selectors.loadingSpinner).should('be.visible')
    return this
  }

  validateSkeletonLoader() {
    cy.get(LoadingStates.selectors.skeletonLoader).should('be.visible')
    return this
  }

  validateLoadingCompleted() {
    cy.get(LoadingStates.selectors.loadingSpinner).should('not.exist')
    cy.get(LoadingStates.selectors.skeletonLoader).should('not.exist')
    return this
  }

  validateProgressBar(expectedProgress) {
    cy.get(LoadingStates.selectors.progressBar)
      .should('be.visible')
      .and('have.attr', 'aria-valuenow', expectedProgress)
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida que la carga está completa
   */
  validateLoadingComplete() {
    this.validateLoadingCompleted()
    return this
  }

  /**
   * Valida que un componente específico se cargó
   */
  validateComponentLoaded(componentName) {
    cy.get(`[data-cy="${componentName}-loaded"]`).should('be.visible')
    cy.get(LoadingStates.selectors.loadingSpinner).should('not.exist')
    return this
  }

  /**
   * Valida que el envío de formulario está completo
   */
  validateFormSubmissionComplete() {
    cy.get('[data-cy="form-submit-loading"]').should('not.exist')
    cy.get('[data-cy="form-success"]').should('be.visible')
    return this
  }

  /**
   * Valida que el refresh está completo
   */
  validateRefreshComplete() {
    cy.get('[data-cy="refresh-loading"]').should('not.exist')
    cy.get('[data-cy="content-refreshed"]').should('be.visible')
    return this
  }

  /**
   * Valida que se cargó más contenido
   */
  validateMoreContentLoaded() {
    cy.get('[data-cy="load-more-spinner"]').should('not.exist')
    cy.get('[data-cy="additional-content"]').should('be.visible')
    return this
  }

  /**
   * Valida estructura de skeleton
   */
  validateSkeletonStructure() {
    cy.get(LoadingStates.selectors.skeletonLoader).should('be.visible')
    cy.get('.skeleton-line').should('have.length.at.least', 3)
    cy.get('.skeleton-avatar').should('be.visible')
    return this
  }

  /**
   * Valida skeleton en modo alto contraste
   */
  validateHighContrastSkeleton() {
    cy.get('html.dark').within(() => {
      cy.get(LoadingStates.selectors.skeletonLoader).should('be.visible')
      cy.get('.skeleton-line').should('have.css', 'background-color')
    })
    return this
  }

  // ========================================
  // MISSING METHODS FROM TESTS
  // ========================================

  /**
   * Valida estado de carga de página
   */
  validatePageLoadingState() {
    cy.get('[data-cy="page-loading"]').should('be.visible')
    return this
  }

  /**
   * Valida texto de carga
   */
  validateLoadingText() {
    cy.get(LoadingStates.selectors.loadingText).should('be.visible')
      .and('not.be.empty')
    return this
  }

  /**
   * Valida carga de componente específico
   */
  validateComponentLoading(componentName) {
    cy.get(`[data-cy="${componentName}-loading"]`).should('be.visible')
    return this
  }

  /**
   * Valida skeleton loaders
   */
  validateSkeletonLoaders() {
    cy.get(LoadingStates.selectors.skeletonLoader).should('be.visible')
      .and('have.length.at.least', 1)
    return this
  }

  /**
   * Valida carga de envío de formulario
   */
  validateFormSubmissionLoading() {
    cy.get('[data-cy="form-submit-loading"]').should('be.visible')
    return this
  }

  /**
   * Valida botón de envío en estado de carga
   */
  validateSubmitButtonLoading() {
    cy.get('[data-cy="submit-button"]').should('be.disabled')
      .and('contain.text', 'Loading')
    return this
  }

  /**
   * Valida estado deshabilitado del formulario
   */
  validateFormDisabledState() {
    cy.get('form').within(() => {
      cy.get('input, select, textarea').should('be.disabled')
    })
    return this
  }

  /**
   * Valida carga de refresh
   */
  validateRefreshLoading() {
    cy.get('[data-cy="refresh-loading"]').should('be.visible')
    return this
  }

  /**
   * Valida indicador de refresh
   */
  validateRefreshIndicator() {
    cy.get('[data-cy="refresh-indicator"]').should('be.visible')
    return this
  }

  /**
   * Valida carga infinita
   */
  validateInfiniteLoading() {
    cy.get('[data-cy="infinite-loading"]').should('be.visible')
    return this
  }

  /**
   * Valida indicador de cargar más
   */
  validateLoadMoreIndicator() {
    cy.get('[data-cy="load-more"]').should('be.visible')
    return this
  }

  /**
   * Valida animaciones del skeleton
   */
  validateSkeletonAnimations() {
    cy.get(LoadingStates.selectors.skeletonLoader)
      .should('have.css', 'animation-name')
      .and('not.equal', 'none')
    return this
  }

  /**
   * Valida accesibilidad del skeleton
   */
  validateSkeletonAccessibility() {
    cy.get(LoadingStates.selectors.skeletonLoader)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'role', 'img')
    return this
  }

  /**
   * Valida error de carga
   */
  validateLoadingError() {
    cy.get('[data-cy="loading-error"]').should('be.visible')
    return this
  }

  /**
   * Valida mensaje de error
   */
  validateErrorMessage() {
    cy.get('[data-cy="error-message"]').should('be.visible')
      .and('not.be.empty')
    return this
  }

  /**
   * Valida botón de reintentar
   */
  validateRetryButton() {
    cy.get('[data-cy="retry-button"]').should('be.visible')
      .and('be.enabled')
    return this
  }

  /**
   * Valida timeout de carga
   */
  validateLoadingTimeout() {
    cy.get('[data-cy="loading-timeout"]').should('be.visible')
    return this
  }

  /**
   * Valida mensaje de timeout
   */
  validateTimeoutMessage() {
    cy.get('[data-cy="timeout-message"]').should('be.visible')
      .and('contain.text', 'timeout')
    return this
  }

  /**
   * Valida texto de carga específico del idioma
   */
  validateLoadingTextLanguage(lang) {
    cy.get(LoadingStates.selectors.loadingText).then(($text) => {
      if ($text.length > 0) {
        const loadingText = $text.text().toLowerCase()
        
        switch (lang) {
          case 'es':
            expect(loadingText).to.match(/cargando|loading/i)
            break
          case 'en':
            expect(loadingText).to.match(/loading/i)
            break
          case 'fr':
            expect(loadingText).to.match(/chargement/i)
            break
          case 'de':
            expect(loadingText).to.match(/laden/i)
            break
        }
      }
    })
    return this
  }
}
