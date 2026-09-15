import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { I18N_CONFIG, type SupportedLocale } from './config'
import { auth } from './auth'
import { hasSessionCookie } from './auth/session-hint'

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && I18N_CONFIG.supportedLocales.includes(value as SupportedLocale)
}

/**
 * Whether an app renders a single locale: it has only one, or turned detection
 * off with `i18n.localeDetection: false`.
 */
export function isLocaleFixed(): boolean {
  return I18N_CONFIG.supportedLocales.length <= 1 || I18N_CONFIG.localeDetection === false
}

/**
 * The supported locale an Accept-Language header prefers most: by quality, then
 * by order, taking a full tag (`pt-BR`) before its language (`pt`).
 */
export function preferredLocaleFromHeader(header: string | null | undefined): SupportedLocale | null {
  if (!header) return null
  const ranges = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';')
      const quality = params.map(param => param.trim()).find(param => param.startsWith('q='))
      return { tag: tag.trim(), quality: quality ? Number(quality.slice(2)) : 1, index }
    })
    .filter(range => range.tag && range.tag !== '*' && range.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)

  for (const { tag } of ranges) {
    const exact = I18N_CONFIG.supportedLocales.find((locale: string) => locale.toLowerCase() === tag.toLowerCase())
    if (exact) return exact as SupportedLocale
    const language = tag.split('-')[0].toLowerCase()
    if (isSupportedLocale(language)) return language
  }
  return null
}

/**
 * The locale to render the current request in. It is resolved once per request:
 * the root layout, the i18n request config and every server translation ask.
 *
 * 1. An app whose locale is fixed (see isLocaleFixed) renders its default locale
 *    and reads nothing from the request, so its pages can be prerendered.
 * 2. The locale cookie, written when the language changes and kept in line with
 *    a signed-in user's account by SessionCookieRefresher.
 * 3. The signed-in user's language, from the session. The session is read only
 *    when the request carries a session cookie, so a page an anonymous visitor
 *    opens makes no session read and no database query.
 * 4. The Accept-Language header.
 * 5. The default locale.
 */
export const getUserLocale = cache(async (): Promise<SupportedLocale> => {
  if (isLocaleFixed()) return I18N_CONFIG.defaultLocale

  try {
    const cookieLocale = (await cookies()).get(I18N_CONFIG.cookie.name)?.value
    if (isSupportedLocale(cookieLocale)) return cookieLocale
  } catch {
    // No request scope (static generation): nothing to read
  }

  let requestHeaders: Headers | null = null
  try {
    requestHeaders = await headers()
  } catch {
    return I18N_CONFIG.defaultLocale
  }

  if (hasSessionCookie(requestHeaders.get('cookie'))) {
    try {
      // `disableRefresh`: this runs while rendering Server Components, where
      // Next.js cannot write cookies. Without it Better Auth's rolling renewal
      // would extend `expiresAt` in the DB but the re-issued cookie would be
      // dropped, consuming the renewal window. Real renewal happens from a Route
      // Handler: see `lib/auth/session-refresh.ts` / `useSessionCookieRefresh`.
      const session = await auth.api.getSession({
        headers: requestHeaders,
        query: { disableRefresh: true },
      })
      const language = (session?.user as { language?: unknown } | undefined)?.language
      if (isSupportedLocale(language)) return language
    } catch {
      // An unreadable session falls through to the header
    }
  }

  return preferredLocaleFromHeader(requestHeaders.get('accept-language')) ?? I18N_CONFIG.defaultLocale
})

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
    // Always readable: client code rewrites this cookie (a language switch, a
    // sign-in, the account's language read with each session), and a script
    // cannot replace a cookie written HttpOnly.
    httpOnly: false,
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
