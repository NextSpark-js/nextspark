"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from '@nextsparkjs/core/components/ui/button';
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert';
import { sel } from '@nextsparkjs/core/selectors/auth'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'
import { VERIFY_FROM_UI_HEADER } from '@nextsparkjs/core/lib/api/client-headers'

function VerifyEmailContent() {
  const searchParams = useSearchParams()!;
  const router = useRouter();
  const t = useTranslations("auth.verifyEmail");
  // The verification runs once per token: a new `t` (another language) must not run it again
  const tRef = useRef(t);
  tRef.current = t;
  const token = searchParams.get("token") || "";
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleVerification = async () => {
      if (!token) {
        setError(tRef.current("errors.noToken"));
        setStatus('error');
        return;
      }

      try {
        // Call the Better Auth verify endpoint with special header to avoid redirect loop
        const response = await fetch(withBasePath(`/api/auth/verify-email?token=${token}`), {
          method: 'GET',
          credentials: 'include',
          headers: {
            [VERIFY_FROM_UI_HEADER]: 'true'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          setError(errorText || tRef.current("errors.verificationFailed"));
          setStatus('error');
        } else {
          setStatus('success');
          
          // Create default metadata after successful verification
          try {
            const response = await fetch(withBasePath('/api/auth/get-session'), {
              method: 'GET',
              credentials: 'include'
            });
            
            if (response.ok) {
              const session = await response.json();
              if (session?.user?.id) {
                // Create default metadata for the newly verified user
                await fetch(withBasePath('/api/internal/user-metadata'), {
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
                if (process.env.NODE_ENV === 'development') console.log('Default metadata created for verified user:', session.user.id);
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
        setError(tRef.current("errors.unexpectedError"));
        setStatus('error');
      }
    };

    handleVerification();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="space-y-4" data-cy={sel('auth.verifyEmail.loading')}>
        <div className="text-center">
          <h2 className="text-xl font-semibold">{t("loading.title")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t("loading.description")}</p>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-4" data-cy={sel('auth.verifyEmail.success')}>
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">{t("success.title")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t("success.description")}</p>
        </div>
        <Alert>
          <AlertDescription>
            {t("success.redirectingDashboard")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-cy={sel('auth.verifyEmail.error')}>
      <div className="text-center">
        <div className="flex justify-center mb-2">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">{t("failed.title")}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t("failed.description")}</p>
      </div>
      {error && (
        <Alert variant="destructive" data-cy={sel('auth.verifyEmail.errorMessage')}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button onClick={() => router.push('/signup')} variant="outline" className="flex-1" data-cy={sel('auth.verifyEmail.backSignup')}>
          {t("backToSignup")}
        </Button>
        <Button onClick={() => router.push('/login')} className="flex-1" data-cy={sel('auth.verifyEmail.goLogin')}>
          {t("goToLogin")}
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


export default VerifyEmailPage