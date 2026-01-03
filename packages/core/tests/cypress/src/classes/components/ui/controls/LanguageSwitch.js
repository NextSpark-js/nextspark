/**
 * LanguageSwitch - Page Object Model Class
 * 
 * Encapsula funcionalidad del selector de idioma e internacionalización
 * Mapea test cases: LANG_001-008 de language-switch.cy.md
 */
export class LanguageSwitch {
  static selectors = {
    // Componente principal de selección de idioma
    languageSwitch: '[data-cy="language-switch"]',
    languageSwitchSelector: '[data-cy="language-selector"]',
    
    // Trigger del dropdown (si es dropdown en lugar de select)
    languageDropdownTrigger: '[data-cy="language-dropdown-trigger"]',
    languageDropdown: '[data-cy="language-dropdown"]',
    
    // Opciones de idioma específicas
    languageOptionEn: '[data-cy="language-option-en"]',
    languageOptionEs: '[data-cy="language-option-es"]',
    languageOptionFr: '[data-cy="language-option-fr"]',
    languageOptionDe: '[data-cy="language-option-de"]',
    
    // Estados y displays
    currentLanguage: '[data-cy="current-language"]',
    selectedLanguage: '[data-cy="selected-language"]',
    languageIndicator: '[data-cy="language-indicator"]',
    
    // En ProfileForm (desde selector encontrado)
    profileLanguageSelect: '[data-cy="profile-language-select"]',
    
    // Elementos de UI que cambian con el idioma
    pageTitle: 'h1',
    navigationLabels: '[data-cy="nav-label"]',
    buttonTexts: 'button',
    formLabels: 'label',
    
    // Indicadores de cambio de idioma
    languageChanging: '[data-cy="language-changing"]',
    languageChanged: '[data-cy="language-changed"]',
    
    // Configuración de idioma
    languageSettings: '[data-cy="language-settings"]',
    autoDetect: '[data-cy="auto-detect-language"]',
    saveLanguage: '[data-cy="save-language"]',
    
    // Fallbacks y loading
    languageLoading: '[data-cy="language-loading"]',
    translationLoading: '[data-cy="translation-loading"]',
    fallbackText: '[data-cy="fallback-text"]',
    
    // Elementos específicos para validar traducciones
    welcomeMessage: '[data-cy="welcome-message"]',
    loginButton: '[data-cy="login-submit"]',
    signupButton: '[data-cy="signup-submit"]',
    dashboardTitle: '[data-cy="dashboard-title"]',
    
    // Regional y formato
    dateFormat: '[data-cy="date-format"]',
    numberFormat: '[data-cy="number-format"]',
    currencyFormat: '[data-cy="currency-format"]',
  }

  /**
   * Valida que el selector de idioma está visible
   */
  validateLanguageSwitchVisible() {
    cy.get(LanguageSwitch.selectors.languageSwitch).then(($switch) => {
      if ($switch.length > 0) {
        cy.wrap($switch).should('be.visible')
      } else {
        // Verificar en ProfileForm
        cy.get(LanguageSwitch.selectors.profileLanguageSelect).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Cambia idioma usando select
   */
  switchLanguage(language) {
    cy.get(LanguageSwitch.selectors.languageSwitch).then(($switch) => {
      if ($switch.length > 0) {
        cy.wrap($switch).select(language)
      } else {
        // Usar el selector en ProfileForm
        cy.get(LanguageSwitch.selectors.profileLanguageSelect).select(language)
      }
    })
    
    return this
  }

  /**
   * Cambia idioma usando dropdown
   */
  switchLanguageWithDropdown(language) {
    cy.get(LanguageSwitch.selectors.languageDropdownTrigger).then(($trigger) => {
      if ($trigger.length > 0) {
        cy.wrap($trigger).click()
        cy.get(LanguageSwitch.selectors.languageDropdown).should('be.visible')
        
        const optionSelectors = {
          'en': LanguageSwitch.selectors.languageOptionEn,
          'es': LanguageSwitch.selectors.languageOptionEs,
          'fr': LanguageSwitch.selectors.languageOptionFr,
          'de': LanguageSwitch.selectors.languageOptionDe
        }
        
        if (optionSelectors[language]) {
          cy.get(optionSelectors[language]).click()
        }
      }
    })
    
    return this
  }

  /**
   * Cambia a inglés
   */
  switchToEnglish() {
    this.switchLanguage('en')
    this.verifyLanguageChange('en')
    
    return this
  }

  /**
   * Cambia a español
   */
  switchToSpanish() {
    this.switchLanguage('es')
    this.verifyLanguageChange('es')
    
    return this
  }

  /**
   * Cambia a francés
   */
  switchToFrench() {
    this.switchLanguage('fr')
    this.verifyLanguageChange('fr')
    
    return this
  }

  /**
   * Cambia a alemán
   */
  switchToGerman() {
    this.switchLanguage('de')
    this.verifyLanguageChange('de')
    
    return this
  }

  /**
   * Verifica que el idioma cambió
   */
  verifyLanguageChange(expectedLanguage) {
    // Verificar atributo lang en HTML
    cy.get('html').should('have.attr', 'lang', expectedLanguage)
    
    // Verificar indicador de idioma actual
    cy.get(LanguageSwitch.selectors.currentLanguage).then(($current) => {
      if ($current.length > 0) {
        cy.wrap($current).should('contain.text', expectedLanguage.toUpperCase())
      }
    })
    
    return this
  }

  /**
   * Valida persistencia del idioma
   */
  validateLanguagePersistence(language) {
    this.switchLanguage(language)
    this.verifyLanguageChange(language)
    
    // Recargar página
    cy.reload()
    
    // Verificar que se mantiene
    this.verifyLanguageChange(language)
    
    return this
  }

  /**
   * Valida traducciones específicas
   */
  validateTranslations(language) {
    this.switchLanguage(language)
    
    const expectedTexts = {
      'en': {
        login: 'Login',
        signup: 'Sign up',
        dashboard: 'Dashboard',
        welcome: 'Welcome'
      },
      'es': {
        login: 'Iniciar sesión',
        signup: 'Registrarse',
        dashboard: 'Panel',
        welcome: 'Bienvenido'
      }
    }
    
    if (expectedTexts[language]) {
      const texts = expectedTexts[language]
      
      // Verificar textos específicos si están presentes
      cy.get(LanguageSwitch.selectors.loginButton).then(($login) => {
        if ($login.length > 0) {
          cy.wrap($login).should('contain.text', texts.login)
        }
      })
      
      cy.get(LanguageSwitch.selectors.welcomeMessage).then(($welcome) => {
        if ($welcome.length > 0) {
          cy.wrap($welcome).should('contain.text', texts.welcome)
        }
      })
    }
    
    return this
  }

  /**
   * Valida detección automática de idioma
   */
  validateAutoDetection() {
    cy.get(LanguageSwitch.selectors.autoDetect).then(($auto) => {
      if ($auto.length > 0) {
        cy.wrap($auto).check()
        
        // Simular configuración de navegador
        cy.window().then((win) => {
          Object.defineProperty(win.navigator, 'language', {
            writable: true,
            value: 'es-ES'
          })
        })
        
        cy.reload()
        this.verifyLanguageChange('es')
      }
    })
    
    return this
  }

  /**
   * Valida estado de carga de traducciones
   */
  validateTranslationLoading() {
    cy.get(LanguageSwitch.selectors.translationLoading).then(($loading) => {
      if ($loading.length > 0) {
        cy.wrap($loading).should('be.visible')
        cy.wrap($loading).should('not.exist', { timeout: 5000 })
      }
    })
    
    return this
  }

  /**
   * Valida fallbacks de traducción
   */
  validateTranslationFallbacks() {
    cy.get(LanguageSwitch.selectors.fallbackText).then(($fallback) => {
      if ($fallback.length > 0) {
        cy.wrap($fallback).should('be.visible')
        // Verificar que muestra texto en idioma por defecto
        cy.wrap($fallback).should('not.be.empty')
      }
    })
    
    return this
  }

  /**
   * Valida formato de fechas según idioma
   */
  validateDateFormat(language) {
    cy.get(LanguageSwitch.selectors.dateFormat).then(($date) => {
      if ($date.length > 0) {
        const dateText = $date.text()
        
        if (language === 'en') {
          // Formato MM/DD/YYYY
          expect(dateText).to.match(/\d{1,2}\/\d{1,2}\/\d{4}/)
        } else if (language === 'es') {
          // Formato DD/MM/YYYY
          expect(dateText).to.match(/\d{1,2}\/\d{1,2}\/\d{4}/)
        }
      }
    })
    
    return this
  }

  /**
   * Valida formato de números según idioma
   */
  validateNumberFormat(language) {
    cy.get(LanguageSwitch.selectors.numberFormat).then(($number) => {
      if ($number.length > 0) {
        const numberText = $number.text()
        
        if (language === 'en') {
          // Formato con punto decimal
          expect(numberText).to.include('.')
        } else if (language === 'es') {
          // Formato con coma decimal
          expect(numberText).to.include(',')
        }
      }
    })
    
    return this
  }

  /**
   * Valida formato de moneda según idioma
   */
  validateCurrencyFormat(language) {
    cy.get(LanguageSwitch.selectors.currencyFormat).then(($currency) => {
      if ($currency.length > 0) {
        const currencyText = $currency.text()
        
        if (language === 'en') {
          expect(currencyText).to.include('$')
        } else if (language === 'es') {
          expect(currencyText).to.include('€').or('include', '$')
        }
      }
    })
    
    return this
  }

  /**
   * Valida dirección de texto (RTL/LTR)
   */
  validateTextDirection(language) {
    const rtlLanguages = ['ar', 'he', 'fa']
    
    if (rtlLanguages.includes(language)) {
      cy.get('html').should('have.attr', 'dir', 'rtl')
    } else {
      cy.get('html').should('have.attr', 'dir', 'ltr')
    }
    
    return this
  }

  /**
   * Valida navegación con idioma cambiado
   */
  validateNavigationWithLanguage(language) {
    this.switchLanguage(language)
    
    // Navegar entre páginas y verificar que mantiene idioma
    cy.visit('/dashboard')
    this.verifyLanguageChange(language)
    
    cy.visit('/dashboard/settings/profile')
    this.verifyLanguageChange(language)
    
    return this
  }

  /**
   * Valida formularios con idioma cambiado
   */
  validateFormsWithLanguage(language) {
    this.switchLanguage(language)
    
    // Verificar labels de formulario
    cy.get(LanguageSwitch.selectors.formLabels).each(($label) => {
      cy.wrap($label).should('not.be.empty')
    })
    
    return this
  }

  /**
   * Guarda configuración de idioma
   */
  saveLanguageSettings() {
    cy.get(LanguageSwitch.selectors.saveLanguage).then(($save) => {
      if ($save.length > 0) {
        cy.wrap($save).click()
        
        // Verificar confirmación
        cy.get('[data-cy="language-saved"]').should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida cambio de idioma en tiempo real
   */
  validateRealTimeLanguageChange() {
    // Cambiar idioma y verificar cambio inmediato
    cy.get(LanguageSwitch.selectors.pageTitle).then(($title) => {
      const originalText = $title.text()
      
      this.switchLanguage('es')
      
      cy.get(LanguageSwitch.selectors.pageTitle).should(($newTitle) => {
        expect($newTitle.text()).not.to.equal(originalText)
      })
    })
    
    return this
  }

  /**
   * Valida accesibilidad del selector
   */
  validateAccessibility() {
    cy.get(LanguageSwitch.selectors.languageSwitch).then(($switch) => {
      if ($switch.length > 0) {
        // Verificar labels ARIA
        cy.wrap($switch).should('have.attr', 'aria-label')
          .or('have.attr', 'aria-labelledby')
        
        // Navegación por teclado
        cy.wrap($switch).focus()
        cy.wrap($switch).should('be.focused')
      }
    })
    
    return this
  }

  /**
   * Valida integración con sistema de autenticación
   */
  validateAuthIntegration() {
    // Cambiar idioma en login
    cy.visit('/login')
    this.switchLanguage('es')
    
    // Verificar que el formulario de login está traducido
    cy.get('[data-cy="login-email-input"]').then(($input) => {
      if ($input.length > 0) {
        cy.wrap($input).should('have.attr', 'placeholder')
      }
    })
    
    return this
  }

  /**
   * Valida estado de indicador de cambio
   */
  validateChangeIndicator() {
    cy.get(LanguageSwitch.selectors.languageChanging).then(($changing) => {
      if ($changing.length > 0) {
        cy.wrap($changing).should('be.visible')
        cy.wrap($changing).should('not.exist')
        cy.get(LanguageSwitch.selectors.languageChanged).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida manejo de idiomas no soportados
   */
  validateUnsupportedLanguage() {
    // Intentar cambiar a idioma no soportado
    cy.window().then((win) => {
      Object.defineProperty(win.navigator, 'language', {
        writable: true,
        value: 'xx-XX' // Idioma inexistente
      })
    })
    
    // Debería fallback al idioma por defecto
    this.verifyLanguageChange('en')
    
    return this
  }

  /**
   * Valida carga lazy de traducciones
   */
  validateLazyTranslationLoading() {
    // Interceptar llamadas de traducciones
    cy.intercept('GET', '**/messages/**').as('translationRequest')
    
    this.switchLanguage('es')
    
    // Verificar que se cargaron las traducciones
    cy.wait('@translationRequest').then((interception) => {
      expect(interception.response.statusCode).to.equal(200)
    })
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Mobile
    cy.viewport(375, 667)
    this.validateLanguageSwitchVisible()
    
    // Desktop
    cy.viewport(1200, 800)
    this.validateLanguageSwitchVisible()
    
    return this
  }

  /**
   * Valida integración con ProfileForm
   */
  validateProfileFormIntegration() {
    cy.visit('/dashboard/settings/profile')
    
    cy.get(LanguageSwitch.selectors.profileLanguageSelect).should('be.visible')
    cy.get(LanguageSwitch.selectors.profileLanguageSelect).select('es')
    
    // Verificar cambio inmediato
    this.verifyLanguageChange('es')
    
    return this
  }
}
