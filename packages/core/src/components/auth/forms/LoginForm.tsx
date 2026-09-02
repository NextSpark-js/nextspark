'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../../hooks/useAuth'
import { useLastAuthMethod } from '../../../hooks/useLastAuthMethod'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Alert, AlertDescription } from '../../ui/alert'
import { Checkbox } from '../../ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card'
import { Separator } from '../../ui/separator'
import { LastUsedBadge } from '../../ui/last-used-badge'
import { Mail, Lock, Loader2, AlertCircle, Users, KeyRound } from 'lucide-react'
import { GoogleIcon } from '../../ui/google-icon'
import { sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { AuthTranslationPreloader } from '../../../lib/i18n/AuthTranslationPreloader'
import { DevKeyring } from '../DevKeyring'
import { DEV_CONFIG, PUBLIC_AUTH_CONFIG } from '../../../lib/config/config-sync'
import { getPrimaryEmailMethod } from '../../../lib/auth/auth-methods'
import type { AuthProviderWithNull, AuthErrorCode, AuthError } from '../../../types/auth'

/**
 * Maps error codes to internationalization keys for better user experience
 */
function getErrorMessageFromCode(error: Error | AuthError, t: (key: string, options?: any) => string, context: 'email' | 'google' | 'otp'): string {
  const authError = error as AuthError
  const errorCode = authError.code || getErrorCodeFromMessage(error.message)

  if (context === 'otp') {
    const lower = (error.message || '').toLowerCase()
    if (lower.includes('expired')) return t('login.errors.otpExpired', { defaultValue: error.message })
    if (lower.includes('too many') || lower.includes('rate') || lower.includes('attempts')) {
      return t('login.errors.otpTooMany', { defaultValue: error.message })
    }
    if (lower.includes('invalid') || lower.includes('otp') || lower.includes('code')) {
      return t('login.errors.otpInvalid', { defaultValue: error.message })
    }
    return error.message || t('login.messages.otpVerifyFailed')
  }

  const baseKey = context === 'email' ? 'login.errors' : 'login.errors.google'

  switch (errorCode) {
    case 'INVALID_CREDENTIALS':
      return t(`${baseKey}.invalidCredentials`, { defaultValue: error.message })
    case 'USER_NOT_FOUND':
      return t(`${baseKey}.userNotFound`, { defaultValue: error.message })
    case 'EMAIL_NOT_VERIFIED':
      return t(`${baseKey}.emailNotVerified`, { defaultValue: error.message })
    case 'ACCOUNT_LOCKED':
      return t(`${baseKey}.accountLocked`, { defaultValue: error.message })
    case 'RATE_LIMITED':
      return t(`${baseKey}.rateLimited`, { defaultValue: error.message })
    case 'OAUTH_ERROR':
      return t(`${baseKey}.oauthError`, { defaultValue: error.message })
    case 'NETWORK_ERROR':
      return t(`${baseKey}.networkError`, { defaultValue: error.message })
    case 'SERVER_ERROR':
      return t(`${baseKey}.serverError`, { defaultValue: error.message })
    default:
      return error.message || t(context === 'email' ? 'login.messages.signInFailed' : 'login.messages.googleSignInFailed')
  }
}

/**
 * Attempts to derive error code from error message for legacy error handling
 */
function getErrorCodeFromMessage(message: string): AuthErrorCode {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('credential') || lowerMessage.includes('password') || lowerMessage.includes('invalid')) {
    return 'INVALID_CREDENTIALS'
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('user does not exist')) {
    return 'USER_NOT_FOUND'
  }
  if (lowerMessage.includes('verify') || lowerMessage.includes('verification')) {
    return 'EMAIL_NOT_VERIFIED'
  }
  if (lowerMessage.includes('locked') || lowerMessage.includes('suspended')) {
    return 'ACCOUNT_LOCKED'
  }
  if (lowerMessage.includes('rate') || lowerMessage.includes('too many')) {
    return 'RATE_LIMITED'
  }
  if (lowerMessage.includes('oauth') || lowerMessage.includes('google') || lowerMessage.includes('provider')) {
    return 'OAUTH_ERROR'
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    return 'NETWORK_ERROR'
  }
  if (lowerMessage.includes('server') || lowerMessage.includes('internal')) {
    return 'SERVER_ERROR'
  }

  return 'UNKNOWN_ERROR'
}

function buildLoginSchema(t: (key: string, options?: any) => string) {
  return z.object({
    email: z.string().email({ message: t('login.errors.invalidEmail', { defaultValue: 'Invalid email' }) }),
    password: z.string().min(6, t('login.errors.passwordTooShort', { defaultValue: 'Password must be at least 6 characters' })),
  })
}

type LoginFormData = z.infer<ReturnType<typeof buildLoginSchema>>

const OTP_CODE_LENGTH = 6

function buildOtpEmailSchema(t: (key: string, options?: any) => string) {
  return z.string().trim().email({ message: t('login.errors.invalidEmail', { defaultValue: 'Invalid email' }) })
}

function buildOtpCodeSchema(t: (key: string, options?: any) => string) {
  return z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), {
      message: t('login.errors.otpInvalidCode', { defaultValue: `Enter the ${OTP_CODE_LENGTH}-digit code` }),
    })
}

type EmailMode = 'otp' | 'password'

export function LoginForm() {
  // Auth config for conditional rendering
  const registrationMode = PUBLIC_AUTH_CONFIG.registration.mode
  const googleEnabled = PUBLIC_AUTH_CONFIG.providers.google.enabled
  // Login methods (AUTH_CONFIG.methods) — passwordless preset by default:
  // one-time code by email + Google, no password field.
  const methods = PUBLIC_AUTH_CONFIG.methods
  const otpEnabled = methods.includes('email-otp')
  // In dev mode with DevKeyring, always allow email login regardless of registration mode
  const devKeyringActive = process.env.NODE_ENV !== 'production' && !!DEV_CONFIG?.devKeyring?.enabled
  // DevKeyring autofills email + password, so it keeps the password form reachable in dev
  const passwordEnabled = methods.includes('email-password') || devKeyringActive
  // The signup page only exists for the password flow (OTP creates the account on first sign-in)
  const signupVisible =
    (registrationMode === 'open' || registrationMode === 'domain-open') && methods.includes('email-password')
  // In domain-restricted mode, hide email login UNLESS DevKeyring is active (dev mode)
  const emailLoginAllowed =
    (registrationMode !== 'domain-restricted' || devKeyringActive) && (otpEnabled || passwordEnabled)
  // Which email form opens first: the first email method in the configured order
  const primaryEmailMode: EmailMode = (() => {
    const primary = getPrimaryEmailMethod(methods)
    if (primary === 'email-otp' && otpEnabled) return 'otp'
    if (primary === 'email-password') return 'password'
    return otpEnabled ? 'otp' : 'password'
  })()

  const [loadingProvider, setLoadingProvider] = useState<AuthProviderWithNull>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  // Show email form by default when Google is disabled
  const [showEmailForm, setShowEmailForm] = useState(!googleEnabled)
  const [emailMode, setEmailMode] = useState<EmailMode>(primaryEmailMode)
  // Passwordless (one-time code) state
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpEmailError, setOtpEmailError] = useState<string | null>(null)
  const [otpCodeError, setOtpCodeError] = useState<string | null>(null)
  const isProcessingRef = useRef(false)
  const { signIn, googleSignIn, sendOtp, signInWithOtp } = useAuth()
  const { lastMethod, isReady } = useLastAuthMethod()
  const t = useTranslations('auth')
  const loginSchema = useMemo(() => buildLoginSchema(t), [t])
  const otpEmailSchema = useMemo(() => buildOtpEmailSchema(t), [t])
  const otpCodeSchema = useMemo(() => buildOtpCodeSchema(t), [t])

  // Read invitation-related params from URL
  const searchParams = useSearchParams()
  const inviteEmail = searchParams.get('email')
  const fromInvite = searchParams.get('fromInvite') === 'true'
  const callbackUrl = searchParams.get('callbackUrl')

  // Auto-show email form when coming from invitation
  useEffect(() => {
    if (fromInvite && inviteEmail) {
      setShowEmailForm(true)
      setOtpEmail(inviteEmail)
    }
  }, [fromInvite, inviteEmail])

  const switchEmailMode = useCallback((mode: EmailMode) => {
    setEmailMode(mode)
    setError(null)
    setOtpEmailError(null)
    setOtpCodeError(null)
    setOtpStep('email')
    setOtpCode('')
  }, [])

  /**
   * Passwordless step 1: validate the email and send the one-time code.
   * Also used by "Resend code".
   */
  const handleSendOtp = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (loadingProvider) return

    const parsed = otpEmailSchema.safeParse(otpEmail)
    if (!parsed.success) {
      setOtpEmailError(parsed.error.issues[0]?.message ?? t('login.errors.invalidEmail'))
      return
    }
    setOtpEmailError(null)
    setOtpCodeError(null)
    setError(null)
    setLoadingProvider('email')
    setStatusMessage(t('login.messages.otpSending'))

    try {
      await sendOtp(parsed.data)
      setOtpEmail(parsed.data)
      setOtpCode('')
      setOtpStep('code')
      setStatusMessage(t('login.messages.otpSent'))
    } catch (err) {
      const error = err instanceof Error ? err : new Error(t('login.messages.otpSendFailed'))
      const errorMessage = error.message || t('login.messages.otpSendFailed')
      setError(errorMessage)
      setStatusMessage(t('login.messages.signInError', { error: errorMessage }))
    } finally {
      setLoadingProvider(null)
    }
  }, [loadingProvider, otpEmail, otpEmailSchema, sendOtp, t])

  /**
   * Passwordless step 2: exchange the emailed code for a session.
   */
  const handleVerifyOtp = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (loadingProvider) return

    const parsed = otpCodeSchema.safeParse(otpCode)
    if (!parsed.success) {
      setOtpCodeError(parsed.error.issues[0]?.message ?? t('login.errors.otpInvalidCode'))
      return
    }
    setOtpCodeError(null)
    setError(null)
    setLoadingProvider('email')
    setStatusMessage(t('login.messages.otpVerifying'))

    try {
      await signInWithOtp({
        email: otpEmail,
        otp: parsed.data,
        redirectTo: callbackUrl || undefined,
      })
      setStatusMessage(t('login.messages.signInSuccess'))
    } catch (err) {
      const error = err instanceof Error ? err : new Error(t('login.messages.otpVerifyFailed'))
      const errorMessage = getErrorMessageFromCode(error, t, 'otp')
      setError(errorMessage)
      setStatusMessage(t('login.messages.signInError', { error: errorMessage }))
    } finally {
      setLoadingProvider(null)
    }
  }, [loadingProvider, otpCode, otpCodeSchema, otpEmail, signInWithOtp, callbackUrl, t])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      email: inviteEmail || '',
    },
  })

  const onSubmit = useCallback(async (data: LoginFormData) => {
    // Prevent multiple submissions during loading
    if (loadingProvider) return

    setLoadingProvider('email')
    setError(null)
    setStatusMessage(t('login.messages.signingIn'))

    try {
      await signIn({
        ...data,
        redirectTo: callbackUrl || undefined,
      })
      setStatusMessage(t('login.messages.signInSuccess'))
    } catch (err) {
      const error = err instanceof Error ? err : new Error(t('login.messages.signInFailed'))
      const errorMessage = getErrorMessageFromCode(error, t, 'email')
      setError(errorMessage)
      setStatusMessage(t('login.messages.signInError', { error: errorMessage }))
    } finally {
      setLoadingProvider(null)
    }
  }, [signIn, t, loadingProvider, callbackUrl])

  const handleGoogleSignIn = useCallback(async () => {
    // Prevent multiple calls during processing
    if (isProcessingRef.current || loadingProvider) return

    isProcessingRef.current = true
    setLoadingProvider('google')
    setError(null)
    setStatusMessage(t('login.messages.googleSigningIn'))
    try {
      await googleSignIn(callbackUrl || undefined)
      setStatusMessage(t('login.messages.googleSignInSuccess'))
    } catch (err) {
      const error = err instanceof Error ? err : new Error(t('login.messages.googleSignInFailed'))
      const errorMessage = getErrorMessageFromCode(error, t, 'google')
      setError(errorMessage)
      setStatusMessage(t('login.messages.googleSignInError', { error: errorMessage }))
    } finally {
      setLoadingProvider(null)
      isProcessingRef.current = false
    }
  }, [googleSignIn, t, loadingProvider, callbackUrl])

  return (
    <>
      <AuthTranslationPreloader />
      {/* MANDATORY: Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
              >
        {statusMessage}
      </div>

      <Card
        className="w-full max-w-md"
                data-cy={sel('auth.login.card')}
      >
        <CardHeader
          className="space-y-1"
                    data-cy={sel('auth.login.header')}
        >
          <CardTitle 
            className="text-2xl font-bold"
            id="login-heading"
            role="heading"
            aria-level={1}
                      >
            {t('login.title')}
          </CardTitle>
          <CardDescription 
                      >
            {t('login.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Team Invitation Banner */}
          {fromInvite && (
            <Alert className="mb-4" data-cy={sel('auth.login.inviteBanner')}>
              <Users className="h-4 w-4" />
              <AlertDescription>
                {t('login.inviteBanner')}
              </AlertDescription>
            </Alert>
          )}

          {/* Google Sign In - Primary Option (hidden when Google is disabled) */}
          {googleEnabled && (
            <>
              {isReady && lastMethod === 'google' ? (
                <LastUsedBadge text={t('login.form.lastUsed')}>
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleGoogleSignIn}
                    disabled={!!loadingProvider}
                    className="w-full mb-6"
                    aria-label={t('login.form.continueWithGoogleAria')}
                                        data-cy={sel('auth.login.googleSignin')}
                  >
                    {loadingProvider === 'google' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <GoogleIcon className="mr-2" data-cy="google-icon" />
                    )}
                    {t('login.form.continueWithGoogle')}
                  </Button>
                </LastUsedBadge>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={!!loadingProvider}
                  className="w-full mb-6"
                  aria-label={t('login.form.continueWithGoogleAria')}
                                    data-cy={sel('auth.login.googleSignin')}
                >
                  {loadingProvider === 'google' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <GoogleIcon className="mr-2" data-cy="google-icon" />
                  )}
                  {t('login.form.continueWithGoogle')}
                </Button>
              )}
            </>
          )}

          {/* Email Login Link (hidden when Google is disabled or in domain-restricted mode, unless DevKeyring is active) */}
          {!showEmailForm && googleEnabled && emailLoginAllowed && (
            <div className="text-center">
              {isReady && lastMethod === 'email' ? (
                <LastUsedBadge text={t('login.form.lastUsed')}>
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(true)}
                    disabled={!!loadingProvider}
                    className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] inline-flex items-center"
                                        data-cy={sel('auth.login.showEmail')}
                  >
                    {t('login.form.loginWithEmail', { defaultValue: 'Sign in with Email' })}
                  </button>
                </LastUsedBadge>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  disabled={!!loadingProvider}
                  className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] inline-flex items-center"
                                    data-cy={sel('auth.login.showEmail')}
                >
                  {t('login.form.loginWithEmail', { defaultValue: 'Sign in with Email' })}
                </button>
              )}
            </div>
          )}

          {/* Email Form - Shown when requested (hidden in domain-restricted mode, unless DevKeyring is active) */}
          {showEmailForm && emailLoginAllowed && (
            <>
              {googleEnabled && (
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t('login.form.orContinueWith')}
                    </span>
                  </div>
                </div>
              )}

              {/* Passwordless: one-time code by email (AUTH_CONFIG.methods 'email-otp') */}
              {emailMode === 'otp' && otpEnabled && (
                <form
                  onSubmit={otpStep === 'email' ? handleSendOtp : handleVerifyOtp}
                  className="space-y-4"
                  aria-labelledby="login-heading"
                  noValidate
                  data-cy={sel('auth.login.otpForm')}
                >
                  {otpStep === 'email' ? (
                    <div className="space-y-2">
                      <Label htmlFor="otp-email">{t('login.form.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="otp-email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          value={otpEmail}
                          onChange={(e) => setOtpEmail(e.target.value)}
                          placeholder={t('login.form.emailPlaceholder')}
                          className={`pl-9 ${fromInvite ? 'bg-muted cursor-not-allowed' : ''}`}
                          readOnly={fromInvite}
                          aria-required="true"
                          aria-describedby={otpEmailError ? 'otp-email-error' : 'otp-email-help'}
                          aria-invalid={otpEmailError ? 'true' : 'false'}
                          data-cy={sel('auth.login.otpEmailInput')}
                        />
                      </div>
                      <p id="otp-email-help" className="text-xs text-muted-foreground">
                        {t('login.form.otp.emailHelp')}
                      </p>
                      {otpEmailError && (
                        <p
                          id="otp-email-error"
                          className="text-sm text-destructive"
                          role="alert"
                          aria-live="assertive"
                          data-cy={sel('auth.login.otpEmailError')}
                        >
                          {otpEmailError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Alert data-cy={sel('auth.login.otpSentNotice')}>
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        <AlertDescription>
                          {t('login.form.otp.codeSent', { email: otpEmail })}
                        </AlertDescription>
                      </Alert>
                      <Label htmlFor="otp-code">{t('login.form.otp.codeLabel')}</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="otp-code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]*"
                          maxLength={OTP_CODE_LENGTH}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH))}
                          placeholder={t('login.form.otp.codePlaceholder')}
                          className="pl-9 tracking-widest"
                          autoFocus
                          aria-required="true"
                          aria-describedby={otpCodeError ? 'otp-code-error' : undefined}
                          aria-invalid={otpCodeError ? 'true' : 'false'}
                          data-cy={sel('auth.login.otpCodeInput')}
                        />
                      </div>
                      {otpCodeError && (
                        <p
                          id="otp-code-error"
                          className="text-sm text-destructive"
                          role="alert"
                          aria-live="assertive"
                          data-cy={sel('auth.login.otpCodeError')}
                        >
                          {otpCodeError}
                        </p>
                      )}
                    </div>
                  )}

                  {error && (
                    <Alert
                      variant="destructive"
                      role="alert"
                      aria-live="assertive"
                      data-cy={sel('auth.login.errorAlert')}
                    >
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {otpStep === 'email' ? (
                    <Button
                      type="submit"
                      disabled={!!loadingProvider}
                      className="w-full"
                      data-cy={sel('auth.login.otpSend')}
                    >
                      {loadingProvider === 'email' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          {t('login.form.otp.sendingCode')}
                        </>
                      ) : (
                        t('login.form.otp.sendCode')
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="submit"
                        disabled={!!loadingProvider}
                        className="w-full"
                        data-cy={sel('auth.login.otpSubmit')}
                      >
                        {loadingProvider === 'email' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            {t('login.form.otp.verifyingCode')}
                          </>
                        ) : (
                          t('login.form.otp.verifyCode')
                        )}
                      </Button>
                      <div className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          onClick={() => void handleSendOtp()}
                          disabled={!!loadingProvider}
                          className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 min-h-[44px] inline-flex items-center"
                          data-cy={sel('auth.login.otpResend')}
                        >
                          {t('login.form.otp.resendCode')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOtpStep('email'); setOtpCode(''); setOtpCodeError(null); setError(null) }}
                          disabled={!!loadingProvider}
                          className="text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 min-h-[44px] inline-flex items-center"
                          data-cy={sel('auth.login.otpChangeEmail')}
                        >
                          {t('login.form.otp.changeEmail')}
                        </button>
                      </div>
                    </>
                  )}

                  {passwordEnabled && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => switchEmailMode('password')}
                        disabled={!!loadingProvider}
                        className="text-sm text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] inline-flex items-center"
                        data-cy={sel('auth.login.usePassword')}
                      >
                        {t('login.form.usePassword')}
                      </button>
                    </div>
                  )}

                  {googleEnabled && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowEmailForm(false)}
                        className="text-sm text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] inline-flex items-center"
                        data-cy={sel('auth.login.hideEmail')}
                      >
                        {t('login.form.backToGoogle', { defaultValue: 'Back to main options' })}
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* Classic: email + password (AUTH_CONFIG.methods 'email-password') */}
              {(emailMode === 'password' || !otpEnabled) && passwordEnabled && (
              <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            aria-labelledby="login-heading"
                        data-cy={sel('auth.login.form')}
          >
            <div className="space-y-2">
              <Label 
                htmlFor="email"
                              >
                {t('login.form.email')}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('login.form.emailPlaceholder')}
                  className={`pl-9 ${fromInvite ? 'bg-muted cursor-not-allowed' : ''}`}
                  readOnly={fromInvite}
                  aria-required="true"
                  aria-describedby={errors.email ? "email-error" : undefined}
                  aria-invalid={errors.email ? "true" : "false"}
                                    data-cy={sel('auth.login.emailInput')}
                />
              </div>
              {errors.email && (
                <p 
                  id="email-error"
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="assertive"
                                    data-cy={sel('auth.login.emailError')}
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label 
                htmlFor="password"
                              >
                {t('login.form.password')}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  {...register('password')}
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('login.form.passwordPlaceholder')}
                  className="pl-9"
                  aria-required="true"
                  aria-describedby={errors.password ? "password-error" : undefined}
                  aria-invalid={errors.password ? "true" : "false"}
                                    data-cy={sel('auth.login.passwordInput')}
                />
              </div>
              {errors.password && (
                <p 
                  id="password-error"
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="assertive"
                                    data-cy={sel('auth.login.passwordError')}
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <Alert 
                variant="destructive"
                role="alert"
                aria-live="assertive"
                                data-cy={sel('auth.login.errorAlert')}
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div
              className="flex items-center justify-between"
                            data-cy={sel('auth.login.options')}
            >
              <div className="flex items-center space-x-2 min-h-[44px]">
                <Checkbox
                  id="remember"
                                    data-cy={sel('auth.login.rememberCheckbox')}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer"
                                  >
                  {t('login.form.rememberMe')}
                </Label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] inline-flex items-center"
                aria-label={t('login.form.forgotPasswordAria')}
                                data-cy={sel('auth.login.forgotPassword')}
              >
                {t('login.form.forgotPassword')}
              </Link>
            </div>

            <Button
              type="submit"
              disabled={!!loadingProvider}
              className="w-full"
              aria-describedby="submit-help"
                            data-cy={sel('auth.login.submit')}
            >
              {loadingProvider === 'email' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('login.form.signingIn')}
                </>
              ) : (
                t('login.form.signInButton')
              )}
            </Button>
            <div id="submit-help" className="sr-only">
              {t('login.form.submitHelp')}
            </div>

                {otpEnabled && (
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => switchEmailMode('otp')}
                      disabled={!!loadingProvider}
                      className="text-sm text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] inline-flex items-center"
                      data-cy={sel('auth.login.useOtp')}
                    >
                      {t('login.form.useOtp')}
                    </button>
                  </div>
                )}

                {googleEnabled && (
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="text-sm text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] inline-flex items-center"
                                          data-cy={sel('auth.login.hideEmail')}
                    >
                      {t('login.form.backToGoogle', { defaultValue: 'Back to main options' })}
                    </button>
                  </div>
                )}
              </form>
              )}
            </>
          )}
        </CardContent>
        {signupVisible && (
          <CardFooter
                      data-cy={sel('auth.login.footer')}
          >
            <p className="text-sm text-muted-foreground text-center w-full">
              {t('login.footer.noAccount')}{' '}
              <Link
                href="/signup"
                className="text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={t('login.footer.signUpAria')}
                              data-cy={sel('auth.login.signupLink')}
              >
                {t('login.footer.signUp')}
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>

      {/* DevKeyring - Development quick login (only if theme defines it in dev.config.ts) */}
      {DEV_CONFIG?.devKeyring && (
        <DevKeyring config={DEV_CONFIG.devKeyring} />
      )}
    </>
  )
}