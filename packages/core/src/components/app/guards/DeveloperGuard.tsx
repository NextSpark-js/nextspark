"use client";

import { useSession } from '../../../lib/auth-client';
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from '../../ui/button';
import { useTranslations } from "next-intl";

interface DeveloperGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * DeveloperGuard Component
 *
 * Protects components/pages that should only be accessible to developer users.
 * Provides a fallback UI for unauthorized access attempts.
 * Uses purple/violet branding to differentiate from Admin Panel (red).
 *
 * @param children - Components to render if user is developer
 * @param fallback - Custom fallback component (optional)
 */
export function DeveloperGuard({ children, fallback }: DeveloperGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const t = useTranslations();

  // Auto-redirect non-developer users
  useEffect(() => {
    if (!isPending && session && session.user?.role !== 'developer') {
      router.push('/dashboard?error=access_denied');
    }
  }, [session, isPending, router]);

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="h-4 bg-muted rounded w-32"></div>
        </div>
      </div>
    );
  }

  // No session - should not happen due to middleware, but handle gracefully
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-purple-500" />
              {t('common.status.error')}
            </CardTitle>
            <CardDescription>
              Session not found. Please sign in again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full bg-purple-600 hover:bg-purple-700">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not a developer - show access denied
  if (session.user?.role !== 'developer') {
    // Use custom fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default access denied UI with purple/violet branding
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20">
        <Card className="w-full max-w-md border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <AlertTriangle className="h-5 w-5" />
              Developer Access Only
            </CardTitle>
            <CardDescription>
              You need developer privileges to access this area.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This section is restricted to platform developers only.
              If you believe this is an error, please contact the development team.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center gap-2 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/50"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is developer - render children
  return <>{children}</>;
}

/**
 * Hook to check if current user is developer
 * Useful for conditional rendering in components
 *
 * @returns boolean indicating if user is developer
 */
export function useIsDeveloper(): boolean {
  const { data: session } = useSession();
  return session?.user?.role === 'developer';
}
