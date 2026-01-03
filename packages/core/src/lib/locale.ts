import { cookies, headers } from 'next/headers'
import { I18N_CONFIG, type SupportedLocale } from './config'
import { auth } from './auth'
import { queryOne } from './db'

export async function getUserLocale(): Promise<SupportedLocale> {
  // 1. Check user profile from database first (highest priority)
  try {
    const sessionHeaders = await headers()
    const session = await auth.api.getSession({ headers: sessionHeaders })

    if (session?.user?.id) {
      const user = await queryOne<{ language: string }>(
        'SELECT language FROM "users" WHERE id = $1',
        [session.user.id]
      )

      if (user?.language && I18N_CONFIG.supportedLocales.includes(user.language as SupportedLocale)) {
        return user.language as SupportedLocale
      }
    }
  } catch (error) {
    // Silently fail and continue to next detection method
    // This is expected during static generation
  }

  // 2. Check cookie
  try {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get(I18N_CONFIG.cookie.name)?.value

    if (cookieLocale && I18N_CONFIG.supportedLocales.includes(cookieLocale as SupportedLocale)) {
      return cookieLocale as SupportedLocale
    }
  } catch (error) {
    // Silently fail during static generation
  }

  // 3. Check Accept-Language header
  try {
    const headersList = await headers()
    const acceptLanguage = headersList.get('accept-language')
    if (acceptLanguage) {
      const preferredLocale = acceptLanguage.split(',')[0].split('-')[0] as SupportedLocale
      if (I18N_CONFIG.supportedLocales.includes(preferredLocale)) {
        return preferredLocale
      }
    }
  } catch (error) {
    // Silently fail during static generation
  }

  // 4. Default to configured default locale
  return I18N_CONFIG.defaultLocale
}

export async function setUserLocale(locale: string) {
  // Validate input locale using configuration
  if (!I18N_CONFIG.supportedLocales.includes(locale as SupportedLocale)) {
    throw new Error(
      `Unsupported locale: ${locale}. Supported locales: ${I18N_CONFIG.supportedLocales.join(', ')}`
    )
  }

  const cookieStore = await cookies()
  const cookieConfig = I18N_CONFIG.cookie
  
  cookieStore.set(cookieConfig.name, locale, {
    expires: new Date(Date.now() + cookieConfig.maxAge),
    httpOnly: cookieConfig.httpOnly,
    secure: cookieConfig.secure === 'auto' 
      ? process.env.NODE_ENV === 'production' 
      : cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    path: cookieConfig.path
  })
}

// Re-export types and constants from config for backward compatibility
export const SUPPORTED_LOCALES = I18N_CONFIG.supportedLocales
export type { SupportedLocale }
