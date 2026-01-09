"use client";

import { changePasswordSchema, type ChangePasswordFormData } from "@nextsparkjs/core/lib/validation";
import { useAuth } from "@nextsparkjs/core/hooks/useAuth";
import { useUserProfile } from "@nextsparkjs/core/hooks/useUserProfile";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2
} from "lucide-react";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import { Button } from "@nextsparkjs/core/components/ui/button";
import { Label } from "@nextsparkjs/core/components/ui/label";
import { PasswordInput } from "@nextsparkjs/core/components/ui/password-input";
import { Alert, AlertDescription } from "@nextsparkjs/core/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { Checkbox } from "@nextsparkjs/core/components/ui/checkbox";
import { createTestId, createCyId } from '@nextsparkjs/testing';
import { useTranslations } from 'next-intl';
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

function UpdatePasswordPage() {
  const { changePassword, user } = useAuth();
  const { hasPassword, isLoading: profileLoading } = useUserProfile();
  const router = useRouter();
  const t = useTranslations('settings');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      revokeOtherSessions: false,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  const newPassword = watch("newPassword");

  const onSubmit = useCallback(async (data: ChangePasswordFormData) => {
    setLoading(true);
    setError(null);
    setStatusMessage(t('password.messages.updating'));

    try {
      const result = await changePassword(
        data.currentPassword, 
        data.newPassword, 
        data.revokeOtherSessions
      );

      if (!result.success) {
        const errorMsg = result.error || t('password.messages.updateError');
        setError(errorMsg);
        setStatusMessage(`${t('common.status.error')}: ${errorMsg}`);
      } else {
        setSuccess(true);
        setStatusMessage(t('password.messages.updateSuccess'));
      }
    } catch {
      const errorMsg = t('password.messages.unexpectedError');
      setError(errorMsg);
      setStatusMessage(`${t('common.status.error')}: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [changePassword, t]);

  if (!user) {
    router.push('/login');
    return null;
  }

  // Redirect Google users - they can't change password
  if (!profileLoading && !hasPassword) {
    router.push('/dashboard/settings/profile');
    return null;
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('password.loading.verifying')}</span>
      </div>
    );
  }

  if (success) {
    return (
      <>
        {/* MANDATORY: Screen reader announcements */}
        <div 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
          {...createTestId('password', 'status', 'message') && { 'data-testid': createTestId('password', 'status', 'message') }}
        >
          {statusMessage}
        </div>

        <div 
          className="max-w-4xl"
          {...createTestId('password', 'success', 'container') && { 'data-testid': createTestId('password', 'success', 'container') }}
          {...createCyId('password', 'success') && { 'data-cy': createCyId('password', 'success') }}
        >
          <div className="space-y-6">
            <div 
              className="text-center space-y-4"
              role="status"
              aria-live="polite"
            >
              <div 
                className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"
                role="img"
                aria-label={t('password.success.aria')}
                {...createTestId('password', 'success', 'icon') && { 'data-testid': createTestId('password', 'success', 'icon') }}
              >
                <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h1 
                  className="text-2xl font-bold"
                  {...createTestId('password', 'success', 'title') && { 'data-testid': createTestId('password', 'success', 'title') }}
                >
                  {t('password.success.title')}
                </h1>
                <p 
                  className="text-muted-foreground"
                  {...createTestId('password', 'success', 'description') && { 'data-testid': createTestId('password', 'success', 'description') }}
                >
                  {t('password.success.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        {...createTestId('password', 'status', 'message') && { 'data-testid': createTestId('password', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <div 
        className="max-w-4xl"
        {...createTestId('password', 'container') && { 'data-testid': createTestId('password', 'container') }}
        {...createCyId('password', 'main') && { 'data-cy': createCyId('password', 'main') }}
      >
        <div className="space-y-6">
          {/* Header */}
          <header 
            {...createTestId('password', 'header') && { 'data-testid': createTestId('password', 'header') }}
            {...createCyId('password', 'header') && { 'data-cy': createCyId('password', 'header') }}
          >
            <h1 
              className="text-2xl font-bold"
              id="password-heading"
              {...createTestId('password', 'title') && { 'data-testid': createTestId('password', 'title') }}
            >
              {t('password.title')}
            </h1>
            <p 
              className="text-muted-foreground mt-1"
              {...createTestId('password', 'description') && { 'data-testid': createTestId('password', 'description') }}
            >
              {t('password.description')}
            </p>
          </header>

          <Card
            {...createTestId('password', 'form', 'card') && { 'data-testid': createTestId('password', 'form', 'card') }}
            {...createCyId('password', 'form') && { 'data-cy': createCyId('password', 'form') }}
          >
            <CardHeader>
              <CardTitle 
                id="password-form-title"
                {...createTestId('password', 'form', 'title') && { 'data-testid': createTestId('password', 'form', 'title') }}
              >
                {t('password.form.title')}
              </CardTitle>
              <CardDescription
                {...createTestId('password', 'form', 'description') && { 'data-testid': createTestId('password', 'form', 'description') }}
              >
                {t('password.form.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert 
                  variant="destructive" 
                  className="mb-4"
                  role="alert"
                  aria-live="assertive"
                  {...createTestId('password', 'error', 'alert') && { 'data-testid': createTestId('password', 'error', 'alert') }}
                  {...createCyId('password', 'error') && { 'data-cy': createCyId('password', 'error') }}
                >
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form 
                onSubmit={handleSubmit(onSubmit)} 
                className="space-y-6"
                aria-labelledby="password-form-title"
                {...createTestId('password', 'form', 'element') && { 'data-testid': createTestId('password', 'form', 'element') }}
                {...createCyId('password', 'form-element') && { 'data-cy': createCyId('password', 'form-element') }}
              >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('password.form.currentPassword')}</Label>
                  <PasswordInput
                    {...register("currentPassword")}
                    id="currentPassword"
                    autoComplete="current-password"
                    placeholder={t('password.form.currentPasswordPlaceholder')}
                    aria-required="true"
                    aria-describedby={errors.currentPassword ? "currentPassword-error" : undefined}
                    {...createTestId('password', 'current', 'input') && { 'data-testid': createTestId('password', 'current', 'input') }}
                    {...createCyId('password', 'current-input') && { 'data-cy': createCyId('password', 'current-input') }}
                  />
                {errors.currentPassword && (
                  <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('password.form.newPassword')}</Label>
                <PasswordInput
                  {...register("newPassword")}
                  id="newPassword"
                  autoComplete="new-password"
                  placeholder={t('password.form.newPasswordPlaceholder')}
                  showRequirements={true}
                  password={newPassword || ""}
                />
                {errors.newPassword && (
                  <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('password.form.confirmPassword')}</Label>
                <PasswordInput
                  {...register("confirmPassword")}
                  id="confirmPassword"
                  autoComplete="new-password"
                  placeholder={t('password.form.confirmPasswordPlaceholder')}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Action Section - Checkbox and Button */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="revokeOtherSessions"
                    {...register("revokeOtherSessions")}
                    {...createTestId('password', 'revoke', 'checkbox') && { 'data-testid': createTestId('password', 'revoke', 'checkbox') }}
                    {...createCyId('password', 'revoke-sessions') && { 'data-cy': createCyId('password', 'revoke-sessions') }}
                  />
                  <Label
                    htmlFor="revokeOtherSessions"
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t('password.form.revokeOtherSessions')}
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  aria-describedby="submit-help"
                  className="w-full md:w-auto"
                  {...createTestId('password', 'submit', 'button') && { 'data-testid': createTestId('password', 'submit', 'button') }}
                  {...createCyId('password', 'submit') && { 'data-cy': createCyId('password', 'submit') }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      {t('password.form.updating')}
                    </>
                  ) : (
                    t('password.form.updateButton')
                  )}
                </Button>
                <div id="submit-help" className="sr-only">
                  {loading ? t('password.form.submitHelpUpdating') : t('password.form.submitHelp')}
                </div>
              </div>
            </form>
          </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// Opt out of static generation due to client-side state
export const dynamic = 'force-dynamic';

export default getTemplateOrDefaultClient('app/dashboard/settings/password/page.tsx', UpdatePasswordPage)