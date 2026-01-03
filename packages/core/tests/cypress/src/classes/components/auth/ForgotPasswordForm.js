/**
 * ForgotPasswordForm - Page Object Model Class
 *
 * POM for the forgot password page.
 */
export class ForgotPasswordForm {
  static selectors = {
    formCard: '[data-cy="forgot-password-form"]',
    successCard: '[data-cy="forgot-password-success"]',
    emailInput: '[data-cy="forgot-password-email-input"]',
    submitButton: '[data-cy="forgot-password-submit"]',
    backLink: '[data-cy="forgot-password-back"]',
    successBackLink: '[data-cy="forgot-password-success-back"]',
    retryButton: '[data-cy="forgot-password-retry"]',
    errorAlert: '[data-cy="forgot-password-error"]',
  }

  /**
   * Visit the forgot password page
   */
  visit() {
    cy.visit('/forgot-password')
    return this
  }

  /**
   * Validate page is visible
   */
  validatePageVisible() {
    cy.get(ForgotPasswordForm.selectors.formCard).should('be.visible')
    return this
  }

  /**
   * Type email into the input field
   * @param {string} email - Email to type
   */
  typeEmail(email) {
    cy.get(ForgotPasswordForm.selectors.emailInput).clear().type(email)
    return this
  }

  /**
   * Clear the email input field
   */
  clearEmail() {
    cy.get(ForgotPasswordForm.selectors.emailInput).clear()
    return this
  }

  /**
   * Submit the forgot password form
   */
  submit() {
    cy.get(ForgotPasswordForm.selectors.submitButton).click()
    return this
  }

  /**
   * Validate success message is shown
   */
  validateSuccess() {
    cy.get(ForgotPasswordForm.selectors.successCard).should('be.visible')
    return this
  }

  /**
   * Validate error message is shown
   * @param {string} [message] - Optional error message to validate
   */
  validateError(message) {
    cy.get(ForgotPasswordForm.selectors.errorAlert).should('be.visible')
    if (message) {
      cy.get(ForgotPasswordForm.selectors.errorAlert).should('contain.text', message)
    }
    return this
  }

  /**
   * Click back to login link
   */
  clickBackToLogin() {
    cy.get(ForgotPasswordForm.selectors.backLink).click()
    cy.url().should('include', '/login')
    return this
  }

  /**
   * Click back to login link from success state
   */
  clickSuccessBackToLogin() {
    cy.get(ForgotPasswordForm.selectors.successBackLink).click()
    cy.url().should('include', '/login')
    return this
  }

  /**
   * Click retry button from success state
   */
  clickRetry() {
    cy.get(ForgotPasswordForm.selectors.retryButton).click()
    cy.get(ForgotPasswordForm.selectors.formCard).should('be.visible')
    return this
  }

  /**
   * Request password reset for an email
   * @param {string} email - Email to request reset for
   */
  requestPasswordReset(email) {
    this.typeEmail(email)
    this.submit()
    return this
  }

  /**
   * Validate email input has a specific value
   * @param {string} value - Expected value
   */
  validateEmailValue(value) {
    cy.get(ForgotPasswordForm.selectors.emailInput).should('have.value', value)
    return this
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(ForgotPasswordForm.selectors.submitButton).should('be.disabled')
    return this
  }

  /**
   * Validate submit button is enabled
   */
  validateSubmitEnabled() {
    cy.get(ForgotPasswordForm.selectors.submitButton).should('not.be.disabled')
    return this
  }
}
