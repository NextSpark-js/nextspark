/**
 * Auth Selectors
 *
 * Selectors for authentication-related components:
 * - Login form
 * - Signup form
 * - Forgot/Reset password
 * - Email verification
 * - Dev keyring (development only)
 */

export const AUTH_SELECTORS = {
  login: {
    // Structure
    card: 'login-form-card',
    header: 'login-header',
    footer: 'login-footer',
    form: 'login-form',
    options: 'login-options',
    // Inputs
    emailInput: 'login-email-input',
    passwordInput: 'login-password-input',
    emailError: 'login-email-error',
    passwordError: 'login-password-error',
    // Buttons
    submit: 'login-submit',
    googleSignin: 'login-google-signin',
    showEmail: 'login-show-email',
    hideEmail: 'login-hide-email',
    // Links
    forgotPassword: 'login-forgot-password',
    signupLink: 'login-signup-link',
    // Misc
    inviteBanner: 'login-invite-banner',
    errorAlert: 'login-error-alert',
    rememberCheckbox: 'login-remember-checkbox',
  },
  signup: {
    form: 'signup-form',
    firstName: 'signup-first-name',
    lastName: 'signup-last-name',
    email: 'signup-email',
    password: 'signup-password',
    confirmPassword: 'signup-confirm-password',
    submitButton: 'signup-submit',
    googleButton: 'signup-google',
    loginLink: 'signup-login-link',
    inviteBanner: 'signup-invite-banner',
    error: 'signup-error',
    termsCheckbox: 'signup-terms-checkbox',
    footer: 'signup-footer',
  },
  forgotPassword: {
    form: 'forgot-password-form',
    email: 'forgot-password-email',
    submitButton: 'forgot-password-submit',
    backToLogin: 'forgot-password-back',
    successMessage: 'forgot-password-success',
    successBack: 'forgot-password-success-back',
    retryButton: 'forgot-password-retry',
    error: 'forgot-password-error',
  },
  resetPassword: {
    form: 'reset-password-form',
    password: 'reset-password-password',
    confirmPassword: 'reset-password-confirm',
    submitButton: 'reset-password-submit',
    error: 'reset-password-error',
    success: 'reset-password-success',
    loginLink: 'reset-password-login-link',
    backToLogin: 'reset-password-back',
  },
  verifyEmail: {
    container: 'verify-email-container',
    resendButton: 'verify-email-resend',
    successMessage: 'verify-email-success',
    error: 'verify-email-error',
  },
  devKeyring: {
    container: 'devkeyring-container',
    trigger: 'devkeyring-trigger',
    content: 'devkeyring-content',
    user: 'devkeyring-user-{index}',
  },
} as const

export type AuthSelectorsType = typeof AUTH_SELECTORS
