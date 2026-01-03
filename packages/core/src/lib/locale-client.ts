'use client'

import { I18N_CONFIG, type SupportedLocale } from './config'

// Client-side function to set locale cookie
export function setUserLocaleClient(locale: string) {
  // Validate input locale using configuration
  if (!I18N_CONFIG.supportedLocales.includes(locale as SupportedLocale)) {
    throw new Error(
      `Unsupported locale: ${locale}. Supported locales: ${I18N_CONFIG.supportedLocales.join(', ')}`
    )
  }

  const cookieConfig = I18N_CONFIG.cookie
  const expires = new Date(Date.now() + cookieConfig.maxAge)
  
  // Set cookie using document.cookie for client-side
  document.cookie = `${cookieConfig.name}=${locale}; expires=${expires.toUTCString()}; path=${cookieConfig.path}; SameSite=${cookieConfig.sameSite}`
}

// Re-export types from config for backward compatibility
// Note: SUPPORTED_LOCALES is exported from locale.ts to avoid duplicate exports
export { I18N_CONFIG }
export type { SupportedLocale }
