/**
 * ResetPasswordForm - Page Object Model Class
 *
 * POM for the reset password page.
 */
export class ResetPasswordForm {
  static selectors = {
    formCard: '[data-cy="reset-password-form"]',
    successCard: '[data-cy="reset-password-success"]',
    passwordInput: '[data-cy="reset-password-password-input"]',
    confirmInput: '[data-cy="reset-password-confirm-input"]',
    submitButton: '[data-cy="reset-password-submit"]',
    errorAlert: '[data-cy="reset-password-error"]',
    loginLink: '[data-cy="reset-password-login-link"]',
    backLink: '[data-cy="reset-password-back"]',
  }

  /**
   * Visit the reset password page with a token
   * @param {string} token - Reset token
   */
  visit(token) {
    cy.visit(`/reset-password?token=${token}`)
    return this
  }

  /**
   * Validate page is visible
   */
  validatePageVisible() {
    cy.get(ResetPasswordForm.selectors.formCard).should('be.visible')
    return this
  }

  /**
   * Type password into the password field
   * @param {string} password - Password to type
   */
  typePassword(password) {
    cy.get(ResetPasswordForm.selectors.passwordInput).clear().type(password, { log: false })
    return this
  }

  /**
   * Type confirm password into the confirm password field
   * @param {string} password - Password to confirm
   */
  typeConfirmPassword(password) {
    cy.get(ResetPasswordForm.selectors.confirmInput).clear().type(password, { log: false })
    return this
  }

  /**
   * Submit the reset password form
   */
  submit() {
    cy.get(ResetPasswordForm.selectors.submitButton).click()
    return this
  }

  /**
   * Validate success message is shown
   */
  validateSuccess() {
    cy.get(ResetPasswordForm.selectors.successCard).should('be.visible')
    return this
  }

  /**
   * Validate error message is shown
   * @param {string} [message] - Optional error message to validate
   */
  validateError(message) {
    cy.get(ResetPasswordForm.selectors.errorAlert).should('be.visible')
    if (message) {
      cy.get(ResetPasswordForm.selectors.errorAlert).should('contain.text', message)
    }
    return this
  }

  /**
   * Click sign in link from success state
   */
  clickSignIn() {
    cy.get(ResetPasswordForm.selectors.loginLink).click()
    cy.url().should('include', '/login')
    return this
  }

  /**
   * Click back to login link
   */
  clickBackToLogin() {
    cy.get(ResetPasswordForm.selectors.backLink).click()
    cy.url().should('include', '/login')
    return this
  }

  /**
   * Reset password with given values
   * @param {string} password - New password
   * @param {string} [confirmPassword] - Confirm password (defaults to password)
   */
  resetPassword(password, confirmPassword) {
    this.typePassword(password)
    this.typeConfirmPassword(confirmPassword || password)
    this.submit()
    return this
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(ResetPasswordForm.selectors.submitButton).should('be.disabled')
    return this
  }

  /**
   * Validate submit button is enabled
   */
  validateSubmitEnabled() {
    cy.get(ResetPasswordForm.selectors.submitButton).should('not.be.disabled')
    return this
  }

  /**
   * Validate form shows invalid token error
   */
  validateInvalidToken() {
    cy.get(ResetPasswordForm.selectors.errorAlert)
      .should('be.visible')
      .and('contain.text', 'token')
    return this
  }
}
