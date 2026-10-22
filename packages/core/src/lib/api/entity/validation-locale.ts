/**
 * The language the generic entity routes answer validation errors in (#358). It is opt-in: without
 * `api.validationLocale` in the app config the messages stay in English, as they always were.
 */

import type { NextRequest } from 'next/server'
import { getApplicationConfig } from '../../config'
import { createValidationTranslator } from '../../entities/validation-translator'
import type { ValidationTranslator } from '../../entities/portable/schema-generator'

async function loadCoreValidation(locale: string): Promise<Record<string, unknown> | null> {
  for (const candidate of new Set([locale, locale.split('-')[0]])) {
    if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(candidate)) continue
    try {
      const catalog = await import(`../../../messages/${candidate}/validation.json`)
      return { validation: catalog.default ?? catalog }
    } catch {
      // no catalog for this locale: try the language, then English
    }
  }
  return null
}

/** The translator for this request, or undefined (English) when the app did not opt in or has no catalog for the locale. */
export async function validationTranslatorFor(request: NextRequest): Promise<ValidationTranslator | undefined> {
  const setting = (await getApplicationConfig()).api.validationLocale
  if (!setting) return undefined
  let locale: string | null = setting
  if (setting === 'accept-language') {
    const { preferredLocaleFromHeader } = await import('../../locale')
    locale = preferredLocaleFromHeader(request.headers.get('accept-language'))
  }
  const catalog = locale ? await loadCoreValidation(locale) : null
  return catalog ? createValidationTranslator(catalog) : undefined
}
