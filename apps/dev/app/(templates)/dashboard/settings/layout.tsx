'use client'

import Link from 'next/link'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { SettingsSidebar } from '@nextsparkjs/core/components/settings/layouts/SettingsSidebar'
import { MobileTopBar } from '@nextsparkjs/core/components/dashboard/mobile/MobileTopBar'
import { MobileBottomNav } from '@nextsparkjs/core/components/dashboard/mobile/MobileBottomNav'
import { ArrowLeft } from 'lucide-react'
import { useState, useCallback } from 'react'
import { sel } from '@nextsparkjs/core/selectors'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [statusMessage, setStatusMessage] = useState('')
  const t = useTranslations('settings')

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
      >
        {statusMessage}
      </div>

      {/* Mobile only - TopBar */}
      <MobileTopBar />

      {/* Mobile only - BottomNav */}
      <MobileBottomNav />

      <div
        className="min-h-screen bg-gradient-to-b from-background to-muted/20"
        data-cy={sel('settings.sidebar.layout.main')}
      >
        <div className="max-w-7xl mx-auto p-4 lg:p-6 pt-16 pb-24 lg:pt-6 lg:pb-6">
          {/* Back Button - Desktop only */}
          <nav
            className="mb-6 hidden lg:block"
            aria-label={t('navigation.ariaLabel')}
            data-cy={sel('settings.sidebar.nav.container')}
          >
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleBackToDashboard}
                aria-label={t('navigation.backToDashboard')}
                data-cy={sel('settings.sidebar.backButton')}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t('navigation.backButton')}
              </Button>
            </Link>
          </nav>

          {/* Header - Desktop only */}
          <header
            className="mb-8 hidden lg:block"
            data-cy={sel('settings.sidebar.layout.header')}
          >
            <h1
              className="text-3xl font-bold"
              id="settings-main-heading"
            >
              {t('layout.title')}
            </h1>
            <p
              className="text-muted-foreground text-sm mt-1"
            >
              {t('layout.description')}
            </p>
          </header>

          {/* Main Content */}
          <main
            className="flex flex-col lg:flex-row gap-0 lg:gap-8"
            aria-labelledby="settings-main-heading"
            data-cy={sel('settings.sidebar.layout.contentArea')}
          >
            {/* Settings Sidebar - Desktop only */}
            <aside
              className="w-64 hidden lg:block"
              aria-label={t('layout.sidebarLabel')}
              data-cy={sel('settings.sidebar.container')}
            >
              <SettingsSidebar />
            </aside>

            {/* Content Area */}
            <section
              className="flex-1 w-full"
              aria-label={t('layout.contentLabel')}
              data-cy={sel('settings.sidebar.layout.pageContent')}
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