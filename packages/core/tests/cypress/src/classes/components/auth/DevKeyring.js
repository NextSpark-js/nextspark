/**
 * DevKeyring - Page Object Model Class
 *
 * POM for the development keyring (test credential selector).
 * This component allows quick switching between test users in development mode.
 *
 * NOTE: DevKeyring only FILLS the login form with credentials.
 * You must still submit the form to complete login.
 *
 * IMPORTANT: Always use email-based methods (selectUserByEmail, quickLoginByEmail)
 * to make tests resilient to user order changes in the DevKeyring config.
 */
export class DevKeyring {
  static selectors = {
    container: '[data-cy="devkeyring-container"]',
    trigger: '[data-cy="devkeyring-trigger"]',
    content: '[data-cy="devkeyring-content"]',
    userItem: '[data-cy^="devkeyring-user-"]',
    // Login form selectors (used after filling credentials)
    loginSubmit: '[data-cy="login-submit"]',
    loginEmail: '#email',
    loginPassword: '#password',
  }

  /**
   * Validate keyring container is visible
   */
  validateVisible() {
    cy.get(DevKeyring.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate keyring is not visible (production mode)
   */
  validateNotVisible() {
    cy.get(DevKeyring.selectors.container).should('not.exist')
    return this
  }

  /**
   * Open the keyring dropdown
   */
  open() {
    cy.get(DevKeyring.selectors.trigger).click()
    cy.get(DevKeyring.selectors.content).should('be.visible')
    return this
  }

  /**
   * Close the keyring dropdown
   */
  close() {
    cy.get('body').click(0, 0)
    cy.get(DevKeyring.selectors.content).should('not.be.visible')
    return this
  }

  /**
   * Select a user by email (fills the form, does NOT submit)
   * @param {string} email - User email to select
   */
  selectUserByEmail(email) {
    this.open()
    cy.get(DevKeyring.selectors.userItem).contains(email).click()
    // Wait for form to be filled
    cy.get(DevKeyring.selectors.loginEmail).should('have.value', email)
    return this
  }

  /**
   * Validate the number of available users
   * @param {number} count - Expected user count
   */
  validateUserCount(count) {
    this.open()
    cy.get(DevKeyring.selectors.userItem).should('have.length', count)
    return this
  }

  /**
   * Validate a user exists in the keyring
   * @param {string} email - User email to check
   */
  validateUserExists(email) {
    this.open()
    cy.get(DevKeyring.selectors.userItem).contains(email).should('exist')
    return this
  }

  /**
   * Submit the login form after credentials are filled
   */
  submitLogin() {
    cy.get(DevKeyring.selectors.loginSubmit).click()
    return this
  }

  /**
   * Quick login with a specific user by email (fills form AND submits)
   * This is the preferred method for login as it's resilient to user order changes.
   * @param {string} email - User email to login with
   */
  quickLoginByEmail(email) {
    // 1. Select user by email (opens dropdown + fills form)
    this.selectUserByEmail(email)

    // 2. Submit the login form
    this.submitLogin()

    // 3. Wait for login to complete
    cy.url().should('include', '/dashboard', { timeout: 10000 })

    return this
  }
}
