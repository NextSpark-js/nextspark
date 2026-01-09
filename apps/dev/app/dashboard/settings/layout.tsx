'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { SettingsSidebar } from '@nextsparkjs/core/components/settings/layouts/SettingsSidebar'
import { MobileTopBar } from '@nextsparkjs/core/components/dashboard/mobile/MobileTopBar'
import { MobileBottomNav } from '@nextsparkjs/core/components/dashboard/mobile/MobileBottomNav'
import { ArrowLeft } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'
import { createTestId, createCyId } from '@nextsparkjs/testing'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { isSettingsPageEnabled } from '@nextsparkjs/core/lib/config/config-sync'

/**
 * Map of URL paths to settings page keys for validation
 */
const PATH_TO_PAGE_KEY: Record<string, string> = {
  '/dashboard/settings/profile': 'profile',
  '/dashboard/settings/security': 'security',
  '/dashboard/settings/password': 'password',
  '/dashboard/settings/notifications': 'notifications',
  '/dashboard/settings/api-keys': 'api-keys',
  '/dashboard/settings/billing': 'billing',
  '/dashboard/settings/teams': 'teams',
  '/dashboard/settings/teams/permissions': 'teams',
  '/dashboard/settings/invoices': 'billing',
}

function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [statusMessage, setStatusMessage] = useState('')
  const pathname = usePathname()
  const t = useTranslations('settings')

  // Validate if the current settings page is enabled
  // This prevents access to disabled pages via direct URL
  useEffect(() => {
    const pageKey = PATH_TO_PAGE_KEY[pathname]

    // If we have a page key mapping, check if it's enabled
    if (pageKey) {
      const enabled = isSettingsPageEnabled(pageKey)
      if (!enabled) {
        notFound()
      }
    }
    // For paths not in the mapping (like /dashboard/settings itself), allow access
  }, [pathname])

  const handleBackToDashboard = useCallback(() => {
    setStatusMessage(t('navigation.backToDashboard'))
  }, [t])

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        {...createTestId('settings-layout', 'status', 'message') && { 'data-testid': createTestId('settings-layout', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      {/* Mobile only - TopBar */}
      <MobileTopBar />

      {/* Mobile only - BottomNav */}
      <MobileBottomNav />

      <div
        className="min-h-screen bg-gradient-to-b from-background to-muted/20"
        {...createTestId('settings-layout', 'container') && { 'data-testid': createTestId('settings-layout', 'container') }}
        {...createCyId('settings-layout', 'main') && { 'data-cy': createCyId('settings-layout', 'main') }}
      >
        <div className="max-w-7xl mx-auto p-4 lg:p-6 pt-16 pb-24 lg:pt-6 lg:pb-6">
          {/* Back Button - Desktop only */}
          <nav
            className="mb-6 hidden lg:block"
            aria-label={t('navigation.ariaLabel')}
            {...createTestId('settings-layout', 'nav') && { 'data-testid': createTestId('settings-layout', 'nav') }}
            {...createCyId('settings-layout', 'nav') && { 'data-cy': createCyId('settings-layout', 'nav') }}
          >
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleBackToDashboard}
                aria-label={t('navigation.backToDashboard')}
                {...createTestId('settings-layout', 'back', 'button') && { 'data-testid': createTestId('settings-layout', 'back', 'button') }}
                {...createCyId('settings-layout', 'back-to-dashboard') && { 'data-cy': createCyId('settings-layout', 'back-to-dashboard') }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t('navigation.backButton')}
              </Button>
            </Link>
          </nav>

          {/* Header - Desktop only */}
          <header
            className="mb-8 hidden lg:block"
            {...createTestId('settings-layout', 'header') && { 'data-testid': createTestId('settings-layout', 'header') }}
            {...createCyId('settings-layout', 'header') && { 'data-cy': createCyId('settings-layout', 'header') }}
          >
            <h1
              className="text-3xl font-bold"
              id="settings-main-heading"
              {...createTestId('settings-layout', 'title') && { 'data-testid': createTestId('settings-layout', 'title') }}
            >
              {t('layout.title')}
            </h1>
            <p
              className="text-muted-foreground text-sm mt-1"
              {...createTestId('settings-layout', 'description') && { 'data-testid': createTestId('settings-layout', 'description') }}
            >
              {t('layout.description')}
            </p>
          </header>

          {/* Main Content */}
          <main
            className="flex flex-col lg:flex-row gap-0 lg:gap-8"
            aria-labelledby="settings-main-heading"
            {...createTestId('settings-layout', 'main', 'content') && { 'data-testid': createTestId('settings-layout', 'main', 'content') }}
            {...createCyId('settings-layout', 'content-area') && { 'data-cy': createCyId('settings-layout', 'content-area') }}
          >
            {/* Settings Sidebar - Desktop only */}
            <aside
              className="w-64 hidden lg:block"
              aria-label={t('layout.sidebarLabel')}
              {...createTestId('settings-layout', 'sidebar', 'container') && { 'data-testid': createTestId('settings-layout', 'sidebar', 'container') }}
              {...createCyId('settings-layout', 'sidebar') && { 'data-cy': createCyId('settings-layout', 'sidebar') }}
            >
              <SettingsSidebar />
            </aside>

            {/* Content Area */}
            <section
              className="flex-1 w-full"
              aria-label={t('layout.contentLabel')}
              {...createTestId('settings-layout', 'page', 'content') && { 'data-testid': createTestId('settings-layout', 'page', 'content') }}
              {...createCyId('settings-layout', 'page-content') && { 'data-cy': createCyId('settings-layout', 'page-content') }}
            >
              {children}
            </section>
          </main>
        </div>
      </div>
    </>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/layout.tsx', SettingsLayout)