/**
 * UI Selectors Validation: Authentication
 *
 * This test validates that authentication component selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate AuthPOM selectors work correctly
 * - Ensure all auth.* selectors are implemented in UI components
 * - Catch missing data-cy attributes early
 *
 * Scope:
 * - Navigate to auth pages (NO login required - public pages)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds)
 */

import { AuthPOM } from '../../src/core/AuthPOM'

describe('Auth Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const auth = AuthPOM.create()

  // ============================================
  // LOGIN PAGE SELECTORS
  // ============================================
  describe('Login Page Selectors - Card & Structure', () => {
    beforeEach(() => {
      auth.visitLogin()
      // Wait for card to be visible
      cy.get(auth.selectors.loginCard, { timeout: 10000 }).should('be.visible')
    })

    it('should find login card', () => {
      cy.get(auth.selectors.loginCard).should('exist')
    })

    it('should find login header', () => {
      cy.get(auth.selectors.loginHeader).should('exist')
    })

    it('should find login footer', () => {
      cy.get(auth.selectors.loginFooter).should('exist')
    })

    it('should find signup link', () => {
      cy.get(auth.selectors.loginSignupLink).should('exist')
    })

    it('should find Google signin button', () => {
      cy.get(auth.selectors.loginGoogle).should('exist')
    })

    it('should find show email button', () => {
      cy.get(auth.selectors.loginShowEmail).should('exist')
    })
  })

  describe('Login Page Selectors - Email Form', () => {
    beforeEach(() => {
      auth.visitLogin()
      // Wait for card and click show email to reveal form
      cy.get(auth.selectors.loginCard, { timeout: 10000 }).should('be.visible')
      cy.get(auth.selectors.loginShowEmail).click()
      cy.get(auth.selectors.loginForm, { timeout: 5000 }).should('be.visible')
    })

    it('should find login form', () => {
      cy.get(auth.selectors.loginForm).should('exist')
    })

    it('should find login options', () => {
      cy.get(auth.selectors.loginOptions).should('exist')
    })

    it('should find email input', () => {
      cy.get(auth.selectors.loginEmail).should('exist')
    })

    it('should find password input', () => {
      cy.get(auth.selectors.loginPassword).should('exist')
    })

    it('should find submit button', () => {
      cy.get(auth.selectors.loginSubmit).should('exist')
    })

    it('should find forgot password link', () => {
      cy.get(auth.selectors.loginForgotPassword).should('exist')
    })

    it('should find hide email button', () => {
      cy.get(auth.selectors.loginHideEmail).should('exist')
    })

    it('should find remember checkbox', () => {
      cy.get(auth.selectors.loginRememberCheckbox).should('exist')
    })
  })

  // ============================================
  // SIGNUP PAGE SELECTORS
  // ============================================
  describe('Signup Page Selectors', () => {
    beforeEach(() => {
      auth.visitSignup()
      cy.get(auth.selectors.signupForm, { timeout: 10000 }).should('be.visible')
    })

    it('should find signup form', () => {
      cy.get(auth.selectors.signupForm).should('exist')
    })

    it('should find first name input', () => {
      cy.get(auth.selectors.signupFirstName).should('exist')
    })

    it('should find last name input', () => {
      cy.get(auth.selectors.signupLastName).should('exist')
    })

    it('should find email input', () => {
      cy.get(auth.selectors.signupEmail).should('exist')
    })

    it('should find password input', () => {
      cy.get(auth.selectors.signupPassword).should('exist')
    })

    it('should find confirm password input', () => {
      cy.get(auth.selectors.signupConfirmPassword).should('exist')
    })

    it('should find submit button', () => {
      cy.get(auth.selectors.signupSubmit).should('exist')
    })

    it('should find login link', () => {
      cy.get(auth.selectors.signupLoginLink).should('exist')
    })

    it('should find Google signup button', () => {
      cy.get(auth.selectors.signupGoogle).should('exist')
    })
  })

  // ============================================
  // FORGOT PASSWORD PAGE SELECTORS
  // ============================================
  describe('Forgot Password Page Selectors', () => {
    beforeEach(() => {
      auth.visitForgotPassword()
      cy.get(auth.selectors.forgotPasswordForm, { timeout: 10000 }).should('be.visible')
    })

    it('should find forgot password form', () => {
      cy.get(auth.selectors.forgotPasswordForm).should('exist')
    })

    it('should find email input', () => {
      cy.get(auth.selectors.forgotPasswordEmail).should('exist')
    })

    it('should find submit button', () => {
      cy.get(auth.selectors.forgotPasswordSubmit).should('exist')
    })

    it('should find back to login link', () => {
      cy.get(auth.selectors.forgotPasswordBack).should('exist')
    })
  })

  // ============================================
  // DEV KEYRING SELECTORS (Development only)
  // ============================================
  describe('Dev Keyring Selectors', () => {
    beforeEach(() => {
      auth.visitLogin()
      cy.get(auth.selectors.loginCard, { timeout: 10000 }).should('be.visible')
    })

    it('should find dev keyring container', () => {
      cy.get(auth.selectors.devKeyring).should('exist')
    })

    it('should find dev keyring trigger', () => {
      cy.get(auth.selectors.devKeyringTrigger).should('exist')
    })

    it('should find dev keyring content when expanded', () => {
      cy.get(auth.selectors.devKeyringTrigger).click()
      cy.get(auth.selectors.devKeyringContent).should('be.visible')
    })

    it('should find at least one dev user option', () => {
      cy.get(auth.selectors.devKeyringTrigger).click()
      cy.get(auth.selectors.devKeyringUser(0)).should('exist')
    })
  })
})
