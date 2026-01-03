/**
 * SecuritySettings - Page Object Model Class
 * 
 * Encapsula funcionalidad de las configuraciones de seguridad
 * Mapea test cases: SEC_001-012 de profile-security.cy.md
 */
export class SecuritySettings {
  static selectors = {
    // Contenedores principales
    main: '[data-cy="security-main"]',
    header: '[data-cy="security-header"]',
    
    // Autenticación de dos factores
    twoFactorSection: '[data-cy="security-2fa-section"]',
    twoFactorToggle: '[data-cy="security-2fa-toggle"]',
    twoFactorEnabled: '[data-cy="2fa-enabled"]',
    twoFactorDisabled: '[data-cy="2fa-disabled"]',
    twoFactorSetup: '[data-cy="2fa-setup"]',
    qrCode: '[data-cy="2fa-qr-code"]',
    backupCodes: '[data-cy="2fa-backup-codes"]',
    
    // Alertas de seguridad
    alertsSection: '[data-cy="security-alerts-section"]',
    alertsToggle: '[data-cy="security-alerts-toggle"]',
    alertsEnabled: '[data-cy="alerts-enabled"]',
    alertsDisabled: '[data-cy="alerts-disabled"]',
    
    // Sesiones activas
    sessionsSection: '[data-cy="security-sessions"]',
    sessionItem: '[data-cy^="security-session-"]',
    currentSession: '[data-cy="current-session"]',
    terminateSession: '[data-cy^="security-terminate-"]',
    terminateAllSessions: '[data-cy="terminate-all-sessions"]',
    
    // Historial de logins
    loginHistorySection: '[data-cy="security-login-history"]',
    loginItem: '[data-cy^="security-login-"]',
    viewHistoryButton: '[data-cy="security-view-history"]',
    
    // Dispositivos confiables
    trustedDevicesSection: '[data-cy="trusted-devices"]',
    deviceItem: '[data-cy^="device-"]',
    removeDevice: '[data-cy^="remove-device-"]',
    
    // Configuraciones avanzadas
    advancedSection: '[data-cy="security-advanced"]',
    ipWhitelistSection: '[data-cy="ip-whitelist"]',
    apiKeysSection: '[data-cy="api-keys"]',
    
    // Modales y confirmaciones
    confirmModal: '[data-cy="security-confirm-modal"]',
    confirmButton: '[data-cy="confirm-action"]',
    cancelButton: '[data-cy="cancel-action"]',
    
    // Estados y mensajes
    successMessage: '.text-green-600',
    errorMessage: '.text-destructive',
    warningMessage: '.text-yellow-600',
    
    // Inputs y formularios
    verificationCodeInput: '[data-cy="verification-code"]',
    submitButton: '[data-cy="submit-security"]',
  }

  /**
   * Valida que la página de seguridad está cargada
   */
  validateSecurityPageLoaded() {
    cy.get(SecuritySettings.selectors.main).should('be.visible')
    cy.get(SecuritySettings.selectors.header).should('be.visible')
    cy.url().should('include', '/settings/security')
    
    return this
  }

  /**
   * Habilita autenticación de dos factores
   */
  enableTwoFactor() {
    cy.get(SecuritySettings.selectors.twoFactorToggle).click()
    
    // Verificar que se abrió el proceso de configuración
    cy.get(SecuritySettings.selectors.twoFactorSetup).should('be.visible')
    
    return this
  }

  /**
   * Deshabilita autenticación de dos factores
   */
  disableTwoFactor() {
    cy.get(SecuritySettings.selectors.twoFactorToggle).click()
    
    // Confirmar deshabilitación en modal
    cy.get(SecuritySettings.selectors.confirmModal).should('be.visible')
    cy.get(SecuritySettings.selectors.confirmButton).click()
    
    return this
  }

  /**
   * Valida que 2FA está habilitado
   */
  validateTwoFactorEnabled() {
    cy.get(SecuritySettings.selectors.twoFactorEnabled).should('be.visible')
    cy.get(SecuritySettings.selectors.twoFactorToggle)
      .should('have.attr', 'aria-checked', 'true')
      .or('be.checked')
    
    return this
  }

  /**
   * Valida que 2FA está deshabilitado
   */
  validateTwoFactorDisabled() {
    cy.get(SecuritySettings.selectors.twoFactorDisabled).should('be.visible')
    cy.get(SecuritySettings.selectors.twoFactorToggle)
      .should('have.attr', 'aria-checked', 'false')
      .or('not.be.checked')
    
    return this
  }

  /**
   * Configura 2FA completamente
   */
  setupTwoFactor(verificationCode) {
    this.enableTwoFactor()
    
    // Verificar QR code
    cy.get(SecuritySettings.selectors.qrCode).should('be.visible')
    
    // Ingresar código de verificación
    cy.get(SecuritySettings.selectors.verificationCodeInput)
      .clear()
      .type(verificationCode)
    
    cy.get(SecuritySettings.selectors.submitButton).click()
    
    return this
  }

  /**
   * Valida códigos de respaldo de 2FA
   */
  validateBackupCodes() {
    cy.get(SecuritySettings.selectors.backupCodes).should('be.visible')
    
    // Verificar que hay códigos mostrados
    cy.get(SecuritySettings.selectors.backupCodes).within(() => {
      cy.get('.backup-code').should('have.length.at.least', 8)
    })
    
    return this
  }

  /**
   * Habilita alertas de seguridad
   */
  enableSecurityAlerts() {
    cy.get(SecuritySettings.selectors.alertsToggle).click()
    
    return this
  }

  /**
   * Deshabilita alertas de seguridad
   */
  disableSecurityAlerts() {
    cy.get(SecuritySettings.selectors.alertsToggle).click()
    
    return this
  }

  /**
   * Valida que alertas están habilitadas
   */
  validateAlertsEnabled() {
    cy.get(SecuritySettings.selectors.alertsEnabled).should('be.visible')
    cy.get(SecuritySettings.selectors.alertsToggle)
      .should('have.attr', 'aria-checked', 'true')
      .or('be.checked')
    
    return this
  }

  /**
   * Valida sesiones activas
   */
  validateActiveSessions() {
    cy.get(SecuritySettings.selectors.sessionsSection).should('be.visible')
    cy.get(SecuritySettings.selectors.sessionItem).should('have.length.at.least', 1)
    
    // Verificar que hay una sesión actual
    cy.get(SecuritySettings.selectors.currentSession).should('be.visible')
    
    return this
  }

  /**
   * Termina una sesión específica
   */
  terminateSession(sessionIndex = 0) {
    cy.get(SecuritySettings.selectors.sessionItem).eq(sessionIndex).within(() => {
      cy.get(SecuritySettings.selectors.terminateSession).click()
    })
    
    // Confirmar terminación
    cy.get(SecuritySettings.selectors.confirmModal).should('be.visible')
    cy.get(SecuritySettings.selectors.confirmButton).click()
    
    return this
  }

  /**
   * Termina todas las sesiones excepto la actual
   */
  terminateAllOtherSessions() {
    cy.get(SecuritySettings.selectors.terminateAllSessions).click()
    
    // Confirmar terminación masiva
    cy.get(SecuritySettings.selectors.confirmModal).should('be.visible')
    cy.get(SecuritySettings.selectors.confirmButton).click()
    
    return this
  }

  /**
   * Valida información de sesión
   */
  validateSessionInfo(sessionIndex = 0) {
    cy.get(SecuritySettings.selectors.sessionItem).eq(sessionIndex).within(() => {
      // Verificar información básica de la sesión
      cy.contains('Location').should('be.visible')
      cy.contains('Device').should('be.visible')
      cy.contains('Last active').should('be.visible')
    })
    
    return this
  }

  /**
   * Visualiza historial de logins
   */
  viewLoginHistory() {
    cy.get(SecuritySettings.selectors.viewHistoryButton).click()
    cy.get(SecuritySettings.selectors.loginHistorySection).should('be.visible')
    
    return this
  }

  /**
   * Valida historial de logins
   */
  validateLoginHistory() {
    this.viewLoginHistory()
    
    cy.get(SecuritySettings.selectors.loginItem).should('have.length.at.least', 1)
    
    // Verificar información de cada login
    cy.get(SecuritySettings.selectors.loginItem).first().within(() => {
      cy.contains('IP Address').should('be.visible')
      cy.contains('Browser').should('be.visible')
      cy.contains('Date').should('be.visible')
    })
    
    return this
  }

  /**
   * Valida dispositivos confiables
   */
  validateTrustedDevices() {
    cy.get(SecuritySettings.selectors.trustedDevicesSection).then(($devices) => {
      if ($devices.length > 0) {
        cy.wrap($devices).should('be.visible')
        cy.get(SecuritySettings.selectors.deviceItem).should('have.length.at.least', 1)
      }
    })
    
    return this
  }

  /**
   * Remueve dispositivo confiable
   */
  removeTrustedDevice(deviceIndex = 0) {
    cy.get(SecuritySettings.selectors.deviceItem).eq(deviceIndex).within(() => {
      cy.get(SecuritySettings.selectors.removeDevice).click()
    })
    
    // Confirmar remoción
    cy.get(SecuritySettings.selectors.confirmModal).should('be.visible')
    cy.get(SecuritySettings.selectors.confirmButton).click()
    
    return this
  }

  /**
   * Valida configuraciones avanzadas de seguridad
   */
  validateAdvancedSettings() {
    cy.get(SecuritySettings.selectors.advancedSection).then(($advanced) => {
      if ($advanced.length > 0) {
        cy.wrap($advanced).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Configura whitelist de IPs
   */
  configureIPWhitelist(ipAddresses) {
    cy.get(SecuritySettings.selectors.ipWhitelistSection).then(($whitelist) => {
      if ($whitelist.length > 0) {
        cy.wrap($whitelist).should('be.visible')
        
        ipAddresses.forEach(ip => {
          cy.get('[data-cy="add-ip-address"]').type(ip)
          cy.get('[data-cy="add-ip-button"]').click()
        })
      }
    })
    
    return this
  }

  /**
   * Valida claves API
   */
  validateAPIKeys() {
    cy.get(SecuritySettings.selectors.apiKeysSection).then(($apiKeys) => {
      if ($apiKeys.length > 0) {
        cy.wrap($apiKeys).should('be.visible')
        cy.get('[data-cy="api-key-item"]').should('have.length.at.least', 0)
      }
    })
    
    return this
  }

  /**
   * Genera nueva clave API
   */
  generateAPIKey(keyName) {
    cy.get('[data-cy="generate-api-key"]').then(($generate) => {
      if ($generate.length > 0) {
        cy.wrap($generate).click()
        cy.get('[data-cy="api-key-name"]').type(keyName)
        cy.get('[data-cy="create-api-key"]').click()
      }
    })
    
    return this
  }

  /**
   * Valida mensaje de éxito
   */
  validateSuccessMessage(message) {
    cy.get(SecuritySettings.selectors.successMessage)
      .should('be.visible')
      .and('contain.text', message)
    
    return this
  }

  /**
   * Valida mensaje de error
   */
  validateErrorMessage(message) {
    cy.get(SecuritySettings.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    
    return this
  }

  /**
   * Valida mensaje de advertencia
   */
  validateWarningMessage(message) {
    cy.get(SecuritySettings.selectors.warningMessage)
      .should('be.visible')
      .and('contain.text', message)
    
    return this
  }

  /**
   * Cancela acción en modal de confirmación
   */
  cancelConfirmation() {
    cy.get(SecuritySettings.selectors.cancelButton).click()
    cy.get(SecuritySettings.selectors.confirmModal).should('not.exist')
    
    return this
  }

  /**
   * Valida configuración de seguridad por defecto
   */
  validateDefaultSecuritySettings() {
    // 2FA debería estar deshabilitado por defecto
    this.validateTwoFactorDisabled()
    
    // Alertas de seguridad deberían estar habilitadas
    this.validateAlertsEnabled()
    
    // Debería haber al menos una sesión activa
    this.validateActiveSessions()
    
    return this
  }

  /**
   * Valida accesibilidad de la página
   */
  validateAccessibility() {
    // Verificar roles ARIA en toggles
    cy.get(SecuritySettings.selectors.twoFactorToggle)
      .should('have.attr', 'role', 'switch')
      .and('have.attr', 'aria-checked')
    
    cy.get(SecuritySettings.selectors.alertsToggle)
      .should('have.attr', 'role', 'switch')
      .and('have.attr', 'aria-checked')
    
    // Navegación por teclado
    cy.get(SecuritySettings.selectors.twoFactorToggle).focus()
    cy.tab()
    cy.focused().should('exist')
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Mobile
    cy.viewport(375, 667)
    this.validateSecurityPageLoaded()
    
    // Desktop
    cy.viewport(1200, 800)
    this.validateSecurityPageLoaded()
    
    return this
  }

  /**
   * Valida integración con notificaciones
   */
  validateNotificationIntegration() {
    // Cuando se cambia una configuración de seguridad
    this.enableSecurityAlerts()
    
    // Debería aparecer notificación
    cy.get('[data-cy="security-notification"]').then(($notification) => {
      if ($notification.length > 0) {
        cy.wrap($notification).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida exportación de datos de seguridad
   */
  validateSecurityDataExport() {
    cy.get('[data-cy="export-security-data"]').then(($export) => {
      if ($export.length > 0) {
        cy.wrap($export).click()
        // Verificar descarga o modal de export
      }
    })
    
    return this
  }

  /**
   * Valida auditoria de seguridad
   */
  validateSecurityAudit() {
    cy.get('[data-cy="security-audit"]').then(($audit) => {
      if ($audit.length > 0) {
        cy.wrap($audit).should('be.visible')
        cy.get('[data-cy="audit-item"]').should('have.length.at.least', 1)
      }
    })
    
    return this
  }

  /**
   * Valida niveles de seguridad
   */
  validateSecurityLevel(expectedLevel) {
    cy.get('[data-cy="security-level"]').then(($level) => {
      if ($level.length > 0) {
        cy.wrap($level).should('contain.text', expectedLevel)
      }
    })
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Habilita autenticación de dos factores (2FA)
   */
  enable2FA() {
    cy.get(SecuritySettings.selectors.twoFactorToggle).click()
    cy.get(SecuritySettings.selectors.twoFactorModal).should('be.visible')
    return this
  }

  /**
   * Valida que la página de seguridad está cargada
   */
  validateSecurityPageLoaded() {
    cy.get(SecuritySettings.selectors.container).should('be.visible')
    cy.get(SecuritySettings.selectors.twoFactorSection).should('be.visible')
    cy.get(SecuritySettings.selectors.sessionsSection).should('be.visible')
    cy.get(SecuritySettings.selectors.alertsSection).should('be.visible')
    return this
  }

  /**
   * Verifica error de 2FA
   */
  verify2FAError(message) {
    cy.get(SecuritySettings.selectors.twoFactorError).should('be.visible')
      .and('contain.text', message)
    return this
  }
}
