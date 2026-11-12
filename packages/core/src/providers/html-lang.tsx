'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

/**
 * With Cache Components the root layout is prerendered, so `<html lang>` is the default locale's. The dashboard and
 * superadmin areas are rendered per request: this sets the attribute to the locale they render in (#413), and so do the
 * `(public)` and `(auth)` groups with `i18n.requestLocale` (#442).
 */
export function HtmlLang() {
  const locale = useLocale()
  useEffect(() => {
    // Leaving the area puts back what the page below it (or the root layout) had, so a client navigation does not carry it over (#442)
    const previous = document.documentElement.lang
    document.documentElement.lang = locale
    return () => {
      document.documentElement.lang = previous
    }
  }, [locale])
  return null
}
