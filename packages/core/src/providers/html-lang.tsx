'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

/**
 * With Cache Components the root layout is prerendered, so `<html lang>` is the default locale's. The dashboard and
 * superadmin areas are rendered per request: this sets the attribute to the locale they render in (#413).
 */
export function HtmlLang() {
  const locale = useLocale()
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return null
}
