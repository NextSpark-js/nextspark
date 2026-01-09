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
 *
 * Test IDs:
 * - SEL_AUTH_001: Login Card Structure
 * - SEL_AUTH_002: Login Form Inputs
 * - SEL_AUTH_003: Signup Form
 * - SEL_AUTH_004: Forgot Password
 * - SEL_AUTH_005: DevKeyring
 * - SEL_AUTH_006: Reset Password (skipped - requires token)
 * - SEL_AUTH_007: Verify Email (skipped - requires state)
 */

import { AuthPOM } from '../../src/core/AuthPOM'

describe('Auth Selectors Validation', { tags: ['@ui-selectors', '@auth'] }, () => {
  const auth = AuthPOM.create()

  // ============================================
  // SEL_AUTH_001: LOGIN CARD STRUCTURE
  // ============================================
  describe('SEL_AUTH_001: Login Card Structure', { tags: '@SEL_AUTH_001' }, () => {
    beforeEach(() => {
      auth.visitLogin()
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

    it.skip('should find invite banner (requires invite token)', () => {
      cy.get(auth.selectors.loginInviteBanner).should('exist')
    })
  })

  // ============================================
  // SEL_AUTH_002: LOGIN FORM INPUTS
  // ============================================
  describe('SEL_AUTH_002: Login Form Inputs', { tags: '@SEL_AUTH_002' }, () => {
    beforeEach(() => {
      auth.visitLogin()
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
  // SEL_AUTH_003: SIGNUP FORM
  // ============================================
  describe('SEL_AUTH_003: Signup Form', { tags: '@SEL_AUTH_003' }, () => {
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

    it('should find Google signup button', () => {
      cy.get(auth.selectors.signupGoogle).should('exist')
    })

    it('should find login link', () => {
      cy.get(auth.selectors.signupLoginLink).should('exist')
    })

    it.skip('should find invite banner (requires invite token)', () => {
      cy.get(auth.selectors.signupInviteBanner).should('exist')
    })

    it('should find error message when email already exists', () => {
      const existingEmail = Cypress.env('DEVELOPER_EMAIL') || 'developer@nextspark.dev'

      cy.get(auth.selectors.signupFirstName).type('Test')
      cy.get(auth.selectors.signupLastName).type('User')
      cy.get(auth.selectors.signupEmail).type(existingEmail)
      cy.get(auth.selectors.signupPassword).type('Test1234!')
      cy.get(auth.selectors.signupConfirmPassword).type('Test1234!')
      cy.get('[data-cy="signup-terms-checkbox"]').click()
      cy.get(auth.selectors.signupSubmit).click()
      cy.get(auth.selectors.signupError, { timeout: 10000 }).should('exist')
    })
  })

  // ============================================
  // SEL_AUTH_004: FORGOT PASSWORD
  // ============================================
  describe('SEL_AUTH_004: Forgot Password', { tags: '@SEL_AUTH_004' }, () => {
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

    it.skip('should find success message (requires successful submission)', () => {
      cy.get(auth.selectors.forgotPasswordSuccess).should('exist')
    })

    it.skip('should find success back link (requires success state)', () => {
      cy.get(auth.selectors.forgotPasswordSuccessBack).should('exist')
    })

    it.skip('should find retry button (requires success state)', () => {
      cy.get(auth.selectors.forgotPasswordRetry).should('exist')
    })

    it.skip('should find error message (requires server error)', () => {
      cy.get(auth.selectors.forgotPasswordError).should('exist')
    })
  })

  // ============================================
  // SEL_AUTH_005: DEVKEYRING
  // ============================================
  describe('SEL_AUTH_005: DevKeyring', { tags: '@SEL_AUTH_005' }, () => {
    beforeEach(() => {
      auth.visitLogin()
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
      cy.get(auth.selectors.devKeyringUser(0)).should('exist')
    })
  })

  // ============================================
  // SEL_AUTH_006: RESET PASSWORD (skipped - requires token)
  // ============================================
  describe('SEL_AUTH_006: Reset Password', { tags: '@SEL_AUTH_006' }, () => {
    it.skip('should find reset password form (requires valid token)', () => {
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
  // SEL_AUTH_007: VERIFY EMAIL (skipped - requires state)
  // ============================================
  describe('SEL_AUTH_007: Verify Email', { tags: '@SEL_AUTH_007' }, () => {
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
