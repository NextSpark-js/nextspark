'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthActions } from '../../../hooks/useAuth'
import { safeCallbackPath } from '../../../lib/auth/callback-url'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Alert, AlertDescription } from '../../ui/alert'
import { Checkbox } from '../../ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card'
import { Separator } from '../../ui/separator'
import { PasswordInput } from '../../ui/password-input'
import { Mail, User, Loader2, AlertCircle, ArrowRight, MailCheck, CheckCircle2, Users } from 'lucide-react'
import { signupSchema } from '../../../lib/validation'
import { sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { AuthTranslationPreloader } from '../../../lib/i18n/AuthTranslationPreloader'
import { PUBLIC_AUTH_CONFIG } from '../../../lib/config/config-sync'
import { toast } from 'sonner'

type SignupFormData = z.infer<typeof signupSchema>

type AuthProvider = 'email' | 'google' | null

export function SignupForm() {
  const router = useRouter()
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider>(null)
  const [error, setError] = useState<string | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resendingEmail, setResendingEmail] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const { signUp, googleSignIn, resendVerificationEmail } = useAuthActions()
  const t = useTranslations('auth')

  // Read invitation-related params from URL
  const searchParams = useSearchParams()
  const inviteEmail = searchParams.get('email')
  const fromInvite = searchParams.get('fromInvite') === 'true'
  const callbackUrl = safeCallbackPath(searchParams.get('callbackUrl'))
  const inviteToken = searchParams.get('inviteToken')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: inviteEmail || '',
    },
  })

  const password = watch('password', '')

  const onSubmit = useCallback(async (data: SignupFormData) => {
    if (!agreedToTerms) {
      setError(t('signup.errors.mustAgreeToTerms'))
      setStatusMessage(t('signup.messages.termsError'))
      return
    }

    setLoadingProvider('email')
    setError(null)
    setStatusMessage(t('signup.messages.creatingAccount'))

    try {
      // If there's an invite token, use the special signup-with-invite endpoint
      // This skips email verification since the invitation proves email ownership
      if (inviteToken) {
        const response = await fetch('/api/v1/auth/signup-with-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            firstName: data.firstName,
            lastName: data.lastName,
            inviteToken,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          // Handle specific error codes
          if (result.code === 'USER_ALREADY_EXISTS') {
            setError(t('signup.errors.userAlreadyExists'))
          } else if (result.code === 'EMAIL_MISMATCH') {
            setError(t('signup.errors.emailMismatch'))
          } else if (result.code === 'INVITATION_EXPIRED') {
            setError(t('signup.errors.invitationExpired'))
          } else if (result.code === 'INVITATION_NOT_FOUND') {
            setError(t('signup.errors.invitationNotFound'))
          } else {
            setError(result.error || t('signup.errors.failedToCreate'))
          }
          setStatusMessage(t('signup.messages.createError', { error: result.error || 'Unknown error' }))
          return
        }

        // Success! Show toast and redirect to team page
        toast.success(t('signup.messages.inviteSuccess'), {
          description: t('signup.messages.inviteJoinedTeam')
        })

        // Redirect to team settings page
        router.push(result.data?.redirectTo || '/dashboard/settings/teams')
        return
      }

      // Normal signup flow (requires email verification)
      await signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      })

      // If signup succeeds, show the email verification message
      setRegisteredEmail(data.email)
      setEmailSent(true)
      setStatusMessage(t('signup.messages.accountCreated'))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('signup.errors.failedToCreate')
      setError(errorMessage)
      setStatusMessage(t('signup.messages.createError', { error: errorMessage }))
    } finally {
      setLoadingProvider(null)
    }
  }, [agreedToTerms, signUp, t, inviteToken, router])

  const handleGoogleSignUp = async () => {
    setLoadingProvider('google')
    setError(null)
    try {
      await googleSignIn(callbackUrl || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signup.errors.googleFailed'))
    } finally {
      setLoadingProvider(null)
    }
  }

  const handleResendEmail = async () => {
    setResendingEmail(true)
    setError(null)
    
    try {
      const result = await resendVerificationEmail(registeredEmail)
      
      if (result.success) {
        // Show success message (email already shows this state)
        setEmailSent(true)
      } else {
        setError(result.error || t('signup.errors.failedToResend'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signup.errors.failedToResend'))
    } finally {
      setResendingEmail(false)
    }
  }

  // Show success message if email was sent
  if (emailSent) {
    return (
      <>
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
          role="main"
          aria-labelledby="email-sent-heading"
                    data-cy={sel('auth.verifyEmail.container')}
        >
          <CardHeader 
            className="space-y-1"
                      >
            <div
              className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4"
              role="img"
              aria-label={t('signup.emailVerification.emailSentAria')}
            >
              <MailCheck className="w-6 h-6 text-green-600" aria-hidden="true" />
            </div>
            <CardTitle 
              id="email-sent-heading"
              className="text-2xl font-bold text-center"
                          >
              {t('signup.emailVerification.title')}
            </CardTitle>
            <CardDescription 
              className="text-center"
                          >
              {t('signup.emailVerification.description')}
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-center break-all">{registeredEmail}</p>
          </div>
          
          <Alert data-cy={sel('auth.verifyEmail.successMessage')}>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              {t('signup.emailVerification.checkInbox')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <span className="text-primary font-medium">1.</span>
              {t('signup.emailVerification.step1')}
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-medium">2.</span>
              {t('signup.emailVerification.step2')}
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-medium">3.</span>
              {t('signup.emailVerification.step3')}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Separator />

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('signup.emailVerification.didntReceive')}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false)
                  setError(null)
                }}
                className="flex-1"
              >
                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                {t('signup.emailVerification.back')}
              </Button>
              <Button
                variant="default"
                onClick={handleResendEmail}
                disabled={resendingEmail}
                className="flex-1"
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('signup.emailVerification.sending')}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {t('signup.emailVerification.resendEmail')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            {t('signup.emailVerification.alreadyVerified')}{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              {t('signup.emailVerification.signIn')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
    )
  }

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
                data-cy={sel('auth.signup.form')}
      >
        <CardHeader 
          className="space-y-1"
                  >
          <CardTitle 
            className="text-2xl font-bold"
            id="signup-heading"
                      >
            {t('signup.title')}
          </CardTitle>
          <CardDescription 
                      >
            {t('signup.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Team Invitation Banner */}
          {fromInvite && (
            <Alert className="mb-4" data-cy={sel('auth.signup.inviteBanner')}>
              <Users className="h-4 w-4" />
              <AlertDescription>
                {t('signup.inviteBanner')}
              </AlertDescription>
            </Alert>
          )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('signup.form.firstName')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  {...register('firstName')}
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder={t('signup.form.firstNamePlaceholder')}
                  className="pl-9"
                  data-cy={sel('auth.signup.firstName')}
                />
              </div>
              {errors.firstName && (
                <p className="text-sm text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">{t('signup.form.lastName')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  {...register('lastName')}
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder={t('signup.form.lastNamePlaceholder')}
                  className="pl-9"
                  data-cy={sel('auth.signup.lastName')}
                />
              </div>
              {errors.lastName && (
                <p className="text-sm text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('signup.form.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t('signup.form.emailPlaceholder')}
                className={`pl-9 ${fromInvite ? 'bg-muted cursor-not-allowed' : ''}`}
                readOnly={fromInvite}
                data-cy={sel('auth.signup.email')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('signup.form.password')}</Label>
            <PasswordInput
              {...register('password')}
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
              showRequirements={true}
              password={password}
              requirementLabels={{
                minChars: t('signup.form.passwordRequirements.minChars'),
                uppercase: t('signup.form.passwordRequirements.uppercase'),
                lowercase: t('signup.form.passwordRequirements.lowercase'),
                number: t('signup.form.passwordRequirements.number'),
              }}
              data-cy={sel('auth.signup.password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('signup.form.confirmPassword')}</Label>
            <PasswordInput
              {...register('confirmPassword')}
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="••••••••"
              data-cy={sel('auth.signup.confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive" data-cy={sel('auth.signup.error')}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked: boolean | 'indeterminate') => setAgreedToTerms(checked as boolean)}
              data-cy={sel('auth.signup.termsCheckbox')}
            />
            <Label
              htmlFor="terms"
              className="text-sm font-normal cursor-pointer"
            >
              {t('signup.form.agreeToThe')}{' '}
              <Link href="/terms" className="text-primary hover:underline">
                {t('signup.form.termsAndConditions')}
              </Link>
            </Label>
          </div>

          <Button
            type="submit"
            disabled={!!loadingProvider || !agreedToTerms}
            className="w-full"
            data-cy={sel('auth.signup.submitButton')}
          >
            {loadingProvider === 'email' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('signup.form.creatingAccount')}
              </>
            ) : (
              t('signup.form.createAccount')
            )}
          </Button>
        </form>

        {PUBLIC_AUTH_CONFIG.providers.google.enabled && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t('signup.form.orContinueWith')}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignUp}
              disabled={!!loadingProvider}
              className="w-full"
              data-cy={sel('auth.signup.googleButton')}
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {t('signup.form.continueWithGoogle')}
            </Button>
          </>
        )}
        </CardContent>
        <CardFooter
                    data-cy={sel('auth.signup.footer')}
        >
          <p className="text-sm text-muted-foreground text-center w-full">
            {t('signup.footer.alreadyHaveAccount')}{' '}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label={t('signup.footer.signInAria')}
              data-cy={sel('auth.signup.loginLink')}
            >
              {t('signup.footer.signIn')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
  )
}