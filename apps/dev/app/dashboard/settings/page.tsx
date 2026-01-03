'use client'

import { createTestId, createCyId } from '@nextsparkjs/core/lib/test'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'
import { getEnabledSettingsPages } from '@nextsparkjs/core/lib/config'
import {
  User,
  Lock,
  Shield,
  Bell,
  CreditCard,
  Key,
  type LucideIcon
} from 'lucide-react'

// Icon mapping for settings pages
const SETTINGS_ICONS: Record<string, LucideIcon> = {
  profile: User,
  password: Lock,
  security: Shield,
  notifications: Bell,
  'api-keys': Key,
  billing: CreditCard,
}

function SettingsPage() {
  const t = useTranslations('settings')

  // Get enabled settings pages from config
  const enabledPages = useMemo(() => {
    return getEnabledSettingsPages()
  }, [])

  return (
    <div
      className="max-w-2xl"
      {...createTestId('settings', 'overview', 'container') && { 'data-testid': createTestId('settings', 'overview', 'container') }}
      {...createCyId('settings', 'overview') && { 'data-cy': createCyId('settings', 'overview') }}
    >
      <div className="space-y-6">
        <header>
          <h2
            className="text-2xl font-bold"
            id="settings-overview-heading"
            {...createTestId('settings', 'overview', 'title') && { 'data-testid': createTestId('settings', 'overview', 'title') }}
          >
            {t('overview.title')}
          </h2>
          <p
            className="text-muted-foreground mt-2"
            {...createTestId('settings', 'overview', 'description') && { 'data-testid': createTestId('settings', 'overview', 'description') }}
          >
            {t('overview.description')}
          </p>
        </header>

        <section
          aria-labelledby="settings-overview-heading"
          className="space-y-4"
        >
          {enabledPages.map((page) => {
            const Icon = SETTINGS_ICONS[page.key] || User

            return (
              <Link
                key={page.key}
                href={`/dashboard/settings/${page.key}`}
                className="block p-6 rounded-lg border border-border bg-card hover:bg-accent transition-colors group"
                {...createTestId('settings', 'overview', page.key) && { 'data-testid': createTestId('settings', 'overview', page.key) }}
                {...createCyId('settings', `overview-${page.key}`) && { 'data-cy': createCyId('settings', `overview-${page.key}`) }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">
                      {t(`navigation.${page.key}`)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(`overview.${page.key}Description`)}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      </div>
    </div>
  )
}

export default SettingsPage