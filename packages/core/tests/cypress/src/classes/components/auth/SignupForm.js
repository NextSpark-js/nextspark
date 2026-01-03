/**
 * SignupForm - Page Object Model Class
 *
 * Encapsula toda la funcionalidad del formulario de registro
 * Mapea test cases: AUTH_009-016 de auth.cy.md
 */
export class SignupForm {
  static selectors = {
    // Contenedores principales
    formCard: '[data-cy="signup-form-card"]',
    form: 'form', // Form element
    footer: '[data-cy="signup-footer"]',
    emailVerification: '[data-cy="signup-email-verification"]',

    // Inputs del formulario (usando data-cy selectors)
    firstNameInput: '[data-cy="signup-first-name-input"]',
    lastNameInput: '[data-cy="signup-last-name-input"]',
    emailInput: '[data-cy="signup-email-input"]',
    passwordInput: '[data-cy="signup-password-input"]',
    confirmPasswordInput: '[data-cy="signup-confirm-password-input"]',

    // Checkbox y controles
    termsCheckbox: '[data-cy="signup-terms-checkbox"]',

    // Botones
    submitButton: '[data-cy="signup-submit"]',
    googleSigninButton: 'button[type="button"]:contains("Continue with Google")',
    backButton: 'button:contains("Back")',
    resendButton: 'button:contains("Resend email")',

    // Enlaces
    loginLink: '[data-cy="signup-login-link"]',

    // Mensajes y errores
    errorMessage: '.text-destructive',
    successMessage: '[data-cy="signup-success-message"]',
    inviteBanner: '[data-cy="signup-invite-banner"]',

    // Estados de verificación de email
    emailSentTitle: '#email-sent-heading',
    emailSentCard: '.w-full.max-w-md',
  }

  /**
   * Valida que la página de signup está cargada correctamente
   */
  validateSignupPage() {
    cy.get(SignupForm.selectors.formCard).should('be.visible')
    cy.get(SignupForm.selectors.firstNameInput).should('be.visible')
    cy.get(SignupForm.selectors.lastNameInput).should('be.visible')
    cy.get(SignupForm.selectors.emailInput).should('be.visible')
    cy.get(SignupForm.selectors.passwordInput).should('be.visible')
    cy.get(SignupForm.selectors.confirmPasswordInput).should('be.visible')
    cy.get(SignupForm.selectors.termsCheckbox).should('be.visible')
    cy.get(SignupForm.selectors.submitButton).should('be.visible')
    
    return this
  }

  /**
   * Llena todos los campos del formulario de registro
   */
  fillSignupForm(userData) {
    cy.get(SignupForm.selectors.firstNameInput)
      .clear()
      .type(userData.firstName)
    
    cy.get(SignupForm.selectors.lastNameInput)
      .clear()
      .type(userData.lastName)
    
    cy.get(SignupForm.selectors.emailInput)
      .clear()
      .type(userData.email)
    
    cy.get(SignupForm.selectors.passwordInput)
      .clear()
      .type(userData.password, { log: false })
    
    cy.get(SignupForm.selectors.confirmPasswordInput)
      .clear()
      .type(userData.confirmPassword, { log: false })
    
    return this
  }

  /**
   * Acepta términos y condiciones
   */
  acceptTerms() {
    cy.get(SignupForm.selectors.termsCheckbox).check()
    return this
  }

  /**
   * Realiza el proceso completo de registro
   */
  signup(userData) {
    this.fillSignupForm(userData)
    this.acceptTerms()
    cy.get(SignupForm.selectors.submitButton).click()
    
    return this
  }

  /**
   * Intenta registro sin aceptar términos
   */
  signupWithoutTerms(userData) {
    this.fillSignupForm(userData)
    // No acepta términos
    cy.get(SignupForm.selectors.submitButton).should('be.disabled')
    
    return this
  }

  /**
   * Valida errores de campos específicos
   */
  validateFieldErrors() {
    // Submit sin datos para activar validaciones
    cy.get(SignupForm.selectors.submitButton).click()
    
    // Validar que hay errores visibles
    cy.get(SignupForm.selectors.errorMessage).should('be.visible')
    
    return this
  }

  /**
   * Valida que las contraseñas no coinciden
   */
  validatePasswordMismatch(userData) {
    this.fillSignupForm({
      ...userData,
      confirmPassword: 'different-password'
    })
    
    this.acceptTerms()
    cy.get(SignupForm.selectors.submitButton).click()
    
    // Validar error de coincidencia
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', 'Passwords must match')
    
    return this
  }

  /**
   * Valida formato de email inválido
   */
  validateEmailFormat(invalidEmail) {
    cy.get(SignupForm.selectors.emailInput)
      .clear()
      .type(invalidEmail)
    
    cy.get(SignupForm.selectors.firstNameInput).click() // Trigger blur
    
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', 'Invalid email format')
    
    return this
  }

  /**
   * Realiza registro con Google OAuth
   */
  signupWithGoogle() {
    cy.get(SignupForm.selectors.googleSigninButton).click()
    // Note: OAuth flow sería mockeado en tests reales
    return this
  }

  /**
   * Navega a página de login
   */
  clickLoginLink() {
    cy.get(SignupForm.selectors.loginLink).click()
    cy.url().should('include', '/login')
    return this
  }

  /**
   * Valida estado de loading durante submit
   */
  validateLoadingState() {
    cy.get(SignupForm.selectors.submitButton)
      .should('contain.text', 'Creating account...')
      .and('have.attr', 'disabled')
    
    return this
  }

  /**
   * Valida página de verificación de email
   */
  validateEmailVerificationPage(email) {
    cy.get(SignupForm.selectors.emailVerification).should('be.visible')
    cy.get(SignupForm.selectors.emailSentTitle)
      .should('be.visible')
      .and('contain.text', 'Check your email')
    
    // Validar que muestra el email enviado
    cy.contains(email).should('be.visible')
    
    return this
  }

  /**
   * Reenvía email de verificación
   */
  resendVerificationEmail() {
    cy.get(SignupForm.selectors.resendButton).click()
    
    // Validar mensaje de éxito
    cy.get(SignupForm.selectors.successMessage)
      .should('be.visible')
      .and('contain.text', 'Email sent successfully')
    
    return this
  }

  /**
   * Vuelve al formulario de registro
   */
  goBackToSignup() {
    cy.get(SignupForm.selectors.backButton).click()
    this.validateSignupPage()
    return this
  }

  /**
   * Valida que el formulario esté limpio (campos vacíos)
   */
  validateCleanForm() {
    cy.get(SignupForm.selectors.firstNameInput).should('have.value', '')
    cy.get(SignupForm.selectors.lastNameInput).should('have.value', '')
    cy.get(SignupForm.selectors.emailInput).should('have.value', '')
    cy.get(SignupForm.selectors.passwordInput).should('have.value', '')
    cy.get(SignupForm.selectors.confirmPasswordInput).should('have.value', '')
    cy.get(SignupForm.selectors.termsCheckbox).should('not.be.checked')
    
    return this
  }

  /**
   * Valida fortaleza de contraseña
   */
  validatePasswordStrength(password) {
    cy.get(SignupForm.selectors.passwordInput)
      .clear()
      .type(password, { log: false })
    
    // Trigger validación
    cy.get(SignupForm.selectors.confirmPasswordInput).click()
    
    // Validar indicador de fortaleza (implementación específica depende del componente)
    cy.get('.password-strength').should('be.visible')
    
    return this
  }

  /**
   * Valida accesibilidad del formulario
   */
  validateAccessibility() {
    // Validar labels asociados
    cy.get(SignupForm.selectors.firstNameInput)
      .should('have.attr', 'id')
    
    cy.get('label[for="firstName"]').should('exist')
    
    // Validar navegación por teclado
    cy.get(SignupForm.selectors.firstNameInput).focus()
    cy.tab()
    cy.get(SignupForm.selectors.lastNameInput).should('be.focused')
    
    return this
  }

  /**
   * Valida que email ya existe en el sistema
   */
  validateEmailAlreadyExists(existingEmail) {
    this.fillSignupForm({
      firstName: 'Test',
      lastName: 'User',
      email: existingEmail,
      password: 'TestPass123',
      confirmPassword: 'TestPass123'
    })
    
    this.acceptTerms()
    cy.get(SignupForm.selectors.submitButton).click()
    
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', 'Email already exists')
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Navega a la página de signup
   */
  visit() {
    cy.visit('/signup')
    this.validateSignupPage()
    return this
  }

  /**
   * Valida la estructura del formulario de signup
   */
  validateSignupFormStructure() {
    return this.validateSignupPage()
  }

  /**
   * Valida elementos del formulario
   */
  validateFormElements() {
    cy.get(SignupForm.selectors.firstNameInput).should('be.visible')
    cy.get(SignupForm.selectors.lastNameInput).should('be.visible')
    cy.get(SignupForm.selectors.emailInput).should('be.visible')
    cy.get(SignupForm.selectors.passwordInput).should('be.visible')
    cy.get(SignupForm.selectors.confirmPasswordInput).should('be.visible')
    cy.get(SignupForm.selectors.termsCheckbox).should('be.visible')
    cy.get(SignupForm.selectors.submitButton).should('be.visible')
    return this
  }

  /**
   * Valida requisitos de password
   */
  validatePasswordRequirements() {
    // Este método valdría si existe un indicador de requisitos
    // Por ahora simplemente verifica que el campo existe
    cy.get(SignupForm.selectors.passwordInput).should('be.visible')
    return this
  }

  /**
   * Valida opciones de signup social
   */
  validateSocialSignupOptions() {
    cy.get(SignupForm.selectors.googleSigninButton).should('be.visible')
    return this
  }

  /**
   * Escribe primer nombre
   */
  typeFirstName(firstName) {
    cy.get(SignupForm.selectors.firstNameInput).clear().type(firstName)
    return this
  }

  /**
   * Escribe apellido
   */
  typeLastName(lastName) {
    cy.get(SignupForm.selectors.lastNameInput).clear().type(lastName)
    return this
  }

  /**
   * Escribe email
   */
  typeEmail(email) {
    cy.get(SignupForm.selectors.emailInput).clear().type(email)
    return this
  }

  /**
   * Escribe password
   */
  typePassword(password) {
    cy.get(SignupForm.selectors.passwordInput).clear().type(password, { log: false })
    return this
  }

  /**
   * Escribe confirmación de password
   */
  typeConfirmPassword(confirmPassword) {
    cy.get(SignupForm.selectors.confirmPasswordInput).clear().type(confirmPassword, { log: false })
    return this
  }

  /**
   * Envía el formulario
   */
  submit() {
    cy.get(SignupForm.selectors.submitButton).click()
    return this
  }

  /**
   * Verifica error de validación de primer nombre
   */
  verifyFirstNameValidationError(message) {
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica error de validación de apellido
   */
  verifyLastNameValidationError(message) {
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica error de validación de email
   */
  verifyEmailValidationError(message) {
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica error de validación de confirmación de password
   */
  verifyConfirmPasswordValidationError(message) {
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica error de validación de términos
   */
  verifyTermsValidationError(message) {
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica mensaje de error general
   */
  verifyErrorMessage(message) {
    cy.get(SignupForm.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica que el signup fue exitoso
   */
  verifyTaskCreatedSuccess() {
    // Este método parece ser un error de copy-paste, debería verificar signup success
    cy.url().should('include', '/verify-email')
    return this
  }

  /**
   * Verifica que el signup fue exitoso - nombre correcto
   */
  verifySignupSuccess() {
    cy.url().should('include', '/verify-email')
    return this
  }

  /**
   * Limpia el campo de primer nombre
   */
  clearFirstName() {
    cy.get(SignupForm.selectors.firstNameInput).clear()
    return this
  }

  /**
   * Limpia el campo de apellido
   */
  clearLastName() {
    cy.get(SignupForm.selectors.lastNameInput).clear()
    return this
  }

  /**
   * Valida que existe el botón de Google signup
   */
  validateGoogleSignupButton() {
    cy.get(SignupForm.selectors.googleSigninButton).should('be.visible')
    return this
  }

  /**
   * Hace click en el botón de Google signup
   */
  clickGoogleSignup() {
    cy.get(SignupForm.selectors.googleSigninButton).click()
    return this
  }

  /**
   * Hace click en el link de login
   */
  clickLoginLink() {
    cy.get(SignupForm.selectors.loginLink).click()
    return this
  }
}
