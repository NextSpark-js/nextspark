/**
 * VerifyEmailPage - Page Object Model Class
 *
 * POM for the email verification page.
 */
export class VerifyEmailPage {
  static selectors = {
    loading: '[data-cy="verify-email-loading"]',
    success: '[data-cy="verify-email-success"]',
    error: '[data-cy="verify-email-error"]',
    errorMessage: '[data-cy="verify-email-error-message"]',
    backToSignup: '[data-cy="verify-email-back-signup"]',
    goToLogin: '[data-cy="verify-email-go-login"]',
  }

  /**
   * Visit the verify email page with a token
   * @param {string} token - Verification token
   */
  visit(token) {
    cy.visit(`/verify-email?token=${token}`)
    return this
  }

  /**
   * Validate loading state is visible
   */
  validateLoading() {
    cy.get(VerifyEmailPage.selectors.loading).should('be.visible')
    return this
  }

  /**
   * Validate success state is visible
   */
  validateSuccess() {
    cy.get(VerifyEmailPage.selectors.success).should('be.visible')
    return this
  }

  /**
   * Validate error state is visible
   */
  validateError() {
    cy.get(VerifyEmailPage.selectors.error).should('be.visible')
    return this
  }

  /**
   * Validate error message contains specific text
   * @param {string} message - Expected error message
   */
  validateErrorMessage(message) {
    cy.get(VerifyEmailPage.selectors.errorMessage)
      .should('be.visible')
      .and('contain.text', message)
    return this
  }

  /**
   * Click back to signup button
   */
  clickBackToSignup() {
    cy.get(VerifyEmailPage.selectors.backToSignup).click()
    cy.url().should('include', '/signup')
    return this
  }

  /**
   * Click go to login button
   */
  clickGoToLogin() {
    cy.get(VerifyEmailPage.selectors.goToLogin).click()
    cy.url().should('include', '/login')
    return this
  }

  /**
   * Wait for verification to complete (success or error)
   */
  waitForVerification() {
    cy.get(VerifyEmailPage.selectors.loading).should('not.exist')
    return this
  }

  /**
   * Verify email and expect success
   * @param {string} token - Verification token
   */
  verifyEmailSuccess(token) {
    this.visit(token)
    this.validateSuccess()
    return this
  }

  /**
   * Verify email and expect error
   * @param {string} token - Invalid or expired verification token
   */
  verifyEmailError(token) {
    this.visit(token)
    this.waitForVerification()
    this.validateError()
    return this
  }
}
