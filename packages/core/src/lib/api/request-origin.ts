/**
 * Request origin check for cookie-authenticated writes.
 *
 * A POST/PUT/PATCH/DELETE that authenticates with the session cookie must come
 * from an origin the app trusts: its own (NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL)
 * or one in the list Better Auth already trusts for sign-in (see
 * getTrustedOrigins). withRateLimitTier runs it before every handler it wraps.
 *
 * What passes without a trusted origin, and why:
 * - Reads (GET/HEAD/OPTIONS).
 * - Requests without the session cookie: there is no session for them to use.
 * - Requests with an `Authorization: Bearer` token or an x-api-key header (API
 *   keys, the mobile client's bearer token). A browser adds those only when the page's script
 *   sets them, and a script on another origin needs CORS approval first.
 * - Requests with neither Origin nor Referer, unless their body is one an HTML
 *   form can send. Browsers send Origin on every write, so these come from
 *   native or server-side clients; requiring a non-form content type keeps
 *   a body without origin information from ever being read as a form post.
 */

import { NextResponse } from 'next/server'
import { APP_CONFIG_MERGED } from '../config'
import { hasSessionCookie } from '../auth/session-hint'
import { getTrustedOrigins, isOriginAllowed, normalizeOrigin } from '../utils/cors'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** The content types an HTML form can submit. */
const FORM_CONTENT_TYPES = new Set(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data'])

/** The Origin header, or the origin of the Referer when Origin is absent. */
function requestOrigin(headers: Headers): string | null {
  const origin = headers.get('origin')
  if (origin) return origin
  const referer = headers.get('referer')
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return 'null'
  }
}

/** `Authorization: Bearer <token>` or a non-empty `x-api-key`. Other schemes (Basic, ...) are not counted. */
function hasHeaderCredential(headers: Headers): boolean {
  if (headers.get('x-api-key')?.trim()) return true
  return /^bearer\s+\S/i.test(headers.get('authorization') ?? '')
}

/**
 * Returns a 403 response when a cookie-authenticated write does not come from a
 * trusted origin, or null when the request may proceed.
 */
export function checkRequestOrigin(request: Request): NextResponse | null {
  if (!WRITE_METHODS.has(request.method.toUpperCase())) return null
  const headers = request.headers
  if (!hasSessionCookie(headers.get('cookie'))) return null
  if (hasHeaderCredential(headers)) return null

  const origin = requestOrigin(headers)
  if (origin === null) {
    const contentType = (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!FORM_CONTENT_TYPES.has(contentType)) return null
    return NextResponse.json(
      { success: false, error: 'This request needs an Origin header', code: 'ORIGIN_REQUIRED' },
      { status: 403 }
    )
  }

  const normalized = normalizeOrigin(origin)
  if (isOriginAllowed(normalized, getTrustedOrigins(APP_CONFIG_MERGED, normalized))) return null
  return NextResponse.json(
    { success: false, error: 'Request origin not allowed', code: 'ORIGIN_NOT_ALLOWED' },
    { status: 403 }
  )
}
