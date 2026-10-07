'use client'

import { Suspense, useEffect } from 'react'
import { loadLoginPage } from '../../../lib/auth/load-login-page'
import { useAuth } from '../../../hooks/useAuth'
import { DashboardProviders } from '../../../providers/DashboardProviders'
import { DashboardTranslationPreloader } from '../../../lib/i18n/DashboardTranslationPreloader'
import { TranslationDebugger } from '../../../utils/dev/TranslationDebugger'
import { useEnsureUserMetadata } from '../../../hooks/useEnsureUserMetadata'
import { useAuthMethodDetector } from '../../../hooks/useAuthMethodDetector'

function AuthMethodDetectorWrapper() {
  useAuthMethodDetector()
  return null
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  useEnsureUserMetadata()

  useEffect(() => {
    if (!isLoading && !user) loadLoginPage()
  }, [user, isLoading])

  // Signed out: nothing, the effect above sends the visitor to the login page. While the session loads the
  // page renders anyway: a gate that replaced it with a skeleton would leave the route's own segments out
  // of the server render (Next reports them as dropped from its instant-navigation check), and the shell
  // and the page already show their own loading states.
  if (!isLoading && !user) return null

  return (
    <>
      {user && (
        <>
          <DashboardTranslationPreloader />
          <TranslationDebugger />
          <Suspense fallback={null}>
            <AuthMethodDetectorWrapper />
          </Suspense>
        </>
      )}
      <div id="dashboard-container" data-cy="dashboard-container" data-testid="dashboard-container">
        {children}
      </div>
    </>
  )
}

/** Client half of app/dashboard/layout.tsx; the server layout owns i18n data. */
export function AuthenticatedDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProviders>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </DashboardProviders>
  )
}
