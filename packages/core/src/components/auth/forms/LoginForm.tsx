'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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
import { Mail, Lock, Loader2, AlertCircle, Users } from 'lucide-react'
import { GoogleIcon } from '../../ui/google-icon'
import { createTestId, sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { AuthTranslationPreloader } from '../../../lib/i18n/AuthTranslationPreloader'
import { DevKeyring } from '../DevKeyring'
import { DEV_CONFIG } from '../../../lib/config/config-sync'
import type { AuthProviderWithNull, AuthErrorCode, AuthError } from '../../../types/auth'

/**
 * Maps error codes to internationalization keys for better user experience
 */
function getErrorMessageFromCode(error: Error | AuthError, t: (key: string, options?: any) => string, context: 'email' | 'google'): string {
  const authError = error as AuthError
  const errorCode = authError.code || getErrorCodeFromMessage(error.message)

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

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const [loadingProvider, setLoadingProvider] = useState<AuthProviderWithNull>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const isProcessingRef = useRef(false)
  const { signIn, googleSignIn } = useAuth()
  const { lastMethod, isReady } = useLastAuthMethod()
  const t = useTranslations('auth')

  // Read invitation-related params from URL
  const searchParams = useSearchParams()
  const inviteEmail = searchParams.get('email')
  const fromInvite = searchParams.get('fromInvite') === 'true'
  const callbackUrl = searchParams.get('callbackUrl')

  // Auto-show email form when coming from invitation
  useEffect(() => {
    if (fromInvite && inviteEmail) {
      setShowEmailForm(true)
    }
  }, [fromInvite, inviteEmail])

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
        {...createTestId('login', 'status', 'message') && { 'data-testid': createTestId('login', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <Card
        className="w-full max-w-md"
        data-testid={createTestId('login', 'card')}
        data-cy={sel('auth.login.card')}
      >
        <CardHeader
          className="space-y-1"
          data-testid={createTestId('login', 'header')}
          data-cy={sel('auth.login.header')}
        >
          <CardTitle 
            className="text-2xl font-bold"
            id="login-heading"
            role="heading"
            aria-level={1}
            {...createTestId('login', 'title') && { 'data-testid': createTestId('login', 'title') }}
          >
            {t('login.title')}
          </CardTitle>
          <CardDescription 
            {...createTestId('login', 'description') && { 'data-testid': createTestId('login', 'description') }}
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

          {/* Google Sign In - Primary Option */}
          {isReady && lastMethod === 'google' ? (
            <LastUsedBadge text={t('login.form.lastUsed')}>
              <Button
                type="button"
                size="lg"
                onClick={handleGoogleSignIn}
                disabled={!!loadingProvider}
                className="w-full mb-6"
                aria-label={t('login.form.continueWithGoogleAria')}
                data-testid={createTestId('login', 'google', 'button')}
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
              data-testid={createTestId('login', 'google', 'button')}
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

          {/* Email Login Link */}
          {!showEmailForm && (
            <div className="text-center">
              {isReady && lastMethod === 'email' ? (
                <LastUsedBadge text={t('login.form.lastUsed')}>
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(true)}
                    disabled={!!loadingProvider}
                    className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid={createTestId('login', 'show-email', 'button')}
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
                  className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={createTestId('login', 'show-email', 'button')}
                  data-cy={sel('auth.login.showEmail')}
                >
                  {t('login.form.loginWithEmail', { defaultValue: 'Sign in with Email' })}
                </button>
              )}
            </div>
          )}

          {/* Email Form - Shown when requested */}
          {showEmailForm && (
            <>
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

              <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            aria-labelledby="login-heading"
            data-testid={createTestId('login', 'form')}
            data-cy={sel('auth.login.form')}
          >
            <div className="space-y-2">
              <Label 
                htmlFor="email"
                {...createTestId('login', 'email', 'label') && { 'data-testid': createTestId('login', 'email', 'label') }}
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
                  data-testid={createTestId('login', 'email', 'input')}
                  data-cy={sel('auth.login.emailInput')}
                />
              </div>
              {errors.email && (
                <p 
                  id="email-error"
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="assertive"
                  data-testid={createTestId('login', 'email', 'error')}
                  data-cy={sel('auth.login.emailError')}
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label 
                htmlFor="password"
                {...createTestId('login', 'password', 'label') && { 'data-testid': createTestId('login', 'password', 'label') }}
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
                  data-testid={createTestId('login', 'password', 'input')}
                  data-cy={sel('auth.login.passwordInput')}
                />
              </div>
              {errors.password && (
                <p 
                  id="password-error"
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="assertive"
                  data-testid={createTestId('login', 'password', 'error')}
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
                data-testid={createTestId('login', 'error', 'alert')}
                data-cy={sel('auth.login.errorAlert')}
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div
              className="flex items-center justify-between"
              data-testid={createTestId('login', 'options', 'section')}
              data-cy={sel('auth.login.options')}
            >
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  data-testid={createTestId('login', 'remember', 'checkbox')}
                  data-cy={sel('auth.login.rememberCheckbox')}
                />
                <Label 
                  htmlFor="remember" 
                  className="text-sm font-normal cursor-pointer"
                  {...createTestId('login', 'remember', 'label') && { 'data-testid': createTestId('login', 'remember', 'label') }}
                >
                  {t('login.form.rememberMe')}
                </Label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={t('login.form.forgotPasswordAria')}
                data-testid={createTestId('login', 'forgot', 'link')}
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
              data-testid={createTestId('login', 'submit', 'button')}
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

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="text-sm text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    data-testid={createTestId('login', 'hide-email', 'button')}
                    data-cy={sel('auth.login.hideEmail')}
                  >
                    {t('login.form.backToGoogle', { defaultValue: 'Back to main options' })}
                  </button>
                </div>
              </form>
            </>
          )}
        </CardContent>
        <CardFooter
          data-testid={createTestId('login', 'footer')}
          data-cy={sel('auth.login.footer')}
        >
          <p className="text-sm text-muted-foreground text-center w-full">
            {t('login.footer.noAccount')}{' '}
            <Link 
              href="/signup" 
              className="text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label={t('login.footer.signUpAria')}
              data-testid={createTestId('login', 'signup', 'link')}
              data-cy={sel('auth.login.signupLink')}
            >
              {t('login.footer.signUp')}
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* DevKeyring - Development quick login (only if theme defines it in dev.config.ts) */}
      {DEV_CONFIG?.devKeyring && (
        <DevKeyring config={DEV_CONFIG.devKeyring} />
      )}
    </>
  )
}