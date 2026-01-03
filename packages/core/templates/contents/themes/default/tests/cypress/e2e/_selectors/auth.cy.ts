/**
 * UI Selectors Validation: Authentication
 *
 * This test validates that authentication component selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate AuthPOM selectors work correctly
 * - Ensure all auth.* selectors from CORE_SELECTORS are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to auth pages (NO login required - public pages)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 */

import { AuthPOM } from '../../src/core/AuthPOM'

describe('Auth Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const auth = AuthPOM.create()

  // ============================================
  // LOGIN PAGE SELECTORS (18 selectors)
  // ============================================
  describe('Login Page Selectors - Card & Structure', () => {
    beforeEach(() => {
      auth.visitLogin()
      // Wait for card to be visible (form may not be visible by default)
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

    // Note: Invite banner only shows when invited
    it.skip('should find invite banner (requires invite token)', () => {
      cy.get(auth.selectors.loginInviteBanner).should('exist')
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

    // Note: Error selectors only appear when there's an error
    it('should find email error when validation fails', () => {
      cy.get(auth.selectors.loginSubmit).click()
      cy.get(auth.selectors.loginEmailError).should('exist')
    })

    it('should find password error when validation fails', () => {
      cy.get(auth.selectors.loginEmail).type('test@example.com')
      cy.get(auth.selectors.loginSubmit).click()
      cy.get(auth.selectors.loginPasswordError).should('exist')
    })

    it('should find error alert after failed login', () => {
      cy.get(auth.selectors.loginEmail).type('nonexistent@example.com')
      cy.get(auth.selectors.loginPassword).type('wrongpassword')
      cy.get(auth.selectors.loginSubmit).click()
      cy.get(auth.selectors.loginError, { timeout: 10000 }).should('exist')
    })
  })

  // ============================================
  // SIGNUP PAGE SELECTORS (11 selectors)
  // ============================================
  describe('Signup Page Selectors', () => {
    beforeEach(() => {
      auth.visitSignup()
      auth.waitForSignupForm()
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

    // Note: Google signup button not implemented in current SignupForm
    it.skip('should find Google signup button (not implemented)', () => {
      cy.get(auth.selectors.signupGoogle).should('exist')
    })

    it('should find login link', () => {
      cy.get(auth.selectors.signupLoginLink).should('exist')
    })

    // Note: Invite banner only shows when invited
    it.skip('should find invite banner (requires invite token)', () => {
      cy.get(auth.selectors.signupInviteBanner).should('exist')
    })

    // Note: Error message selector not implemented in current SignupForm
    it.skip('should find error message (selector not implemented)', () => {
      cy.get(auth.selectors.signupError).should('exist')
    })
  })

  // ============================================
  // FORGOT PASSWORD SELECTORS (8 selectors)
  // ============================================
  describe('Forgot Password Selectors', () => {
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

    // Note: Success message only appears after successful submission
    it.skip('should find success message (requires successful submission)', () => {
      cy.get(auth.selectors.forgotPasswordSuccess).should('exist')
    })

    // Note: Success back link only appears in success state
    it.skip('should find success back link (requires success state)', () => {
      cy.get(auth.selectors.forgotPasswordSuccessBack).should('exist')
    })

    // Note: Retry button only appears in success state
    it.skip('should find retry button (requires success state)', () => {
      cy.get(auth.selectors.forgotPasswordRetry).should('exist')
    })

    // Note: Error only appears on server error response
    it.skip('should find error message (requires server error)', () => {
      cy.get(auth.selectors.forgotPasswordError).should('exist')
    })
  })

  // ============================================
  // DEV KEYRING SELECTORS (4 selectors)
  // ============================================
  describe('DevKeyring Selectors', () => {
    beforeEach(() => {
      auth.visitLogin()
      // Wait for login card (not form - form may not be visible by default)
      cy.get(auth.selectors.loginCard, { timeout: 10000 }).should('be.visible')
    })

    it('should find devkeyring container', () => {
      cy.get(auth.selectors.devKeyring).should('exist')
    })

    it('should find devkeyring trigger', () => {
      cy.get(auth.selectors.devKeyringTrigger).should('exist')
    })

    it('should find devkeyring content when opened', () => {
      auth.openDevKeyring()
      cy.get(auth.selectors.devKeyringContent).should('be.visible')
    })

    it('should find devkeyring user options', () => {
      auth.openDevKeyring()
      // Test first user option (index 0)
      cy.get(auth.selectors.devKeyringUser(0)).should('exist')
    })
  })

  // ============================================
  // RESET PASSWORD SELECTORS (5 selectors) - SKIP
  // Requires valid token from email
  // ============================================
  describe('Reset Password Selectors', () => {
    it.skip('should find reset password form (requires valid token)', () => {
      // These tests are skipped because they require a valid reset token
      // To test: auth.visitResetPassword('valid-token')
      cy.get(auth.selectors.resetPasswordForm).should('exist')
    })

    it.skip('should find password input (requires valid token)', () => {
      cy.get(auth.selectors.resetPasswordPassword).should('exist')
    })

    it.skip('should find confirm password input (requires valid token)', () => {
      cy.get(auth.selectors.resetPasswordConfirm).should('exist')
    })

    it.skip('should find submit button (requires valid token)', () => {
      cy.get(auth.selectors.resetPasswordSubmit).should('exist')
    })

    it.skip('should find error message (requires valid token)', () => {
      cy.get(auth.selectors.resetPasswordError).should('exist')
    })
  })

  // ============================================
  // VERIFY EMAIL SELECTORS (4 selectors) - SKIP
  // Requires pending verification state
  // ============================================
  describe('Verify Email Selectors', () => {
    it.skip('should find verify email container (requires pending verification)', () => {
      cy.get(auth.selectors.verifyEmailContainer).should('exist')
    })

    it.skip('should find resend button (requires pending verification)', () => {
      cy.get(auth.selectors.verifyEmailResend).should('exist')
    })

    it.skip('should find success message (requires verification complete)', () => {
      cy.get(auth.selectors.verifyEmailSuccess).should('exist')
    })

    it.skip('should find error message (requires verification failure)', () => {
      cy.get(auth.selectors.verifyEmailError).should('exist')
    })
  })
})
