/**
 * PermissionDenied - Page Object Model Class
 *
 * POM for Permission Denied component displayed when users
 * access routes without proper permissions.
 */
export class PermissionDenied {
  static selectors = {
    container: '[data-cy="permission-denied"]',
    title: '[data-cy="permission-denied-title"]',
    message: '[data-cy="permission-denied-message"]',
    backButton: '[data-cy="permission-denied-back"]',
    homeButton: '[data-cy="permission-denied-home"]',
  }

  /**
   * Validate permission denied component is visible
   */
  validateVisible() {
    cy.get(PermissionDenied.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate permission denied component is not visible
   */
  validateNotVisible() {
    cy.get(PermissionDenied.selectors.container).should('not.exist')
    return this
  }

  /**
   * Validate the error message contains expected text
   * @param {string} expectedMessage - The expected message text
   */
  validateMessage(expectedMessage) {
    cy.get(PermissionDenied.selectors.message)
      .should('contain.text', expectedMessage)
    return this
  }

  /**
   * Click back button to return to previous page
   */
  clickBack() {
    cy.get(PermissionDenied.selectors.backButton).click()
    return this
  }

  /**
   * Click home button to navigate to dashboard
   */
  clickHome() {
    cy.get(PermissionDenied.selectors.homeButton).click()
    return this
  }

  /**
   * Validate the title of permission denied message
   * @param {string} expectedTitle - The expected title text
   */
  validateTitle(expectedTitle) {
    cy.get(PermissionDenied.selectors.title)
      .should('contain.text', expectedTitle)
    return this
  }
}
