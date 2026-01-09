"use client";

import { newPasswordSchema, type NewPasswordFormData } from "@nextsparkjs/core/lib/validation";
import { useAuth } from "@nextsparkjs/core/hooks/useAuth";
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

import { Button } from "@nextsparkjs/core/components/ui/button";
import { Label } from "@nextsparkjs/core/components/ui/label";
import { PasswordInput } from "@nextsparkjs/core/components/ui/password-input";
import { Alert, AlertDescription } from "@nextsparkjs/core/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { createCyId } from '@nextsparkjs/testing'

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { updatePassword } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError("Invalid or missing reset token. Please request a new password reset.");
    }
  }, [token]);

  const onSubmit = useCallback(async (data: NewPasswordFormData) => {
    if (!token) {
      setError("Token de recuperación inválido");
      return;
    }

    setLoading(true);
    setError(null);
    console.log('Actualizando contraseña...');

    try {
      const result = await updatePassword(data.password, token);

      if (!result.success) {
        const errorMsg = result.error || "Failed to reset password";
        setError(errorMsg);
      } else {
        setSuccess(true);
        console.log('Contraseña actualizada exitosamente');
      }
    } catch {
      setError('Error inesperado al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  }, [token, updatePassword]);

  if (success) {
    return (
      <Card className="w-full max-w-md" data-cy={createCyId('reset-password', 'success')}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Password Reset Successful!</h1>
              <p className="text-muted-foreground">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
            </div>
            <Button asChild className="w-full" data-cy={createCyId('reset-password', 'login-link')}>
              <Link href="/login">
                Sign In Now
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md" data-cy={createCyId('reset-password', 'form')}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
        <CardDescription>
          Choose a strong password for your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4" data-cy={createCyId('reset-password', 'error')}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {error.includes("token") && (
                <div className="mt-1">
                  <Link href="/forgot-password" className="underline">
                    Request a new password reset
                  </Link>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <PasswordInput
              {...register("password")}
              id="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              showRequirements={true}
              password={password || ""}
              data-cy={createCyId('reset-password', 'password-input')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <PasswordInput
              {...register("confirmPassword")}
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm your new password"
              data-cy={createCyId('reset-password', 'confirm-input')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !token}
            className="w-full"
            data-cy={createCyId('reset-password', 'submit')}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting password...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
            data-cy={createCyId('reset-password', 'back')}
          >
            Back to Login
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
export const dynamic = 'force-dynamic';

export default getTemplateOrDefaultClient('app/(auth)/reset-password/page.tsx', ResetPasswordPage)