'use client'

import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { DashboardAuthSkeleton } from './DashboardAuthSkeleton'
import { DashboardTranslationPreloader } from '../../../lib/i18n/DashboardTranslationPreloader'
import { TranslationDebugger } from '../../../utils/dev/TranslationDebugger'
import { useEnsureUserMetadata } from '../../../hooks/useEnsureUserMetadata'
import { useAuthMethodDetector } from '../../../hooks/useAuthMethodDetector'

/**
 * Auth Method Detector Wrapper (uses useSearchParams internally)
 */
function AuthMethodDetectorWrapper() {
  useAuthMethodDetector()
  return null
}

/**
 * Dashboard Auth Layout Content — Client Component
 *
 * Handles authentication gate, user metadata, auth method detection,
 * and translation preloading.
 *
 * SECURITY: This component is NOT overrideable by themes to prevent
 * bypassing authentication.
 */
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // Ensure user has default metadata
  useEnsureUserMetadata()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <DashboardAuthSkeleton />
  }

  if (!user) {
    return null
  }

  return (
    <>
      {/* Preload dashboard translations for smooth navigation UX */}
      <DashboardTranslationPreloader key="dashboard-translation-preloader" />

      {/* Translation debugger (dev only, ?debug-i18n=true) */}
      <TranslationDebugger key="translation-debugger" />

      {/* Detect and save auth method from OAuth redirects (wrapped in Suspense) */}
      <Suspense key="auth-method-detector" fallback={null}>
        <AuthMethodDetectorWrapper />
      </Suspense>

      {/*
        Children run within authenticated boundary -
        nested layouts CAN be themed but security is guaranteed
      */}
      <div key="dashboard-children" data-cy="dashboard-container">{children}</div>
    </>
  )
}

/**
 * CORE SECURITY LAYOUT - NOT OVERRIDEABLE BY THEMES
 */
export function DashboardAuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>
}
