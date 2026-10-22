'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { resolveLocalizedText } from '../lib/blocks/localized-text'
import { I18N_CONFIG } from '../lib/config/i18n-config-client'
import type { LocalizedText } from '../types/blocks'

/** Resolves a block name or description (a string, or a text per locale) for the active locale. */
export function useLocalizedText() {
  const locale = useLocale()
  return useCallback(
    (value: LocalizedText | undefined) => resolveLocalizedText(value, locale, I18N_CONFIG.defaultLocale),
    [locale]
  )
}
