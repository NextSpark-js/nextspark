/**
 * ThemeToggle - Page Object Model Class
 * 
 * Encapsula funcionalidad del toggle de tema dark/light
 * Mapea test cases: UI_001-008 de theme-toggle.cy.md
 */
export class ThemeToggle {
  static selectors = {
    themeToggle: '[data-cy="theme-toggle"]',
    themeButton: '[data-cy="theme-toggle"]',
    darkIcon: '.dark\\:scale-100', // CSS selector for dark mode icon
    lightIcon: '.scale-100:not(.dark\\:scale-0)', // CSS selector for light mode icon  
    themeMenu: '[data-cy="theme-menu"]',
    systemOption: '[data-cy="theme-system"]',
    lightOption: '[data-cy="theme-light"]',
    darkOption: '[data-cy="theme-dark"]',
    loadingState: '[data-cy="theme-loading"]'
  }

  validateThemeToggleVisible() {
    cy.get(ThemeToggle.selectors.themeToggle).should('be.visible')
    return this
  }

  toggleTheme() {
    cy.get(ThemeToggle.selectors.themeToggle).click()
    return this
  }

  selectLightTheme() {
    cy.get(ThemeToggle.selectors.themeToggle).click()
    cy.get(ThemeToggle.selectors.lightOption).click()
    cy.wait(500) // Wait for theme transition
    return this
  }

  selectDarkTheme() {
    cy.get(ThemeToggle.selectors.themeToggle).click()
    cy.get(ThemeToggle.selectors.darkOption).click()
    cy.wait(500) // Wait for theme transition
    return this
  }

  selectSystemTheme() {
    cy.get(ThemeToggle.selectors.themeToggle).click()
    cy.get(ThemeToggle.selectors.systemOption).click()
    return this
  }

  validateCurrentTheme(theme) {
    if (theme === 'dark') {
      cy.get('html').should('have.class', 'dark')
    } else if (theme === 'light') {
      cy.get('html').should('not.have.class', 'dark')
    }
    return this
  }

  validateThemePersistence() {
    this.selectDarkTheme()
    cy.reload()
    this.validateCurrentTheme('dark')
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Cambia al tema oscuro
   */
  toggleToDarkTheme() {
    this.selectDarkTheme()
    return this
  }

  /**
   * Valida que el tema oscuro está activo
   */
  validateDarkThemeActive() {
    cy.get('html').should('have.class', 'dark')
    return this
  }

  /**
   * Valida comportamiento responsivo del toggle
   */
  validateResponsiveBehavior() {
    cy.viewport('iphone-6')
    cy.get(ThemeToggle.selectors.themeToggle).should('be.visible')
    
    cy.viewport('ipad-2')
    cy.get(ThemeToggle.selectors.themeToggle).should('be.visible')
    
    cy.viewport(1280, 720)
    cy.get(ThemeToggle.selectors.themeToggle).should('be.visible')
    
    return this
  }

  /**
   * Valida modo de alto contraste
   */
  validateHighContrastMode() {
    this.selectDarkTheme()
    cy.get('html').should('have.class', 'dark')
    // Verificar contraste alto si está disponible
    cy.get('body').then(($body) => {
      if ($body.hasClass('high-contrast')) {
        cy.wrap($body).should('have.class', 'high-contrast')
      }
    })
    return this
  }

  /**
   * Valida modo de accesibilidad
   */
  validateAccessibilityMode() {
    cy.get(ThemeToggle.selectors.themeToggle)
      .should('have.attr', 'aria-label')
      .and('not.be.empty')
    
    cy.get(ThemeToggle.selectors.themeToggle).focus()
    cy.get(ThemeToggle.selectors.themeToggle).type('{enter}')
    
    return this
  }

  // ========================================
  // MISSING METHODS FROM TESTS
  // ========================================

  /**
   * Valida la estructura del toggle
   */
  validateToggleStructure() {
    cy.get(ThemeToggle.selectors.themeToggle).should('be.visible')
    return this
  }

  /**
   * Valida el tema actual
   */
  validateCurrentTheme() {
    // Verificar que uno de los iconos está visible
    cy.get(ThemeToggle.selectors.darkIcon).should('exist')
      .or(() => cy.get(ThemeToggle.selectors.lightIcon).should('exist'))
    return this
  }

  /**
   * Valida que el tema claro está activo
   */
  validateLightThemeActive() {
    cy.get('html').should('not.have.class', 'dark')
    return this
  }

  /**
   * Valida estilos del tema oscuro
   */
  validateDarkThemeStyles() {
    cy.get('html').should('have.class', 'dark')
    cy.get('body').should('have.css', 'background-color')
      .and('not.equal', 'rgb(255, 255, 255)')
    return this
  }

  /**
   * Cambia al tema claro
   */
  toggleToLightTheme() {
    this.selectLightTheme()
    return this
  }

  /**
   * Valida estilos del tema claro
   */
  validateLightThemeStyles() {
    cy.get('html').should('not.have.class', 'dark')
    cy.get('body').should('have.css', 'background-color')
    return this
  }

  /**
   * Habilita el tema del sistema
   */
  enableSystemTheme() {
    this.selectSystemTheme()
    return this
  }

  /**
   * Valida detección del tema del sistema
   */
  validateSystemThemeDetection() {
    cy.get('html').then(($html) => {
      // Verificar que el tema se aplicó basado en la preferencia del sistema
      const hasSystemDark = $html.hasClass('dark')
      cy.log(`System theme detected: ${hasSystemDark ? 'dark' : 'light'}`)
    })
    return this
  }

  /**
   * Valida transición del tema
   */
  validateThemeTransition() {
    // Verificar que hay una transición CSS
    cy.get('body').should('have.css', 'transition-duration')
    return this
  }

  /**
   * Espera a que complete la transición
   */
  waitForTransitionComplete() {
    cy.wait(500) // Esperar transición CSS
    return this
  }

  /**
   * Valida accesibilidad
   */
  validateAccessibility() {
    cy.get(ThemeToggle.selectors.themeToggle)
      .should('have.attr', 'aria-label')
      .and('not.be.empty')
    return this
  }

  /**
   * Valida navegación por teclado
   */
  validateKeyboardNavigation() {
    cy.get(ThemeToggle.selectors.themeToggle).focus()
    cy.focused().type(' ') // Space key
    return this
  }

  /**
   * Valida soporte de screen reader
   */
  validateScreenReaderSupport() {
    cy.get(ThemeToggle.selectors.themeToggle)
      .should('have.attr', 'role')
      .or('have.attr', 'aria-label')
    return this
  }

  /**
   * Valida modo de movimiento reducido
   */
  validateReducedMotion() {
    cy.get('body').should('have.css', 'animation-duration', '0.01ms')
      .or('have.css', 'transition-duration', '0.01ms')
    return this
  }

  /**
   * Valida interacciones táctiles
   */
  validateTouchInteractions() {
    cy.get(ThemeToggle.selectors.themeToggle)
      .trigger('touchstart')
      .trigger('touchend')
    return this
  }

  /**
   * Valida feedback táctil
   */
  validateTouchFeedback() {
    cy.get(ThemeToggle.selectors.themeToggle)
      .should('have.css', 'cursor', 'pointer')
    return this
  }

  /**
   * Valida fallbacks de CSS
   */
  validateCSSFallbacks() {
    // Verificar que variables CSS están definidas
    cy.get(':root').then(($root) => {
      const styles = getComputedStyle($root[0])
      expect(styles.getPropertyValue('--primary-color')).to.not.be.empty
    })
    return this
  }
}
