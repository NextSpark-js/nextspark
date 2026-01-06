/**
 * DevKeyringPOM - Page Object Model for Development Keyring
 *
 * POM for the development keyring (test credential selector).
 * This component allows quick switching between test users in development mode.
 *
 * NOTE: DevKeyring only FILLS the login form with credentials.
 * You must still submit the form to complete login.
 *
 * IMPORTANT: Always use email-based methods (selectUserByEmail, quickLoginByEmail)
 * to make tests resilient to user order changes in the DevKeyring config.
 *
 * @version 3.0 - Uses centralized selectors from cySelector()
 */
import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export class DevKeyringPOM extends BasePOM {
  /**
   * Selectors using centralized cySelector()
   */
  get selectors() {
    return {
      container: cySelector('auth.devKeyring.container'),
      trigger: cySelector('auth.devKeyring.trigger'),
      content: cySelector('auth.devKeyring.content'),
      // Prefix selector for all user items (cySelector doesn't support prefix matching)
      userItem: '[data-cy^="devkeyring-user-"]',
      userByIndex: (index: number) => cySelector('auth.devKeyring.user', { index }),
      // Login form selectors (used after filling credentials)
      loginSubmit: cySelector('auth.login.submit'),
      loginEmail: '#email',
      loginPassword: '#password',
    }
  }

  /**
   * Factory method - creates a new instance
   */
  static create(): DevKeyringPOM {
    return new DevKeyringPOM()
  }

  // ============================================
  // Validation Methods
  // ============================================

  /**
   * Validate keyring container is visible
   */
  validateVisible(): this {
    cy.get(this.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate keyring is not visible (production mode)
   */
  validateNotVisible(): this {
    cy.get(this.selectors.container).should('not.exist')
    return this
  }

  // ============================================
  // Dropdown Methods
  // ============================================

  /**
   * Open the keyring dropdown
   */
  open(): this {
    cy.get(this.selectors.trigger).click()
    cy.get(this.selectors.content).should('be.visible')
    return this
  }

  /**
   * Close the keyring dropdown
   */
  close(): this {
    cy.get('body').click(0, 0)
    cy.get(this.selectors.content).should('not.be.visible')
    return this
  }

  // ============================================
  // User Selection Methods
  // ============================================

  /**
   * Select a user by email (fills the form, does NOT submit)
   */
  selectUserByEmail(email: string): this {
    this.open()
    cy.get(this.selectors.userItem).contains(email).click()
    // Wait for form to be filled
    cy.get(this.selectors.loginEmail).should('have.value', email)
    return this
  }

  /**
   * Submit the login form after credentials are filled
   */
  submitLogin(): this {
    cy.get(this.selectors.loginSubmit).click()
    return this
  }

  /**
   * Quick login with a specific user by email (fills form AND submits)
   * This is the preferred method for login as it's resilient to user order changes.
   */
  quickLoginByEmail(email: string): this {
    // 1. Select user by email (opens dropdown + fills form)
    this.selectUserByEmail(email)

    // 2. Submit the login form
    this.submitLogin()

    // 3. Wait for login to complete
    cy.url().should('include', '/dashboard', { timeout: 10000 })

    return this
  }

  // ============================================
  // User Validation Methods
  // ============================================

  /**
   * Validate the number of available users
   */
  validateUserCount(count: number): this {
    this.open()
    cy.get(this.selectors.userItem).should('have.length', count)
    return this
  }

  /**
   * Validate a user exists in the keyring
   */
  validateUserExists(email: string): this {
    this.open()
    cy.get(this.selectors.userItem).contains(email).should('exist')
    return this
  }

  /**
   * Get all user emails from the keyring
   */
  getUserEmails(): Cypress.Chainable<string[]> {
    this.open()
    return cy.get(this.selectors.userItem)
      .then($elements => {
        return Cypress._.map($elements, el => el.innerText.trim())
      })
  }
}

export default DevKeyringPOM
