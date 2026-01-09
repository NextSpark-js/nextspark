'use client';

import { resetPasswordSchema, type ResetPasswordFormData } from '@nextsparkjs/core/lib/validation';
import { useAuth } from '@nextsparkjs/core/hooks/useAuth';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import { sel } from '@nextsparkjs/testing';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '@nextsparkjs/core/components/ui/button';
import { Input } from '@nextsparkjs/core/components/ui/input';
import { Label } from '@nextsparkjs/core/components/ui/label';
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card';
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'


function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const t = useTranslations('auth');

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = form;

  const email = watch('email');

  const onSubmit = useCallback(async (data: ResetPasswordFormData) => {
    setLoading(true);
    setError(null);
    setStatusMessage(t('forgotPassword.messages.sending'));

    try {
      const result = await resetPassword(data.email);

      if (!result.success) {
        const errorMsg = result.error || 'Failed to send reset email';
        setError(errorMsg);
        setStatusMessage(`Error: ${errorMsg}`);
      } else {
        setSuccess(true);
        setStatusMessage(t('forgotPassword.messages.sent'));
      }
    } catch {
      setError('An unexpected error occurred');
      setStatusMessage(t('forgotPassword.messages.error'));
    } finally {
      setLoading(false);
    }
  }, [resetPassword, t]);

  if (success) {
    return (
      <>
        <div aria-live="polite" className="sr-only">
          {statusMessage}
        </div>
        <Card
          className="w-full max-w-md"
          data-cy={sel('auth.forgotPassword.successMessage')}
        >
          <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t('forgotPassword.success.title')}</h1>
              <p className="text-muted-foreground">
                We&apos;ve sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="text-muted-foreground">
                Please check your inbox and click the link to reset your password.
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Didn&apos;t receive the email?</strong>
                <br />
                • Check your spam folder
                <br />
                • Make sure you entered the correct email address
                <br />• Wait a few minutes and try again
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" asChild className="flex-1" data-cy={sel('auth.forgotPassword.successBack')}>
                <Link href="/login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Link>
              </Button>
              <Button
                onClick={() => {
                  setSuccess(false);
                  setError(null);
                  form.reset();
                }}
                className="flex-1"
                data-cy={sel('auth.forgotPassword.retryButton')}
              >
                Try Again
              </Button>
            </div>
          </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
      <Card className="w-full max-w-md" data-cy={sel('auth.forgotPassword.form')}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold" id="forgot-password-heading">
            {t('forgotPassword.title')}
          </CardTitle>
          <CardDescription>
            {t('forgotPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4" data-cy={sel('auth.forgotPassword.error')}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <div className="mt-1 text-sm">
                Please check your email address and try again.
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                className="pl-9"
                data-cy={sel('auth.forgotPassword.email')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            data-cy={sel('auth.forgotPassword.submitButton')}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reset link...
              </>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-primary hover:underline"
            data-cy={sel('auth.forgotPassword.backToLogin')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Login
          </Link>
        </div>
        </CardContent>
      </Card>
    </>
  );
}

// Opt out of static generation due to client-side state
export const dynamic = 'force-dynamic';

export default getTemplateOrDefaultClient('app/(auth)/forgot-password/page.tsx', ForgotPasswordPage)