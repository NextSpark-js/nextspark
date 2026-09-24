/**
 * AuthPOM - Page Object Model for authentication pages
 *
 * Provides methods for:
 * - Login (email/password, Google OAuth)
 * - Signup (email/password, Google OAuth)
 * - Password reset flow
 * - Email verification
 * - Dev keyring (quick login in development)
 *
 * @example
 * const auth = new AuthPOM()
 * auth.visitLogin()
 *     .login('user@example.com', 'password')
 *     .waitForDashboard()
 */

import { BasePOM } from './BasePOM'
import { cySelector } from '../selectors'

export interface SignupData {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword?: string
}

export class AuthPOM extends BasePOM {
  // ============================================
  // SELECTORS (from centralized selectors.ts)
  // ============================================

  get selectors() {
    return {
      // Login - Structure
      loginCard: cySelector('auth.login.card'),
      loginHeader: cySelector('auth.login.header'),
      loginFooter: cySelector('auth.login.footer'),
      loginForm: cySelector('auth.login.form'),
      loginOptions: cySelector('auth.login.options'),
      // Login - Inputs
      loginEmail: cySelector('auth.login.emailInput'),
      loginPassword: cySelector('auth.login.passwordInput'),
      loginEmailError: cySelector('auth.login.emailError'),
      loginPasswordError: cySelector('auth.login.passwordError'),
      // Login - Buttons
      loginSubmit: cySelector('auth.login.submit'),
      loginGoogle: cySelector('auth.login.googleSignin'),
      loginShowEmail: cySelector('auth.login.showEmail'),
      loginHideEmail: cySelector('auth.login.hideEmail'),
      // Login - Links & Misc
      loginForgotPassword: cySelector('auth.login.forgotPassword'),
      loginSignupLink: cySelector('auth.login.signupLink'),
      loginInviteBanner: cySelector('auth.login.inviteBanner'),
      loginError: cySelector('auth.login.errorAlert'),
      loginRememberCheckbox: cySelector('auth.login.rememberCheckbox'),

      // Signup
      signupForm: cySelector('auth.signup.form'),
      signupFirstName: cySelector('auth.signup.firstName'),
      signupLastName: cySelector('auth.signup.lastName'),
      signupEmail: cySelector('auth.signup.email'),
      signupPassword: cySelector('auth.signup.password'),
      signupConfirmPassword: cySelector('auth.signup.confirmPassword'),
      signupSubmit: cySelector('auth.signup.submitButton'),
      signupGoogle: cySelector('auth.signup.googleButton'),
      signupLoginLink: cySelector('auth.signup.loginLink'),
      signupInviteBanner: cySelector('auth.signup.inviteBanner'),
      signupError: cySelector('auth.signup.error'),

      // Forgot Password
      forgotPasswordForm: cySelector('auth.forgotPassword.form'),
      forgotPasswordEmail: cySelector('auth.forgotPassword.email'),
      forgotPasswordSubmit: cySelector('auth.forgotPassword.submitButton'),
      forgotPasswordBack: cySelector('auth.forgotPassword.backToLogin'),
      forgotPasswordSuccess: cySelector('auth.forgotPassword.successMessage'),
      forgotPasswordSuccessBack: cySelector('auth.forgotPassword.successBack'),
      forgotPasswordRetry: cySelector('auth.forgotPassword.retryButton'),
      forgotPasswordError: cySelector('auth.forgotPassword.error'),

      // Reset Password
      resetPasswordForm: cySelector('auth.resetPassword.form'),
      resetPasswordPassword: cySelector('auth.resetPassword.password'),
      resetPasswordConfirm: cySelector('auth.resetPassword.confirmPassword'),
      resetPasswordSubmit: cySelector('auth.resetPassword.submitButton'),
      resetPasswordError: cySelector('auth.resetPassword.error'),

      // Verify Email
      verifyEmailContainer: cySelector('auth.verifyEmail.container'),
      verifyEmailResend: cySelector('auth.verifyEmail.resendButton'),
      verifyEmailSuccess: cySelector('auth.verifyEmail.successMessage'),
      verifyEmailError: cySelector('auth.verifyEmail.error'),

      // Dev Keyring
      devKeyring: cySelector('auth.devKeyring.container'),
      devKeyringTrigger: cySelector('auth.devKeyring.trigger'),
      devKeyringContent: cySelector('auth.devKeyring.content'),
      devKeyringUser: (index: number) =>
        cySelector('auth.devKeyring.user', { index }),

      // Logout (from dashboard)
      userMenuTrigger: cySelector('dashboard.topnav.userMenuTrigger'),
      logoutAction: cySelector('dashboard.topnav.menuAction', { action: 'signOut' }),
      mobileLogout: cySelector('dashboard.topnav.mobileSignout')
    }
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): AuthPOM {
    return new AuthPOM()
  }

  // ============================================
  // NAVIGATION
  // ============================================

  visitLogin() {
    cy.visit('/login')
    return this
  }

  visitSignup() {
    cy.visit('/signup')
    return this
  }

  visitForgotPassword() {
    cy.visit('/forgot-password')
    return this
  }

  visitResetPassword(token: string) {
    cy.visit(`/reset-password?token=${token}`)
    return this
  }

  // ============================================
  // LOGIN ACTIONS
  // ============================================

  /**
   * Login with email and password
   */
  login(email: string, password: string) {
    cy.get(this.selectors.loginEmail).clear().type(email)
    cy.get(this.selectors.loginPassword).clear().type(password)
    cy.get(this.selectors.loginSubmit).click()
    return this
  }

  /**
   * Click on "Show email login" button (if email form is hidden by default)
   */
  showEmailLogin() {
    cy.get(this.selectors.loginShowEmail).click()
    return this
  }

  /**
   * Click Google login button
   */
  loginWithGoogle() {
    cy.get(this.selectors.loginGoogle).click()
    return this
  }

  /**
   * Click forgot password link
   */
  clickForgotPassword() {
    cy.get(this.selectors.loginForgotPassword).click()
    return this
  }

  /**
   * Click signup link from login page
   */
  clickSignupLink() {
    cy.get(this.selectors.loginSignupLink).click()
    return this
  }

  // ============================================
  // SIGNUP ACTIONS
  // ============================================

  /**
   * Fill and submit signup form
   */
  signup(data: SignupData) {
    cy.get(this.selectors.signupFirstName).clear().type(data.firstName)
    cy.get(this.selectors.signupLastName).clear().type(data.lastName)
    cy.get(this.selectors.signupEmail).clear().type(data.email)
    cy.get(this.selectors.signupPassword).clear().type(data.password)
    if (data.confirmPassword) {
      cy.get(this.selectors.signupConfirmPassword).clear().type(data.confirmPassword)
    }
    cy.get(this.selectors.signupSubmit).click()
    return this
  }

  /**
   * Click Google signup button
   */
  signupWithGoogle() {
    cy.get(this.selectors.signupGoogle).click()
    return this
  }

  /**
   * Click login link from signup page
   */
  clickLoginLink() {
    cy.get(this.selectors.signupLoginLink).click()
    return this
  }

  // ============================================
  // FORGOT PASSWORD ACTIONS
  // ============================================

  /**
   * Request password reset
   */
  requestPasswordReset(email: string) {
    cy.get(this.selectors.forgotPasswordEmail).clear().type(email)
    cy.get(this.selectors.forgotPasswordSubmit).click()
    return this
  }

  /**
   * Go back to login from forgot password
   */
  backToLogin() {
    cy.get(this.selectors.forgotPasswordBack).click()
    return this
  }

  // ============================================
  // RESET PASSWORD ACTIONS
  // ============================================

  /**
   * Reset password with new password
   */
  resetPassword(password: string, confirmPassword?: string) {
    cy.get(this.selectors.resetPasswordPassword).clear().type(password)
    cy.get(this.selectors.resetPasswordConfirm)
      .clear()
      .type(confirmPassword || password)
    cy.get(this.selectors.resetPasswordSubmit).click()
    return this
  }

  // ============================================
  // EMAIL VERIFICATION ACTIONS
  // ============================================

  /**
   * Resend verification email
   */
  resendVerificationEmail() {
    cy.get(this.selectors.verifyEmailResend).click()
    return this
  }

  // ============================================
  // DEV KEYRING ACTIONS
  // ============================================

  /**
   * Open dev keyring dropdown
   */
  openDevKeyring() {
    cy.get(this.selectors.devKeyringTrigger).click()
    return this
  }

  /**
   * Login as a dev user by index
   */
  loginAsDevUser(index: number) {
    this.openDevKeyring()
    cy.get(this.selectors.devKeyringUser(index)).click()
    return this
  }

  /**
   * Quick login using dev keyring (combines opening and clicking)
   */
  devLogin(userIndex: number = 0) {
    return this.loginAsDevUser(userIndex)
  }

  // ============================================
  // LOGOUT ACTIONS
  // ============================================

  /**
   * Logout from the application (clicks user menu, then signOut action)
   */
  logout() {
    cy.get(this.selectors.userMenuTrigger).click()
    cy.get(this.selectors.logoutAction).click()
    return this
  }

  /**
   * Logout from mobile menu
   */
  logoutMobile() {
    cy.get(this.selectors.mobileLogout).click()
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  /**
   * Wait for login form to be visible
   */
  waitForLoginForm() {
    cy.get(this.selectors.loginForm, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Wait for signup form to be visible
   */
  waitForSignupForm() {
    cy.get(this.selectors.signupForm, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Wait for redirect to dashboard after successful login
   */
  waitForDashboard() {
    cy.url({ timeout: 15000 }).should('include', '/dashboard')
    return this
  }

  /**
   * Wait for password reset success message
   */
  waitForPasswordResetSuccess() {
    cy.get(this.selectors.forgotPasswordSuccess, { timeout: 10000 }).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert login form is visible
   */
  assertLoginFormVisible() {
    cy.get(this.selectors.loginForm).should('be.visible')
    return this
  }

  /**
   * Assert signup form is visible
   */
  assertSignupFormVisible() {
    cy.get(this.selectors.signupForm).should('be.visible')
    return this
  }

  /**
   * Assert login error is shown
   */
  assertLoginError(message?: string) {
    cy.get(this.selectors.loginError).should('be.visible')
    if (message) {
      cy.get(this.selectors.loginError).should('contain.text', message)
    }
    return this
  }

  /**
   * Assert signup error is shown
   */
  assertSignupError(message?: string) {
    cy.get(this.selectors.signupError).should('be.visible')
    if (message) {
      cy.get(this.selectors.signupError).should('contain.text', message)
    }
    return this
  }

  /**
   * Assert forgot password error is shown
   */
  assertForgotPasswordError(message?: string) {
    cy.get(this.selectors.forgotPasswordError).should('be.visible')
    if (message) {
      cy.get(this.selectors.forgotPasswordError).should('contain.text', message)
    }
    return this
  }

  /**
   * Assert invite banner is visible
   */
  assertInviteBannerVisible() {
    cy.get(this.selectors.loginInviteBanner).should('be.visible')
    return this
  }

  /**
   * Assert user is on login page
   */
  assertOnLoginPage() {
    cy.url().should('include', '/login')
    return this
  }

  /**
   * Assert user is on signup page
   */
  assertOnSignupPage() {
    cy.url().should('include', '/signup')
    return this
  }

  /**
   * Assert user is on dashboard
   */
  assertOnDashboard() {
    cy.url().should('include', '/dashboard')
    return this
  }

  /**
   * Assert user is logged in (on dashboard)
   */
  assertLoggedIn() {
    return this.assertOnDashboard()
  }

  /**
   * Assert user is logged out (on login page)
   */
  assertLoggedOut() {
    return this.assertOnLoginPage()
  }

  /**
   * Assert dev keyring is visible (dev environment only)
   */
  assertDevKeyringVisible() {
    cy.get(this.selectors.devKeyring).should('be.visible')
    return this
  }
}

export default AuthPOM
