'use client'

import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { DashboardTranslationPreloader } from '@nextsparkjs/core/lib/i18n/DashboardTranslationPreloader'
import { TranslationDebugger } from '@nextsparkjs/core/utils/dev/TranslationDebugger'
import { useEnsureUserMetadata } from '@nextsparkjs/core/hooks/useEnsureUserMetadata'
import { useAuthMethodDetector } from '@nextsparkjs/core/hooks/useAuthMethodDetector'

/**
 * Auth Method Detector Wrapper (uses useSearchParams internally)
 */
function AuthMethodDetectorWrapper() {
  useAuthMethodDetector()
  return null
}

/**
 * Dashboard Layout Content
 */
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // Asegurar que el usuario tenga metadata default
  useEnsureUserMetadata()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      test123312312123123123
      {/* Precargar traducciones del dashboard para mejorar UX de navegación */}
      <DashboardTranslationPreloader key="dashboard-translation-preloader" />

      {/* Debugger de traducciones (solo en desarrollo con ?debug-i18n=true) */}
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
 *
 * This layout provides essential authentication and security measures
 * that cannot be bypassed by theme overrides. All dashboard routes
 * run within this authenticated boundary.
 *
 * SECURITY: This layout is intentionally NOT using template resolver
 * to prevent themes from bypassing authentication.
 */
export default function CoreDashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>
}
