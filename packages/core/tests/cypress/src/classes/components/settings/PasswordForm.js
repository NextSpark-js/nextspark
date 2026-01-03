/**
 * PasswordForm - Page Object Model Class
 * 
 * Encapsula funcionalidad del formulario de cambio de contraseña
 * Mapea test cases: PROF_009-016 de profile-password.cy.md
 */
export class PasswordForm {
  static selectors = {
    // Contenedores principales
    main: '[data-cy="password-main"]',
    header: '[data-cy="password-header"]',
    form: '[data-cy="password-form"]',
    formElement: '[data-cy="password-form-element"]',
    
    // Estados de la página
    success: '[data-cy="password-success"]',
    error: '[data-cy="password-error"]',
    
    // Campos del formulario
    currentPasswordInput: '[data-cy="password-current-input"]',
    newPasswordInput: '#newPassword',
    confirmPasswordInput: '#confirmPassword',
    
    // Botones y controles
    submitButton: '[data-cy="password-submit"]',
    revokeSessionsCheckbox: '[data-cy="password-revoke-sessions"]',
    
    // Indicadores de contraseña
    strengthIndicator: '[data-cy="password-strength"]',
    strengthBar: '[data-cy="strength-bar"]',
    strengthText: '[data-cy="strength-text"]',
    
    // Validación y mensajes
    validationError: '.text-destructive',
    fieldError: '.text-red-600',
    successMessage: '.text-green-600',
    requirementsList: '[data-cy="password-requirements"]',
    
    // Elementos de seguridad
    lastChanged: '[data-cy="password-last-changed"]',
    securityInfo: '[data-cy="password-security-info"]',
    
    // Modal de confirmación
    confirmModal: '[data-cy="password-change-modal"]',
    confirmButton: '[data-cy="confirm-password-change"]',
    cancelButton: '[data-cy="cancel-password-change"]',
  }

  /**
   * Valida que la página de cambio de contraseña está cargada
   */
  validatePasswordPageLoaded() {
    cy.get(PasswordForm.selectors.main).should('be.visible')
    cy.get(PasswordForm.selectors.header).should('be.visible')
    cy.get(PasswordForm.selectors.form).should('be.visible')
    cy.url().should('include', '/settings/password')
    
    return this
  }

  /**
   * Llena la contraseña actual
   */
  fillCurrentPassword(currentPassword) {
    cy.get(PasswordForm.selectors.currentPasswordInput)
      .clear()
      .type(currentPassword, { log: false })
    
    return this
  }

  /**
   * Llena la nueva contraseña
   */
  fillNewPassword(newPassword) {
    cy.get(PasswordForm.selectors.newPasswordInput)
      .clear()
      .type(newPassword, { log: false })
    
    return this
  }

  /**
   * Confirma la nueva contraseña
   */
  fillConfirmPassword(confirmPassword) {
    cy.get(PasswordForm.selectors.confirmPasswordInput)
      .clear()
      .type(confirmPassword, { log: false })
    
    return this
  }

  /**
   * Habilita revocación de sesiones activas
   */
  enableRevokeActiveSessions() {
    cy.get(PasswordForm.selectors.revokeSessionsCheckbox).check()
    
    return this
  }

  /**
   * Envía el formulario de cambio de contraseña
   */
  submitPasswordChange() {
    cy.get(PasswordForm.selectors.submitButton).click()
    
    return this
  }

  /**
   * Cambia contraseña completamente
   */
  changePassword(passwordData) {
    this.fillCurrentPassword(passwordData.current)
    this.fillNewPassword(passwordData.new)
    this.fillConfirmPassword(passwordData.confirm)
    
    if (passwordData.revokeSessions) {
      this.enableRevokeActiveSessions()
    }
    
    this.submitPasswordChange()
    
    return this
  }

  /**
   * Valida cambio exitoso de contraseña
   */
  validatePasswordChanged() {
    cy.get(PasswordForm.selectors.success)
      .should('be.visible')
      .and('contain.text', 'Password updated successfully')
    
    return this
  }

  /**
   * Valida error en cambio de contraseña
   */
  validatePasswordError(errorMessage) {
    cy.get(PasswordForm.selectors.error)
      .should('be.visible')
      .and('contain.text', errorMessage)
    
    return this
  }

  /**
   * Valida contraseña actual incorrecta
   */
  validateIncorrectCurrentPassword() {
    this.changePassword({
      current: 'wrongpassword',
      new: 'NewPassword123',
      confirm: 'NewPassword123'
    })
    
    this.validatePasswordError('Current password is incorrect')
    
    return this
  }

  /**
   * Valida que las contraseñas no coinciden
   */
  validatePasswordMismatch() {
    this.fillCurrentPassword('CurrentPass123')
    this.fillNewPassword('NewPassword123')
    this.fillConfirmPassword('DifferentPassword123')
    this.submitPasswordChange()
    
    cy.get(PasswordForm.selectors.fieldError)
      .should('be.visible')
      .and('contain.text', 'Passwords do not match')
    
    return this
  }

  /**
   * Valida fortaleza de contraseña
   */
  validatePasswordStrength(password, expectedStrength) {
    this.fillNewPassword(password)
    
    cy.get(PasswordForm.selectors.strengthIndicator).should('be.visible')
    cy.get(PasswordForm.selectors.strengthText)
      .should('contain.text', expectedStrength)
    
    return this
  }

  /**
   * Valida contraseña débil
   */
  validateWeakPassword() {
    this.validatePasswordStrength('123', 'Weak')
    
    return this
  }

  /**
   * Valida contraseña fuerte
   */
  validateStrongPassword() {
    this.validatePasswordStrength('StrongPassword123!@#', 'Strong')
    
    return this
  }

  /**
   * Valida requisitos de contraseña
   */
  validatePasswordRequirements() {
    cy.get(PasswordForm.selectors.requirementsList).should('be.visible')
    cy.get(PasswordForm.selectors.requirementsList).within(() => {
      cy.contains('At least 8 characters').should('be.visible')
      cy.contains('One uppercase letter').should('be.visible')
      cy.contains('One lowercase letter').should('be.visible')
      cy.contains('One number').should('be.visible')
    })
    
    return this
  }

  /**
   * Valida contraseña que no cumple requisitos
   */
  validatePasswordRequirementsNotMet() {
    this.changePassword({
      current: 'CurrentPass123',
      new: 'weak',
      confirm: 'weak'
    })
    
    cy.get(PasswordForm.selectors.fieldError)
      .should('be.visible')
      .and('contain.text', 'Password does not meet requirements')
    
    return this
  }

  /**
   * Valida información de última modificación
   */
  validateLastPasswordChange() {
    cy.get(PasswordForm.selectors.lastChanged).should('be.visible')
    cy.get(PasswordForm.selectors.lastChanged)
      .should('contain.text', 'Last changed')
    
    return this
  }

  /**
   * Valida información de seguridad
   */
  validateSecurityInfo() {
    cy.get(PasswordForm.selectors.securityInfo).should('be.visible')
    
    return this
  }

  /**
   * Valida modal de confirmación
   */
  validateConfirmationModal() {
    cy.get(PasswordForm.selectors.confirmModal).should('be.visible')
    cy.get(PasswordForm.selectors.confirmButton).should('be.visible')
    cy.get(PasswordForm.selectors.cancelButton).should('be.visible')
    
    return this
  }

  /**
   * Confirma cambio de contraseña en modal
   */
  confirmPasswordChangeInModal() {
    cy.get(PasswordForm.selectors.confirmButton).click()
    
    return this
  }

  /**
   * Cancela cambio de contraseña en modal
   */
  cancelPasswordChangeInModal() {
    cy.get(PasswordForm.selectors.cancelButton).click()
    cy.get(PasswordForm.selectors.confirmModal).should('not.exist')
    
    return this
  }

  /**
   * Valida campos vacíos
   */
  validateEmptyFields() {
    this.submitPasswordChange()
    
    cy.get(PasswordForm.selectors.validationError).should('be.visible')
    
    return this
  }

  /**
   * Valida mismo password actual y nuevo
   */
  validateSameCurrentAndNew() {
    const samePassword = 'SamePassword123'
    
    this.changePassword({
      current: samePassword,
      new: samePassword,
      confirm: samePassword
    })
    
    cy.get(PasswordForm.selectors.fieldError)
      .should('be.visible')
      .and('contain.text', 'New password must be different')
    
    return this
  }

  /**
   * Valida accesibilidad del formulario
   */
  validateAccessibility() {
    // Verificar labels y aria-labels
    cy.get(PasswordForm.selectors.currentPasswordInput)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby')
    
    cy.get(PasswordForm.selectors.newPasswordInput)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby')
    
    // Navegación por teclado
    cy.get(PasswordForm.selectors.currentPasswordInput).focus()
    cy.tab()
    cy.get(PasswordForm.selectors.newPasswordInput).should('be.focused')
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Mobile
    cy.viewport(375, 667)
    this.validatePasswordPageLoaded()
    
    // Desktop
    cy.viewport(1200, 800)
    this.validatePasswordPageLoaded()
    
    return this
  }

  /**
   * Valida estado de loading durante cambio
   */
  validateLoadingState() {
    cy.get(PasswordForm.selectors.submitButton)
      .should('contain.text', 'Updating...')
      .and('have.attr', 'disabled')
    
    return this
  }

  /**
   * Valida que terminó de cargar
   */
  validateLoadingCompleted() {
    cy.get(PasswordForm.selectors.submitButton)
      .should('not.contain.text', 'Updating...')
      .and('not.have.attr', 'disabled')
    
    return this
  }

  /**
   * Valida historial de contraseñas
   */
  validatePasswordHistory() {
    cy.get('[data-cy="password-history"]').then(($history) => {
      if ($history.length > 0) {
        cy.wrap($history).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida políticas de seguridad
   */
  validateSecurityPolicies() {
    cy.get('[data-cy="security-policies"]').then(($policies) => {
      if ($policies.length > 0) {
        cy.wrap($policies).should('be.visible')
        cy.wrap($policies).should('contain.text', 'Security Policy')
      }
    })
    
    return this
  }

  /**
   * Valida autenticación de dos factores
   */
  validateTwoFactorIntegration() {
    cy.get('[data-cy="2fa-password-change"]').then(($twofa) => {
      if ($twofa.length > 0) {
        cy.wrap($twofa).should('be.visible')
        cy.get('[data-cy="2fa-code-input"]').should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida revocación de sesiones
   */
  validateSessionRevocation() {
    this.enableRevokeActiveSessions()
    
    cy.get(PasswordForm.selectors.revokeSessionsCheckbox)
      .should('be.checked')
    
    // Verificar texto explicativo
    cy.contains('This will sign you out of all devices')
      .should('be.visible')
    
    return this
  }

  /**
   * Valida integración con configuraciones de seguridad
   */
  validateSecuritySettingsIntegration() {
    cy.get('[data-cy="security-settings-link"]').then(($link) => {
      if ($link.length > 0) {
        cy.wrap($link).click()
        cy.url().should('include', '/settings/security')
      }
    })
    
    return this
  }

  /**
   * Valida notificaciones de cambio de contraseña
   */
  validatePasswordChangeNotification() {
    // Verificar que aparece notificación
    cy.get('[data-cy="password-change-notification"]').then(($notification) => {
      if ($notification.length > 0) {
        cy.wrap($notification).should('be.visible')
        cy.wrap($notification).should('contain.text', 'Email notification sent')
      }
    })
    
    return this
  }

  /**
   * Valida límite de intentos fallidos
   */
  validateFailedAttemptsLimit() {
    // Intentar múltiples veces con contraseña incorrecta
    for (let i = 0; i < 3; i++) {
      this.fillCurrentPassword('wrongpassword')
      this.fillNewPassword('NewPassword123')
      this.fillConfirmPassword('NewPassword123')
      this.submitPasswordChange()
      
      if (i === 2) {
        // En el tercer intento debería mostrar bloqueo temporal
        cy.get(PasswordForm.selectors.error)
          .should('contain.text', 'Too many failed attempts')
      }
    }
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida que el formulario de password está cargado
   */
  validatePasswordFormLoaded() {
    cy.get(PasswordForm.selectors.form).should('be.visible')
    cy.get(PasswordForm.selectors.currentPasswordInput).should('be.visible')
    cy.get(PasswordForm.selectors.newPasswordInput).should('be.visible')
    cy.get(PasswordForm.selectors.confirmPasswordInput).should('be.visible')
    cy.get(PasswordForm.selectors.submitButton).should('be.visible')
    return this
  }

  /**
   * Verifica error de validación de password actual
   */
  verifyCurrentPasswordValidationError(message) {
    cy.get(PasswordForm.selectors.validationError).should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica error de rate limit
   */
  verifyRateLimitError(message) {
    cy.get(PasswordForm.selectors.error).should('be.visible')
      .and('contain.text', message)
    return this
  }
}
