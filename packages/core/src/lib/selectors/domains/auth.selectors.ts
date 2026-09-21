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
    // Passwordless (email one-time code)
    useOtp: 'login-use-otp',
    usePassword: 'login-use-password',
    otpForm: 'login-otp-form',
    otpEmailInput: 'login-otp-email-input',
    otpEmailError: 'login-otp-email-error',
    otpSend: 'login-otp-send',
    otpSentNotice: 'login-otp-sent-notice',
    otpCountdown: 'login-otp-countdown',
    otpCodeInput: 'login-otp-code-input',
    otpCodeError: 'login-otp-code-error',
    otpSubmit: 'login-otp-submit',
    otpResend: 'login-otp-resend',
    otpChangeEmail: 'login-otp-change-email',
    // Runtime readiness
    readinessLoading: 'login-readiness-loading',
    readinessError: 'login-readiness-error',
    noMethods: 'login-no-methods',
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
    // Readiness: email-OTP-only signup and unavailable invitation registration
    readinessLoading: 'signup-readiness-loading',
    readinessError: 'signup-readiness-error',
    noMethods: 'signup-no-methods',
    otpOnly: 'signup-otp-only',
    otpLoginLink: 'signup-otp-login-link',
    inviteUnavailable: 'signup-invite-unavailable',
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
    // Runtime readiness
    readinessLoading: 'forgot-password-readiness-loading',
    readinessError: 'forgot-password-readiness-error',
    unavailable: 'forgot-password-unavailable',
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
