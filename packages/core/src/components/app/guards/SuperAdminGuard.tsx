"use client";

import { useSession } from '../../../lib/auth-client';
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from '../../ui/button';
import { useTranslations } from "next-intl";

interface SuperAdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * SuperAdminGuard Component
 *
 * Protects components/pages that should only be accessible to superadmin or developer users.
 * Developer users (hierarchy: 100) can access Admin Panel as they have the highest level of access.
 * Provides a fallback UI for unauthorized access attempts.
 *
 * @param children - Components to render if user is superadmin or developer
 * @param fallback - Custom fallback component (optional)
 */
export function SuperAdminGuard({ children, fallback }: SuperAdminGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const t = useTranslations();

  // Auto-redirect users without superadmin or developer access
  useEffect(() => {
    if (!isPending && session && session.user?.role !== 'superadmin' && session.user?.role !== 'developer') {
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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('common.status.error')}
            </CardTitle>
            <CardDescription>
              Session not found. Please sign in again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not a superadmin or developer - show access denied
  if (session.user?.role !== 'superadmin' && session.user?.role !== 'developer') {
    // Use custom fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default access denied UI
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You need superadmin or developer privileges to access this area.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This section is restricted to system administrators only. 
              If you believe this is an error, please contact support.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is superadmin or developer - render children
  return <>{children}</>;
}

/**
 * Hook to check if current user is superadmin
 * Useful for conditional rendering in components
 *
 * @returns boolean indicating if user is superadmin
 */
export function useIsSuperAdmin(): boolean {
  const { data: session } = useSession();
  return session?.user?.role === 'superadmin';
}

/**
 * Hook to check if current user can access Admin Panel (superadmin or developer)
 * Useful for conditional rendering in components
 *
 * @returns boolean indicating if user can access Admin Panel
 */
export function useCanAccessAdmin(): boolean {
  const { data: session } = useSession();
  return session?.user?.role === 'superadmin' || session?.user?.role === 'developer';
}
