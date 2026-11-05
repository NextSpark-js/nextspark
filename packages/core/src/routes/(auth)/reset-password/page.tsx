"use client";

import { newPasswordSchema, type NewPasswordFormData } from "@nextsparkjs/core/lib/validation";
import { useAuthActions } from "@nextsparkjs/core/hooks/useAuth";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Button } from "@nextsparkjs/core/components/ui/button";
import { Label } from "@nextsparkjs/core/components/ui/label";
import { PasswordInput } from "@nextsparkjs/core/components/ui/password-input";
import { Alert, AlertDescription } from "@nextsparkjs/core/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { sel } from '@nextsparkjs/core/selectors/auth'

function ResetPasswordContent() {
  const searchParams = useSearchParams()!;
  const token = searchParams.get("token") || "";
  const { updatePassword } = useAuthActions();
  const t = useTranslations("auth.resetPassword");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The alert offers a new reset link when the link, not the password, is what failed
  const [tokenError, setTokenError] = useState(false);
  const [success, setSuccess] = useState(false);


  const form = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  const password = watch("password");

  useEffect(() => {
    // If no token is present, this is not a valid reset link
    if (!token) {
      setError(t("errors.missingToken"));
      setTokenError(true);
    }
  }, [token, t]);

  const onSubmit = useCallback(async (data: NewPasswordFormData) => {
    if (!token) {
      setError(t("errors.invalidToken"));
      setTokenError(true);
      return;
    }

    setLoading(true);
    setError(null);
    setTokenError(false);
    if (process.env.NODE_ENV === 'development') console.log('Updating password...');

    try {
      const result = await updatePassword(data.password, token);

      if (!result.success) {
        const errorMsg = result.error || t("errors.failed");
        setError(errorMsg);
        // The server's own answer for an expired or used link ("Invalid token") also offers a new link
        setTokenError(/token/i.test(result.error ?? ''));
      } else {
        setSuccess(true);
        if (process.env.NODE_ENV === 'development') console.log('Password updated successfully');
      }
    } catch {
      setError(t("errors.unexpected"));
    } finally {
      setLoading(false);
    }
  }, [token, updatePassword, t]);

  if (success) {
    return (
      <Card className="w-full max-w-md" data-cy={sel('auth.resetPassword.success')}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t("successTitle")}</h1>
              <p className="text-muted-foreground">
                {t("successDescription")}
              </p>
            </div>
            <Button asChild className="w-full" data-cy={sel('auth.resetPassword.loginLink')}>
              <Link href="/login">
                {t("signInNow")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md" data-cy={sel('auth.resetPassword.form')}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4" data-cy={sel('auth.resetPassword.error')}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {tokenError && (
                <div className="mt-1">
                  <Link href="/forgot-password" className="underline">
                    {t("requestNew")}
                  </Link>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <PasswordInput
              {...register("password")}
              id="password"
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
              showRequirements={true}
              password={password || ""}
              data-cy={sel('auth.resetPassword.passwordInput')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <PasswordInput
              {...register("confirmPassword")}
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t("confirmPlaceholder")}
              data-cy={sel('auth.resetPassword.confirmInput')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !token}
            className="w-full"
            data-cy={sel('auth.resetPassword.submit')}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submitButton")
            )}
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
            data-cy={sel('auth.resetPassword.back')}
          >
            {t("backToLogin")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

// Opt out of static generation due to client-side state

export default ResetPasswordPage