import { CONSENT_CONFIG } from '../config/public-config-client'
import { GRANTED, parseConsentCookie, readCookie, type ConsentState, type ResolvedConsentConfig } from './cookie'

type HeadersLike = { get(name: string): string | null }

/** Where to read the `Cookie` header from: a Headers object, a Request or NextRequest, or the header's value. */
type CookieSource = HeadersLike | { headers: HeadersLike } | string | null | undefined

/**
 * The visitor's consent as the request carries it (#272), for server components that must not render a marketing
 * pixel before it is granted. Without a source it reads the current request's headers (`next/headers`), which makes the
 * page render per request.
 *
 * No cookie, a malformed or expired one, or one from another version: nothing optional granted.
 * With `consent.enabled` off in app.config nothing is gated and everything is granted.
 */
export async function getConsent(source?: CookieSource, config: ResolvedConsentConfig = CONSENT_CONFIG): Promise<ConsentState> {
  if (!config.enabled) return { categories: GRANTED, hasChosen: true }
  const resolved: CookieSource = source === undefined ? await (await import('next/headers')).headers() : source
  const headers = (resolved && typeof resolved === 'object' && 'headers' in resolved ? resolved.headers : resolved) as HeadersLike | string | null | undefined
  const header = typeof headers === 'string' ? headers : headers?.get('cookie')
  return parseConsentCookie(readCookie(header, config.cookieName), config)
}
