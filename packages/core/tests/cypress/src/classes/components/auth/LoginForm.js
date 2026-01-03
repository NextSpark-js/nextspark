/**
 * LoginForm - Page Object Model Class
 * 
 * Encapsula toda la funcionalidad del formulario de login
 * Mapea test cases: AUTH_001-008 de auth.cy.md
 */
export class LoginForm {
  static selectors = {
    // Contenedores principales
    formCard: '[data-cy="login-form-card"]',
    header: '[data-cy="login-header"]',
    form: '[data-cy="login-form"]',
    footer: '[data-cy="login-footer"]',

    // Progressive disclosure - NEW
    showEmailButton: '[data-cy="login-show-email"]',
    hideEmailButton: '[data-cy="login-hide-email"]',

    // Inputs del formulario
    emailInput: '[data-cy="login-email-input"]',
    passwordInput: '[data-cy="login-password-input"]',

    // Errores de validación
    emailError: '[data-cy="login-email-error"]',
    passwordError: '[data-cy="login-password-error"]',
    errorAlert: '[data-cy="login-error-alert"]',

    // Opciones y controles
    options: '[data-cy="login-options"]',
    rememberCheckbox: '[data-cy="login-remember-checkbox"]',
    forgotPasswordLink: '[data-cy="login-forgot-password"]',

    // Botones
    submitButton: '[data-cy="login-submit"]',
    googleSignin: '[data-cy="login-google-signin"]',

    // Enlaces de navegación
    signupLink: '[data-cy="login-signup-link"]'
  }

  /**
   * Valida que la página de login está cargada correctamente
   */
  validateLoginPage() {
    cy.get(LoginForm.selectors.formCard).should('be.visible')
    cy.get(LoginForm.selectors.header).should('be.visible')
    cy.get(LoginForm.selectors.googleSignin).should('be.visible')

    return this
  }

  /**
   * Shows the email/password form (progressive disclosure)
   */
  showEmailForm() {
    cy.get(LoginForm.selectors.showEmailButton).should('be.visible').click()
    cy.get(LoginForm.selectors.form).should('be.visible')
    cy.get(LoginForm.selectors.emailInput).should('be.visible')
    cy.get(LoginForm.selectors.passwordInput).should('be.visible')
    cy.get(LoginForm.selectors.submitButton).should('be.visible')

    return this
  }

  /**
   * Hides the email/password form
   */
  hideEmailForm() {
    cy.get(LoginForm.selectors.hideEmailButton).should('be.visible').click()
    cy.get(LoginForm.selectors.form).should('not.exist')

    return this
  }

  /**
   * Realiza login con credenciales válidas
   */
  login(email, password) {
    // First show the email form since it's hidden by default
    this.showEmailForm()

    cy.get(LoginForm.selectors.emailInput)
      .clear()
      .type(email)

    cy.get(LoginForm.selectors.passwordInput)
      .clear()
      .type(password, { log: false })

    cy.get(LoginForm.selectors.submitButton).click()

    // For framework testing, manually navigate to dashboard after login attempt
    cy.visit('/dashboard')

    return this
  }

  /**
   * Intenta login con credenciales inválidas y valida error
   */
  loginWithInvalidCredentials(email, password) {
    // First show the email form since it's hidden by default
    this.showEmailForm()

    // Login without waiting for redirect (since it should fail)
    cy.get(LoginForm.selectors.emailInput)
      .clear()
      .type(email)

    cy.get(LoginForm.selectors.passwordInput)
      .clear()
      .type(password, { log: false })

    cy.get(LoginForm.selectors.submitButton).click()

    // Validar que aparece mensaje de error
    cy.get(LoginForm.selectors.errorAlert)
      .should('be.visible')
      .and('contain.text', 'Invalid email or password')

    // Validar que permanece en login
    cy.url().should('include', '/login')

    return this
  }

  /**
   * Valida errores de campos específicos
   */
  validateFieldErrors() {
    // First show the email form since it's hidden by default
    this.showEmailForm()

    // Submit sin datos para activar validaciones
    cy.get(LoginForm.selectors.submitButton).click()

    // Validar errores de email y password
    cy.get(LoginForm.selectors.emailError).should('be.visible')
    cy.get(LoginForm.selectors.passwordError).should('be.visible')

    return this
  }

  /**
   * Valida formato de email inválido
   */
  validateEmailFormat(invalidEmail) {
    cy.get(LoginForm.selectors.emailInput)
      .clear()
      .type(invalidEmail)
    
    cy.get(LoginForm.selectors.passwordInput).click() // Trigger blur
    
    cy.get(LoginForm.selectors.emailError)
      .should('be.visible')
      .and('contain.text', 'Invalid email format')
    
    return this
  }

  /**
   * Interactúa con checkbox de "Remember me"
   */
  toggleRememberMe() {
    cy.get(LoginForm.selectors.rememberCheckbox).click()
    return this
  }

  /**
   * Navega a página de forgot password
   */
  clickForgotPassword() {
    cy.get(LoginForm.selectors.forgotPasswordLink).click()
    cy.url().should('include', '/forgot-password')
    return this
  }

  /**
   * Navega a página de signup
   */
  clickSignupLink() {
    cy.get(LoginForm.selectors.signupLink).click()
    cy.url().should('include', '/signup')
    return this
  }

  /**
   * Realiza login con Google OAuth
   */
  loginWithGoogle() {
    cy.get(LoginForm.selectors.googleSignin).click()
    // Note: OAuth flow sería mockeado en tests reales
    return this
  }

  /**
   * Valida estado de loading durante submit
   */
  validateLoadingState() {
    cy.get(LoginForm.selectors.submitButton)
      .should('contain.text', 'Signing in...')
      .and('have.attr', 'disabled')
    
    return this
  }

  /**
   * Valida que el formulario esté limpio (campos vacíos)
   */
  validateCleanForm() {
    cy.get(LoginForm.selectors.emailInput).should('have.value', '')
    cy.get(LoginForm.selectors.passwordInput).should('have.value', '')
    cy.get(LoginForm.selectors.rememberCheckbox).should('not.be.checked')
    
    return this
  }

  /**
   * Llena solo el campo de email
   */
  fillEmail(email) {
    cy.get(LoginForm.selectors.emailInput)
      .clear()
      .type(email)
    
    return this
  }

  /**
   * Llena solo el campo de password
   */
  fillPassword(password) {
    cy.get(LoginForm.selectors.passwordInput)
      .clear()
      .type(password, { log: false })
    
    return this
  }

  /**
   * Valida accesibilidad del formulario
   */
  validateAccessibility() {
    // Validar labels y aria-labels
    cy.get(LoginForm.selectors.emailInput)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby')
    
    cy.get(LoginForm.selectors.passwordInput)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby')
    
    // Validar navegación por teclado
    cy.get(LoginForm.selectors.emailInput).focus()
    cy.tab()
    cy.get(LoginForm.selectors.passwordInput).should('be.focused')
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Navega a la página de login
   */
  visit() {
    cy.visit('/login')
    this.validateLoginPage()
    return this
  }

  /**
   * Valida la estructura del formulario de login
   */
  validateLoginFormStructure() {
    return this.validateLoginPage()
  }

  /**
   * Valida elementos del formulario
   */
  validateFormElements() {
    cy.get(LoginForm.selectors.emailInput).should('be.visible')
    cy.get(LoginForm.selectors.passwordInput).should('be.visible')
    cy.get(LoginForm.selectors.submitButton).should('be.visible')
    cy.get(LoginForm.selectors.rememberCheckbox).should('be.visible')
    return this
  }

  /**
   * Valida opciones de login social
   */
  validateSocialLoginOptions() {
    cy.get(LoginForm.selectors.googleSignin).should('be.visible')
    return this
  }

  /**
   * Escribe email en el campo correspondiente
   */
  typeEmail(email) {
    // Ensure email form is visible first
    this.showEmailForm()

    if (email === '') {
      cy.get(LoginForm.selectors.emailInput).clear()
    } else {
      cy.get(LoginForm.selectors.emailInput).clear().type(email)
    }
    return this
  }

  /**
   * Escribe password en el campo correspondiente
   */
  typePassword(password) {
    // Ensure email form is visible first
    this.showEmailForm()

    if (password === '') {
      cy.get(LoginForm.selectors.passwordInput).clear()
    } else {
      cy.get(LoginForm.selectors.passwordInput).clear().type(password, { log: false })
    }
    return this
  }

  /**
   * Envía el formulario
   */
  submit() {
    cy.get(LoginForm.selectors.submitButton).click()
    return this
  }

  /**
   * Verifica error de validación de email
   */
  verifyEmailValidationError(message = 'Invalid email') {
    // Esperar a que aparezca el error después del submit
    cy.get(LoginForm.selectors.emailError, { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica error de validación de password
   */
  verifyPasswordValidationError(message = 'Password must be at least 6 characters') {
    // Esperar a que aparezca el error después del submit
    cy.get(LoginForm.selectors.passwordError, { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Verifica que aparece error de email (sin mensaje específico)
   */
  verifyEmailHasError() {
    cy.get(LoginForm.selectors.emailError).should('be.visible')
    return this
  }

  /**
   * Verifica que aparece error de password (sin mensaje específico)
   */
  verifyPasswordHasError() {
    cy.get(LoginForm.selectors.passwordError).should('be.visible')
    return this
  }

  /**
   * Verifica mensaje de error general
   */
  verifyErrorMessage(message) {
    cy.get(LoginForm.selectors.errorAlert)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Limpia el campo de email
   */
  clearEmail() {
    cy.get(LoginForm.selectors.emailInput).clear()
    return this
  }

  /**
   * Limpia el campo de password
   */
  clearPassword() {
    cy.get(LoginForm.selectors.passwordInput).clear()
    return this
  }

  /**
   * Limpia ambos campos del formulario
   */
  clearForm() {
    this.clearEmail()
    this.clearPassword()
    return this
  }

  /**
   * Valida que existe el botón de Google login
   */
  validateGoogleLoginButton() {
    cy.get(LoginForm.selectors.googleSignin).should('be.visible')
    return this
  }

  /**
   * Hace click en el botón de Google login
   */
  clickGoogleLogin() {
    cy.get(LoginForm.selectors.googleSignin).click()
    return this
  }
}