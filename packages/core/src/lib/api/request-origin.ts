/**
 * Request origin check for cookie-authenticated writes.
 *
 * A POST/PUT/PATCH/DELETE that authenticates with the session cookie must come
 * from an origin the app trusts: its own (NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL)
 * or one in the list Better Auth already trusts for sign-in (see
 * getTrustedOrigins). withRateLimitTier runs it before every handler it wraps.
 * Under the admin and developer areas (isAppOnlyCorsPath) only the app's own
 * origin is trusted, plus, outside production, the request's own origin when it
 * is a private-network address (#170); no other listed origin.
 *
 * What passes without a trusted origin, and why:
 * - Reads (GET/HEAD/OPTIONS).
 * - Requests without the session cookie: there is no session for them to use.
 * - Requests that present an API key (`Authorization: Bearer sk_...` or
 *   x-api-key, in the API-key format). They are let through without their
 *   session cookie, so the handler can authenticate them only by the key: a key
 *   that does not validate gets 401, never the cookie's session. Any other
 *   Authorization value is not a credential here, and the check applies. Handlers
 *   should read the session from the request they are given, not from
 *   next/headers.
 * - Requests with neither Origin nor Referer, unless their body is one an HTML
 *   form can send. Browsers send Origin on every write, so these come from
 *   native or server-side clients; requiring a non-form content type keeps
 *   a body without origin information from ever being read as a form post.
 */

import { NextRequest, NextResponse } from 'next/server'
import { APP_CONFIG_MERGED } from '../config'
import { hasSessionCookie } from '../auth/session-hint'
import { getTrustedOrigins, isOriginAllowed, isPrivateLanOrigin, normalizeCorsEnvironment, normalizeOrigin } from '../utils/cors'
import { ApiKeyManager, presentedApiKey } from './keys'
import { appOrigins, isAppOnlyCorsPath, requestPathname } from './cors-response'

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

/** Better Auth's cookies (`better-auth.*`, with or without the `__Secure-` prefix). */
const SESSION_COOKIE_NAME = /^(?:__Secure-)?better-auth[.-]/

/** The request without Better Auth's cookies; other cookies are kept. */
function withoutSessionCookies(request: NextRequest): NextRequest {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })
  const kept = (headers.cookie ?? '')
    .split(';')
    .map(part => part.trim())
    .filter(part => part && !SESSION_COOKIE_NAME.test(part))
  if (kept.length) headers.cookie = kept.join('; ')
  else delete headers.cookie
  return new NextRequest(request.url, {
    method: request.method,
    headers,
    body: request.body,
    signal: request.signal,
    nextConfig: { basePath: request.nextUrl.basePath },
  })
}

/** Whether a write from `origin` (normalized) to `request`'s path comes from an origin the app trusts. */
function isTrustedWriteOrigin(request: NextRequest, origin: string): boolean {
  // A path that cannot be determined counts as app-only.
  const path = requestPathname(request)
  if (path === undefined || isAppOnlyCorsPath(path)) {
    const lan = normalizeCorsEnvironment(process.env.NODE_ENV || 'development') !== 'production' && isPrivateLanOrigin(origin)
    return lan || appOrigins().includes(origin)
  }
  return isOriginAllowed(origin, getTrustedOrigins(APP_CONFIG_MERGED, origin)) !== null
}

function refusal(error: string, code: 'ORIGIN_REQUIRED' | 'ORIGIN_NOT_ALLOWED'): NextResponse {
  return NextResponse.json({ success: false, error, code }, { status: 403 })
}

/**
 * Checks a write's origin. Returns a 403 response when a cookie-authenticated
 * write does not come from a trusted origin. Otherwise returns the request the
 * handler should get: the same request, or, for a write that would be refused
 * but presents an API key, a copy without its session cookie.
 */
export function checkRequestOrigin(request: NextRequest): NextResponse | NextRequest {
  if (!WRITE_METHODS.has(request.method.toUpperCase())) return request
  const headers = request.headers
  if (!hasSessionCookie(headers.get('cookie'))) return request

  let refused: NextResponse
  const origin = requestOrigin(headers)
  if (origin === null) {
    const contentType = (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!FORM_CONTENT_TYPES.has(contentType)) return request
    refused = refusal('This request needs an Origin header', 'ORIGIN_REQUIRED')
  } else {
    const normalized = normalizeOrigin(origin)
    if (isTrustedWriteOrigin(request, normalized)) return request
    refused = refusal('Request origin not allowed', 'ORIGIN_NOT_ALLOWED')
  }

  const apiKey = presentedApiKey(headers)
  if (apiKey && ApiKeyManager.validateKeyFormat(apiKey)) return withoutSessionCookies(request)
  return refused
}
