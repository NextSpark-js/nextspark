"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from '@nextsparkjs/core/components/ui/button';
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert';
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { createCyId } from '@nextsparkjs/testing'

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleVerification = async () => {
      if (!token) {
        setError("No verification token provided");
        setStatus('error');
        return;
      }

      try {
        // Call the Better Auth verify endpoint with special header to avoid redirect loop
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'x-verify-from-ui': 'true'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          setError(errorText || "Email verification failed");
          setStatus('error');
        } else {
          setStatus('success');
          
          // Create default metadata after successful verification
          try {
            const response = await fetch('/api/auth/session', {
              method: 'GET',
              credentials: 'include'
            });
            
            if (response.ok) {
              const session = await response.json();
              if (session?.user?.id) {
                // Create default metadata for the newly verified user
                await fetch('/api/internal/user-metadata', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId: session.user.id,
                    metadata: {
                      uiPreferences: {
                        theme: "light",
                        sidebarCollapsed: false
                      },
                      securityPreferences: {
                        twoFactorEnabled: false,
                        loginAlertsEnabled: true
                      },
                      notificationsPreferences: {
                        pushEnabled: true,
                        loginAlertsEmail: true,
                        loginAlertsPush: true,
                        passwordChangesEmail: true,
                        passwordChangesPush: true,
                        suspiciousActivityEmail: true,
                        suspiciousActivityPush: true,
                        mentionsEmail: true,
                        mentionsPush: true,
                        projectUpdatesEmail: true,
                        projectUpdatesPush: false,
                        teamInvitesEmail: true,
                        teamInvitesPush: true,
                        newsletterEmail: false,
                        newsletterPush: false,
                        promotionsEmail: false,
                        promotionsPush: false,
                        featureAnnouncementsEmail: true,
                        featureAnnouncementsPush: false
                      }
                    }
                  })
                });
                console.log('Default metadata created for verified user:', session.user.id);
              }
            }
          } catch (metaError) {
            console.error('Error creating default metadata:', metaError);
            // Don't fail the verification if metadata creation fails
          }
          
          // Redirect after successful verification
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        }
      } catch {
        setError("An unexpected error occurred");
        setStatus('error');
      }
    };

    handleVerification();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="space-y-4" data-cy={createCyId('verify-email', 'loading')}>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Verifying Email</h2>
          <p className="text-sm text-muted-foreground mt-2">Please wait while we verify your email address</p>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-4" data-cy={createCyId('verify-email', 'success')}>
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Email Verified</h2>
          <p className="text-sm text-muted-foreground mt-2">Your email has been successfully verified</p>
        </div>
        <Alert>
          <AlertDescription>
            Redirecting you to the dashboard...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-cy={createCyId('verify-email', 'error')}>
      <div className="text-center">
        <div className="flex justify-center mb-2">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Verification Failed</h2>
        <p className="text-sm text-muted-foreground mt-2">We couldn&apos;t verify your email address</p>
      </div>
      {error && (
        <Alert variant="destructive" data-cy={createCyId('verify-email', 'error-message')}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button onClick={() => router.push('/signup')} variant="outline" className="flex-1" data-cy={createCyId('verify-email', 'back-signup')}>
          Back to Sign Up
        </Button>
        <Button onClick={() => router.push('/login')} className="flex-1" data-cy={createCyId('verify-email', 'go-login')}>
          Go to Login
        </Button>
      </div>
    </div>
  );
}

function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';

export default getTemplateOrDefaultClient('app/(auth)/verify-email/page.tsx', VerifyEmailPage)