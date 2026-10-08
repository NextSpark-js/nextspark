'use client'

import { useTranslations } from 'next-intl'

/**
 * First tab stop of a dashboard page: lets keyboard users skip the sidebar and the top bar (WCAG 2.4.1).
 * The page renders its `<main id="main-content" tabIndex={-1}>`, which is where focus lands.
 */
export function SkipLink() {
  const t = useTranslations('common')
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {t('a11y.skipToMainContent')}
    </a>
  )
}
