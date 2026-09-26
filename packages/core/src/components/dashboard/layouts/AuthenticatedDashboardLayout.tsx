'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import { DashboardAuthSkeleton } from './DashboardAuthSkeleton'
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
  const router = useRouter()

  useEnsureUserMetadata()

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  if (isLoading) return <DashboardAuthSkeleton />
  if (!user) return null

  return (
    <>
      <DashboardTranslationPreloader />
      <TranslationDebugger />
      <Suspense fallback={null}>
        <AuthMethodDetectorWrapper />
      </Suspense>
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
