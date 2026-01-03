import { I18N_CONFIG, type SupportedLocale } from './config'

/**
 * Validates if a locale string is supported
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return I18N_CONFIG.supportedLocales.includes(locale as SupportedLocale)
}

/**
 * Gets a safe locale, falling back to default if invalid
 */
export function getSafeLocale(locale?: string | null): SupportedLocale {
  if (!locale) return I18N_CONFIG.defaultLocale
  return isValidLocale(locale) ? locale : I18N_CONFIG.defaultLocale
}

/**
 * Validates translation keys exist to prevent runtime errors
 */
export function validateTranslationKey(
  messages: Record<string, unknown>, 
  key: string, 
  locale: string
): boolean {
  const keys = key.split('.')
  let current = messages
  
  for (const k of keys) {
    if (!current?.[k]) {
      console.warn(`Missing translation key "${key}" for locale "${locale}"`)
      return false
    }
    current = current[k] as Record<string, unknown>
  }
  
  return true
}

/**
 * Development helper to detect missing translations
 */
export function detectMissingTranslations(
  enMessages: Record<string, unknown>,
  esMessages: Record<string, unknown>,
  path: string = ''
): string[] {
  const missing: string[] = []
  
  function checkMessages(en: Record<string, unknown>, es: Record<string, unknown>, currentPath: string) {
    for (const key in en) {
      const newPath = currentPath ? `${currentPath}.${key}` : key
      
      if (typeof en[key] === 'object' && en[key] !== null) {
        if (!es[key] || typeof es[key] !== 'object') {
          missing.push(newPath)
        } else {
          checkMessages(en[key] as Record<string, unknown>, es[key] as Record<string, unknown>, newPath)
        }
      } else {
        if (!es[key]) {
          missing.push(newPath)
        }
      }
    }
  }
  
  checkMessages(enMessages, esMessages, path)
  return missing
}

