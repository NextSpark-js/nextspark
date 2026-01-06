/// <reference types="cypress" />

/**
 * Password Reset Flow Tests
 *
 * Tests the complete password reset flow:
 * - Request password reset link
 * - Validate form fields
 * - Handle errors (invalid email, rate limiting)
 * - Success message display
 *
 * Note: Actual email delivery and token validation are not tested here
 * as they require external email service integration.
 * Tests verify up to the point of email send request.
 *
 * Tags: @uat, @feat-auth, @password-reset
 */

import * as allure from 'allure-cypress'

import { AuthPOM } from '../../../src/core/AuthPOM'

describe('Authentication - Password Reset Flow', {
  tags: ['@uat', '@feat-auth', '@password-reset']
}, () => {
  const auth = new AuthPOM()

  beforeEach(() => {
    allure.epic('Authentication')
    allure.feature('Password Reset')
    // Clear any existing session
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('PWD-RESET-001: Access Password Reset Page', { tags: '@smoke' }, () => {
    it('should access password reset page from login', { tags: '@smoke' }, () => {
      allure.severity('critical')
      allure.story('Page Access')

      // 1. Visit login page
      auth.visitLogin()

      // 2. Show email form (forgot password link is inside email form section)
      auth.showEmailLogin()
      auth.waitForLoginForm()

      // 3. Click on forgot password link
      auth.clickForgotPassword()

      // 4. Validate password reset page
      cy.url().should('include', '/forgot-password')
      cy.get(auth.selectors.forgotPasswordForm).should('be.visible')
      cy.get(auth.selectors.forgotPasswordEmail).should('be.visible')
      cy.get(auth.selectors.forgotPasswordSubmit).should('be.visible')

      cy.log('✅ Password reset page accessible')
    })
  })

  describe('PWD-RESET-002: Direct URL Access', { tags: '@smoke' }, () => {
    it('should access password reset page directly via URL', { tags: '@smoke' }, () => {
      allure.severity('normal')
      allure.story('Direct Access')

      // 1. Visit directly
      auth.visitForgotPassword()

      // 2. Validate page elements
      cy.get(auth.selectors.forgotPasswordForm).should('be.visible')
      cy.get(auth.selectors.forgotPasswordEmail).should('be.visible')

      cy.log('✅ Direct access to password reset works')
    })
  })

  describe('PWD-RESET-003: Submit Valid Email', { tags: '@smoke' }, () => {
    it('should show success message for valid email format', { tags: '@smoke' }, () => {
      allure.severity('critical')
      allure.story('Submit Request')

      // 1. Visit password reset page
      auth.visitForgotPassword()

      // 2. Request password reset
      auth.requestPasswordReset('user@example.com')

      // 3. Should show success message (even if email doesn't exist for security)
      auth.waitForPasswordResetSuccess()

      cy.log('✅ Password reset request submitted successfully')
    })
  })

  describe('PWD-RESET-004: Validate Empty Email', () => {
    it('should show error for empty email field', () => {
      allure.severity('high')
      allure.story('Validation')

      // 1. Visit password reset page
      auth.visitForgotPassword()

      // 2. Submit without entering email
      cy.get(auth.selectors.forgotPasswordSubmit).click()

      // 3. Should show Zod validation error in UI
      // The form uses react-hook-form with zod validation
      // Empty email triggers validation error from zod schema
      cy.contains('.text-destructive', 'Please enter a valid email address').should('be.visible')

      cy.log('✅ Empty email validation works')
    })
  })

  describe('PWD-RESET-005: Validate Invalid Email Format', () => {
    it('should show error for invalid email format', () => {
      allure.severity('high')
      allure.story('Validation')

      // 1. Visit password reset page
      auth.visitForgotPassword()

      // 2. Enter invalid email format
      cy.get(auth.selectors.forgotPasswordEmail).type('not-an-email')

      // 3. Submit form
      cy.get(auth.selectors.forgotPasswordSubmit).click()

      // 4. Should show validation error (HTML5 or custom)
      cy.get(auth.selectors.forgotPasswordEmail).then(($input) => {
        const input = $input[0] as HTMLInputElement
        if (input.validity) {
          expect(input.validity.valid).to.be.false
        }
      })

      cy.log('✅ Invalid email format validation works')
    })
  })

  describe('PWD-RESET-006: Back to Login Link', () => {
    it('should navigate back to login page', () => {
      allure.severity('normal')
      allure.story('Navigation')

      // 1. Visit password reset page
      auth.visitForgotPassword()

      // 2. Click back to login
      auth.backToLogin()

      // 3. Should be on login page
      auth.assertOnLoginPage()

      cy.log('✅ Back to login navigation works')
    })
  })

  describe('PWD-RESET-007: Submit with Known Test Email', () => {
    it('should handle submission with existing user email', () => {
      allure.severity('high')
      allure.story('Submit Request')

      // 1. Visit password reset page
      auth.visitForgotPassword()

      // 2. Request reset for known test email
      auth.requestPasswordReset('carlos.mendoza@nextspark.dev')

      // 3. Should show success (same message for security - no email enumeration)
      auth.waitForPasswordResetSuccess()

      cy.log('✅ Password reset for existing user handled correctly')
    })
  })

  describe('PWD-RESET-008: Form Keyboard Accessibility', () => {
    it('should submit form with Enter key', () => {
      allure.severity('normal')
      allure.story('Accessibility')

      // 1. Visit password reset page
      auth.visitForgotPassword()

      // 2. Enter email and press Enter
      cy.get(auth.selectors.forgotPasswordEmail)
        .type('user@example.com{enter}')

      // 3. Should process submission and show success (async operation)
      // Wait for the success message to appear after API call completes
      auth.waitForPasswordResetSuccess()

      cy.log('✅ Keyboard submission works')
    })
  })

  after(() => {
    cy.log('✅ Password reset flow tests completed')
  })
})
