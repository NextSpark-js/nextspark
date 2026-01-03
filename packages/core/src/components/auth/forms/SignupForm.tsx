'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../../hooks/useAuth'
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
import { createTestId, sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { AuthTranslationPreloader } from '../../../lib/i18n/AuthTranslationPreloader'
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
  const { signUp, googleSignIn, resendVerificationEmail } = useAuth()
  const t = useTranslations('auth')

  // Read invitation-related params from URL
  const searchParams = useSearchParams()
  const inviteEmail = searchParams.get('email')
  const fromInvite = searchParams.get('fromInvite') === 'true'
  const callbackUrl = searchParams.get('callbackUrl')
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
            setError('An account with this email already exists. Please sign in instead.')
          } else if (result.code === 'EMAIL_MISMATCH') {
            setError('This invitation was sent to a different email address.')
          } else if (result.code === 'INVITATION_EXPIRED') {
            setError('This invitation has expired. Please request a new one.')
          } else if (result.code === 'INVITATION_NOT_FOUND') {
            setError('Invalid invitation. Please request a new one.')
          } else {
            setError(result.error || 'Failed to create account')
          }
          setStatusMessage(t('signup.messages.createError', { error: result.error || 'Unknown error' }))
          return
        }

        // Success! Show toast and redirect to team page
        toast.success('Account created successfully!', {
          description: 'You have joined the team.'
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account'
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
      setError(err instanceof Error ? err.message : 'Google sign up failed')
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
        setError(result.error || 'Failed to resend verification email')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email')
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
          {...createTestId('signup', 'status', 'message') && { 'data-testid': createTestId('signup', 'status', 'message') }}
        >
          {statusMessage}
        </div>

        <Card 
          className="w-full max-w-md"
          role="main"
          aria-labelledby="email-sent-heading"
          {...createTestId('signup', 'email-sent', 'card') && { 'data-testid': createTestId('signup', 'email-sent', 'card') }}
          data-cy={sel('auth.verifyEmail.container')}
        >
          <CardHeader 
            className="space-y-1"
            {...createTestId('signup', 'email-sent', 'header') && { 'data-testid': createTestId('signup', 'email-sent', 'header') }}
          >
            <div 
              className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4"
              role="img"
              aria-label="Email enviado exitosamente"
            >
              <MailCheck className="w-6 h-6 text-green-600" aria-hidden="true" />
            </div>
            <CardTitle 
              id="email-sent-heading"
              className="text-2xl font-bold text-center"
              {...createTestId('signup', 'email-sent', 'title') && { 'data-testid': createTestId('signup', 'email-sent', 'title') }}
            >
              {t('signup.emailVerification.title')}
            </CardTitle>
            <CardDescription 
              className="text-center"
              {...createTestId('signup', 'email-sent', 'description') && { 'data-testid': createTestId('signup', 'email-sent', 'description') }}
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
              Please check your inbox and click the verification link to activate your account.
              The link will expire in 24 hours.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <span className="text-primary font-medium">1.</span>
              Open your email inbox
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-medium">2.</span>
              Find the email from us (check spam if needed)
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-medium">3.</span>
              Click the verification button
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
              Didn&apos;t receive the email?
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
                Back
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
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            Already verified?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
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
        {...createTestId('signup', 'status', 'message') && { 'data-testid': createTestId('signup', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <Card 
        className="w-full max-w-md"
        data-testid={createTestId('signup', 'card')}
        data-cy={sel('auth.signup.form')}
      >
        <CardHeader 
          className="space-y-1"
          {...createTestId('signup', 'header') && { 'data-testid': createTestId('signup', 'header') }}
        >
          <CardTitle 
            className="text-2xl font-bold"
            id="signup-heading"
            {...createTestId('signup', 'title') && { 'data-testid': createTestId('signup', 'title') }}
          >
            {t('signup.title')}
          </CardTitle>
          <CardDescription 
            {...createTestId('signup', 'description') && { 'data-testid': createTestId('signup', 'description') }}
          >
            {t('signup.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Team Invitation Banner */}
          {fromInvite && (
            <Alert className="mb-4" data-cy="signup-invite-banner">
              <Users className="h-4 w-4" />
              <AlertDescription>
                {t('signup.inviteBanner')}
              </AlertDescription>
            </Alert>
          )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  {...register('firstName')}
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="John"
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
              <Label htmlFor="lastName">Last name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  {...register('lastName')}
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Doe"
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
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
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
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              {...register('password')}
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
              showRequirements={true}
              password={password}
              data-cy={sel('auth.signup.password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
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
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked: boolean | 'indeterminate') => setAgreedToTerms(checked as boolean)}
              data-cy="signup-terms-checkbox"
            />
            <Label 
              htmlFor="terms" 
              className="text-sm font-normal cursor-pointer"
            >
              I agree to the{' '}
              <Link href="/terms" className="text-primary hover:underline">
                terms and conditions
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
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignUp}
          disabled={!!loadingProvider}
          className="w-full"
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
          Continue with Google
        </Button>
        </CardContent>
        <CardFooter
          data-testid={createTestId('signup', 'footer')}
          data-cy="signup-footer"
        >
          <p className="text-sm text-muted-foreground text-center w-full">
            Already have an account?{' '}
            <Link 
              href="/login" 
              className="text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Ir a página de inicio de sesión"
              data-testid={createTestId('signup', 'login', 'link')}
              data-cy={sel('auth.signup.loginLink')}
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
  )
}