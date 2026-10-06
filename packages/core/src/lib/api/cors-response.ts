/**
 * Core's CORS answer for /api responses, in one place: addCorsHeaders and wrapAuthHandlerWithCors (helpers.ts)
 * and the common route wrapper (withRateLimitTier) all use it, so every response and preflight a route gives
 * names the same origin, with or without credentials, for the same request.
 */
import { NextResponse } from 'next/server'
import { APP_CONFIG_MERGED } from '../config'
import { getCorsOrigins, getTrustedOrigins, isOriginAllowed, normalizeOrigin } from '../utils/cors'
import type { ApplicationConfig } from '../config/config-types'

type CorsConfig = Pick<ApplicationConfig, 'api'>

export const CORS_ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
export const CORS_ALLOW_HEADERS = 'Content-Type, Authorization, X-API-Key, x-team-id, x-builder-source'

/**
 * Which origin a CORS response may name, and whether credentials go with it.
 * A listed origin (getCorsOrigins, wildcard entries allowed) is echoed with
 * credentials. In development with allowAllOrigins.development, any other
 * origin is echoed too, but with credentials only when the cookie-write origin
 * check trusts it (getTrustedOrigins). Any other origin gets no grant: the
 * response names no origin and sends no credentials header.
 */
export function corsGrant(
  origin: string,
  config: CorsConfig,
  env: string
): { origin: string; credentials: boolean } | null {
  const normalizedOrigin = normalizeOrigin(origin);
  const listed = isOriginAllowed(normalizedOrigin, getCorsOrigins(config as ApplicationConfig, env));
  if (listed) return { origin: listed, credentials: true };
  if (env === 'development' && config.api.cors.allowAllOrigins.development) {
    const trusted = isOriginAllowed(normalizedOrigin, getTrustedOrigins(config as ApplicationConfig, normalizedOrigin, env));
    return { origin: normalizedOrigin, credentials: trusted !== null };
  }
  return null;
}

/** `Vary: Origin` once, however many times CORS is applied to the same response. */
export function varyOnOrigin(headers: Headers): void {
  const vary = headers.get('vary') ?? '';
  if (!vary.split(',').some(value => value.trim().toLowerCase() === 'origin')) headers.set('Vary', vary ? `${vary}, Origin` : 'Origin');
}

/** Core's CORS headers for a request's grant (corsGrant; null for none), written onto `headers`. */
export function setCorsHeaders(
  headers: Headers,
  grant: { origin: string; credentials: boolean } | null
): void {
  if (grant) {
    headers.set('Access-Control-Allow-Origin', grant.origin);
    if (grant.credentials) headers.set('Access-Control-Allow-Credentials', 'true');
  }
  // Credentialed CORS echoes a per-request origin, so the response varies by
  // Origin — tell caches to key on it (prevents serving origin A's grant to B).
  varyOnOrigin(headers);
  headers.set('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
  headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
  headers.set('Access-Control-Max-Age', '86400');
}

/**
 * `response` with core's CORS for `request`. A response that already names an origin was answered by its
 * route (addCorsHeaders, or a CORS policy of its own) and is returned as it is. A response with read-only
 * headers is copied first.
 */
export function withCors<R extends Response>(response: R, request: Request): R {
  if (response.headers.has('access-control-allow-origin')) return response;
  const origin = request.headers.get('origin');
  const env = process.env.NODE_ENV || 'development';
  const grant = origin ? corsGrant(origin, APP_CONFIG_MERGED as CorsConfig, env) : null;
  try {
    setCorsHeaders(response.headers, grant);
    return response;
  } catch {
    const copy = new Response(response.body, { status: response.status, statusText: response.statusText, headers: new Headers(response.headers) });
    setCorsHeaders(copy.headers, grant);
    return copy as R;
  }
}

/**
 * A CORS preflight answered with the same grant the route's responses get. Routes export it as their
 * `OPTIONS`: without one, Next.js answers OPTIONS itself, with no CORS headers.
 */
export function corsPreflight(request: Request): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
