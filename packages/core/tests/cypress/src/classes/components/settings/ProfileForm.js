/**
 * ProfileForm - Page Object Model Class
 * 
 * Encapsula funcionalidad del formulario de perfil de usuario
 * Mapea test cases: PROF_001-008 de profile.cy.md
 */
export class ProfileForm {
  static selectors = {
    // Contenedores principales
    main: '[data-cy="profile-main"]',
    header: '[data-cy="profile-header"]',
    form: '[data-cy="profile-form"]',
    formElement: '[data-cy="profile-form-element"]',
    
    // Estados de la página
    loading: '[data-cy="profile-loading"]',
    error: '[data-cy="profile-error"]',
    success: '[data-cy="profile-success"]',
    errorAlert: '[data-cy="profile-error-alert"]',
    
    // Campos del formulario (usando IDs como fallback)
    firstNameInput: '#firstName',
    lastNameInput: '#lastName',
    emailInput: '#email',
    
    // Selectores específicos
    languageSelect: '[data-cy="profile-language-select"]',
    timezoneSelect: '[data-cy="profile-timezone-select"]',
    
    // Botones
    submitButton: '[data-cy="profile-submit"]',
    
    // Sección avanzada
    advancedToggle: '[data-cy="profile-advanced-toggle"]',
    advancedSection: '[data-cy="profile-advanced-section"]',
    deleteAccountButton: '[data-cy="profile-delete-account"]',
    
    // Layout de settings
    layoutMain: '[data-cy="settings-layout-main"]',
    layoutHeader: '[data-cy="settings-layout-header"]',
    layoutSidebar: '[data-cy="settings-layout-sidebar"]',
    pageContent: '[data-cy="settings-layout-page-content"]',
    backToDashboard: '[data-cy="settings-layout-back-to-dashboard"]',
    
    // Validación y mensajes
    validationError: '.text-destructive',
    fieldError: '.text-red-600',
    successMessage: '.text-green-600',
  }

  /**
   * Valida que la página de perfil está cargada
   */
  validateProfilePageLoaded() {
    cy.get(ProfileForm.selectors.main).should('be.visible')
    cy.get(ProfileForm.selectors.header).should('be.visible')
    cy.get(ProfileForm.selectors.form).should('be.visible')
    cy.url().should('include', '/settings/profile')
    
    return this
  }

  /**
   * Valida layout de settings
   */
  validateSettingsLayout() {
    cy.get(ProfileForm.selectors.layoutMain).should('be.visible')
    cy.get(ProfileForm.selectors.layoutSidebar).should('be.visible')
    cy.get(ProfileForm.selectors.pageContent).should('be.visible')
    
    return this
  }

  /**
   * Valida estado de carga
   */
  validateLoadingState() {
    cy.get(ProfileForm.selectors.loading).should('be.visible')
    
    return this
  }

  /**
   * Valida que terminó de cargar
   */
  validateLoadingCompleted() {
    cy.get(ProfileForm.selectors.loading).should('not.exist')
    
    return this
  }

  /**
   * Navega de vuelta al dashboard
   */
  navigateBackToDashboard() {
    cy.get(ProfileForm.selectors.backToDashboard).click()
    cy.url().should('include', '/dashboard')
    
    return this
  }

  /**
   * Type first name directly
   */
  typeFirstName(firstName) {
    cy.get(ProfileForm.selectors.firstNameInput)
      .clear()
      .type(firstName)
    return this
  }

  /**
   * Type last name directly
   */
  typeLastName(lastName) {
    cy.get(ProfileForm.selectors.lastNameInput)
      .clear()
      .type(lastName)
    return this
  }

  /**
   * Llena información básica del perfil
   */
  fillBasicInfo(profileData) {
    if (profileData.firstName) {
      cy.get(ProfileForm.selectors.firstNameInput)
        .clear()
        .type(profileData.firstName)
    }
    
    if (profileData.lastName) {
      cy.get(ProfileForm.selectors.lastNameInput)
        .clear()
        .type(profileData.lastName)
    }
    
    if (profileData.email) {
      cy.get(ProfileForm.selectors.emailInput)
        .clear()
        .type(profileData.email)
    }
    
    return this
  }

  /**
   * Configura idioma del perfil
   */
  selectLanguage(language) {
    cy.get(ProfileForm.selectors.languageSelect).select(language)
    
    return this
  }

  /**
   * Configura timezone del perfil
   */
  selectTimezone(timezone) {
    cy.get(ProfileForm.selectors.timezoneSelect).select(timezone)
    
    return this
  }

  /**
   * Envía el formulario
   */
  submitForm() {
    cy.get(ProfileForm.selectors.submitButton).click()
    
    return this
  }

  /**
   * Actualiza perfil completo
   */
  updateProfile(profileData) {
    this.fillBasicInfo(profileData)
    
    if (profileData.language) {
      this.selectLanguage(profileData.language)
    }
    
    if (profileData.timezone) {
      this.selectTimezone(profileData.timezone)
    }
    
    this.submitForm()
    
    return this
  }

  /**
   * Valida actualización exitosa
   */
  validateProfileUpdated() {
    cy.get(ProfileForm.selectors.success)
      .should('be.visible')
      .and('contain.text', 'Profile updated successfully')
    
    return this
  }

  /**
   * Valida error de actualización
   */
  validateUpdateError(errorMessage) {
    cy.get(ProfileForm.selectors.errorAlert)
      .should('be.visible')
      .and('contain.text', errorMessage)
    
    return this
  }

  /**
   * Valida errores de validación
   */
  validateValidationErrors() {
    // Vaciar campos requeridos y enviar
    cy.get(ProfileForm.selectors.firstNameInput).clear()
    cy.get(ProfileForm.selectors.lastNameInput).clear()
    this.submitForm()
    
    // Verificar errores
    cy.get(ProfileForm.selectors.validationError).should('be.visible')
    
    return this
  }

  /**
   * Valida formato de email inválido
   */
  validateInvalidEmail(invalidEmail) {
    cy.get(ProfileForm.selectors.emailInput)
      .clear()
      .type(invalidEmail)
    
    this.submitForm()
    
    cy.get(ProfileForm.selectors.fieldError)
      .should('be.visible')
      .and('contain.text', 'Invalid email format')
    
    return this
  }

  /**
   * Valida campos pre-llenados
   */
  validatePrefilledData(expectedData) {
    if (expectedData.firstName) {
      cy.get(ProfileForm.selectors.firstNameInput)
        .should('have.value', expectedData.firstName)
    }
    
    if (expectedData.lastName) {
      cy.get(ProfileForm.selectors.lastNameInput)
        .should('have.value', expectedData.lastName)
    }
    
    if (expectedData.email) {
      cy.get(ProfileForm.selectors.emailInput)
        .should('have.value', expectedData.email)
    }
    
    return this
  }

  /**
   * Abre sección avanzada
   */
  openAdvancedSection() {
    cy.get(ProfileForm.selectors.advancedToggle).click()
    cy.get(ProfileForm.selectors.advancedSection).should('be.visible')
    
    return this
  }

  /**
   * Inicia proceso de eliminación de cuenta
   */
  initiateAccountDeletion() {
    this.openAdvancedSection()
    cy.get(ProfileForm.selectors.deleteAccountButton).click()
    
    // Verificar modal de confirmación
    cy.get('[data-cy="delete-account-modal"]').should('be.visible')
    
    return this
  }

  /**
   * Valida confirmación de eliminación de cuenta
   */
  validateAccountDeletionModal() {
    cy.get('[data-cy="delete-account-modal"]').within(() => {
      cy.get('[data-cy="confirm-delete"]').should('be.visible')
      cy.get('[data-cy="cancel-delete"]').should('be.visible')
      cy.contains('This action cannot be undone').should('be.visible')
    })
    
    return this
  }

  /**
   * Cancela eliminación de cuenta
   */
  cancelAccountDeletion() {
    cy.get('[data-cy="cancel-delete"]').click()
    cy.get('[data-cy="delete-account-modal"]').should('not.exist')
    
    return this
  }

  /**
   * Valida límites de caracteres
   */
  validateCharacterLimits() {
    const longName = 'a'.repeat(256) // Nombre muy largo
    
    cy.get(ProfileForm.selectors.firstNameInput)
      .clear()
      .type(longName)
    
    this.submitForm()
    
    cy.get(ProfileForm.selectors.fieldError)
      .should('be.visible')
      .and('contain.text', 'Too long')
    
    return this
  }

  /**
   * Valida cambio de idioma en tiempo real
   */
  validateLanguageChange(newLanguage) {
    this.selectLanguage(newLanguage)
    
    // Verificar que la UI cambió de idioma
    cy.get('html').should('have.attr', 'lang', newLanguage)
    
    return this
  }

  /**
   * Valida accesibilidad del formulario
   */
  validateAccessibility() {
    // Verificar labels
    cy.get(ProfileForm.selectors.firstNameInput)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby')
    
    cy.get(ProfileForm.selectors.lastNameInput)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby')
    
    // Navegación por teclado
    cy.get(ProfileForm.selectors.firstNameInput).focus()
    cy.tab()
    cy.get(ProfileForm.selectors.lastNameInput).should('be.focused')
    
    return this
  }

  /**
   * Valida autoguardado
   */
  validateAutosave() {
    this.fillBasicInfo({ firstName: 'Test Autosave' })
    
    // Esperar indicador de autosave
    cy.wait(2000)
    cy.get('[data-cy="autosave-indicator"]').then(($indicator) => {
      if ($indicator.length > 0) {
        cy.wrap($indicator).should('contain.text', 'Saved')
      }
    })
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Mobile
    cy.viewport(375, 667)
    this.validateProfilePageLoaded()
    
    // Desktop
    cy.viewport(1200, 800)
    this.validateProfilePageLoaded()
    
    return this
  }

  /**
   * Valida integración con otros settings
   */
  validateSettingsNavigation() {
    // Navegar a otras secciones de settings
    cy.get('[data-cy="settings-sidebar-nav-password"]').click()
    cy.url().should('include', '/settings/password')
    
    // Volver a profile
    cy.get('[data-cy="settings-sidebar-nav-profile"]').click()
    cy.url().should('include', '/settings/profile')
    
    return this
  }

  /**
   * Valida cambios sin guardar
   */
  validateUnsavedChanges() {
    this.fillBasicInfo({ firstName: 'Unsaved Changes' })
    
    // Intentar navegar sin guardar
    cy.get('[data-cy="settings-sidebar-nav-password"]').click()
    
    // Buscar modal de confirmación
    cy.get('[data-cy="unsaved-changes-modal"]').then(($modal) => {
      if ($modal.length > 0) {
        cy.wrap($modal).should('be.visible')
        cy.get('[data-cy="discard-changes"]').click()
      }
    })
    
    return this
  }

  /**
   * Valida permisos de edición
   */
  validateEditPermissions(userRole) {
    if (userRole === 'readonly') {
      // Usuario de solo lectura no debería poder editar
      cy.get(ProfileForm.selectors.firstNameInput).should('be.disabled')
      cy.get(ProfileForm.selectors.submitButton).should('be.disabled')
    } else {
      // Usuario normal puede editar
      cy.get(ProfileForm.selectors.firstNameInput).should('not.be.disabled')
      cy.get(ProfileForm.selectors.submitButton).should('not.be.disabled')
    }
    
    return this
  }

  /**
   * Valida estado de error de la página
   */
  validatePageError() {
    cy.get(ProfileForm.selectors.error).should('be.visible')
    
    return this
  }

  /**
   * Valida integración con avatar
   */
  validateAvatarIntegration() {
    cy.get('[data-cy="profile-avatar"]').then(($avatar) => {
      if ($avatar.length > 0) {
        cy.wrap($avatar).should('be.visible')
        cy.wrap($avatar).click()
        
        // Verificar modal de cambio de avatar
        cy.get('[data-cy="avatar-modal"]').should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida histórico de cambios
   */
  validateProfileHistory() {
    cy.get('[data-cy="profile-history"]').then(($history) => {
      if ($history.length > 0) {
        cy.wrap($history).should('be.visible')
        cy.get('[data-cy="history-item"]').should('have.length.at.least', 1)
      }
    })
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida que el formulario de perfil está cargado
   */
  validateProfileFormLoaded() {
    cy.get(ProfileForm.selectors.form).should('be.visible')
    cy.get(ProfileForm.selectors.firstNameInput).should('be.visible')
    cy.get(ProfileForm.selectors.lastNameInput).should('be.visible')
    cy.get(ProfileForm.selectors.emailInput).should('be.visible')
    return this
  }

  /**
   * Valida que el email fue actualizado
   */
  validateEmailUpdated(newEmail) {
    cy.get(ProfileForm.selectors.emailInput).should('have.value', newEmail)
    cy.get(ProfileForm.selectors.successMessage).should('be.visible')
      .and('contain.text', 'Profile updated successfully')
    return this
  }

  /**
   * Verifica error de actualización
   */
  verifyUpdateError(message) {
    cy.get(ProfileForm.selectors.errorMessage).should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Valida error de red
   */
  validateNetworkError() {
    cy.get(ProfileForm.selectors.errorMessage).should('be.visible')
      .and('contain.text', 'Network error')
    return this
  }
}
