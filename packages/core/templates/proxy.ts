/**
 * `nextspark sync:app` keeps this file up to date while its first line is the
 * generated tag sync writes and the rest of the file is unchanged since then,
 * which is how a release ships changes to it. Edit the file, or delete that
 * line, to own it: from then on sync reports it and leaves it alone.
 *
 * NextSpark Proxy (Next.js 16+)
 *
 * Handles authentication, route protection, and user context injection.
 * Note: In Next.js 16, "middleware" was renamed to "proxy" with nodejs runtime.
 *
 * Key responsibilities:
 * 1. Theme middleware override support
 * 2. Redirecting historical 3-level docs URLs to their current route
 * 3. Documentation access control
 * 4. Protected route authentication, and the roles /superadmin and /devtools need
 * 5. User header injection for downstream use (x-user-id, x-pathname, x-active-team-id)
 *
 * IMPORTANT: The EntityPermissionLayout depends on x-user-id and x-pathname
 * headers being set here for server-side permission validation.
 */
import { betterFetch } from '@better-fetch/fetch'
import { NextRequest, NextResponse } from 'next/server'
import {
  hasThemeMiddleware,
  executeThemeMiddleware,
  getThemeAppConfig
} from '@nextsparkjs/core/lib/middleware'
import { ACTIVE_TEAM_COOKIE, activeTeamIdForSession } from '@nextsparkjs/core/lib/teams/active-team-cookie'
import { SESSION_HINT_COOKIE, SESSION_HINT_MAX_AGE, hasSessionCookie } from '@nextsparkjs/core/lib/auth/session-hint'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'

/**
 * Session type for proxy (inline definition)
 */
interface Session {
  user: {
    id: string
    email?: string
    role?: string
    [key: string]: unknown
  } | null
  session?: {
    id: string
    [key: string]: unknown
  }
}

/**
 * Public paths that don't require authentication
 */
const publicPaths = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/terms',
  '/privacy',
  '/api/auth',
  '/api/test-auth',
  '/auth-test',
  '/auth/callback',
] as const

/**
 * Check if a path is public (doesn't require auth)
 */
function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

/**
 * Whether `pathname` is `prefix` or a path under it: `/devtools/config` is,
 * `/devtools-guide` and `/profile-photo.jpg` are not.
 */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * A URL on this app at `pathname`, keeping the base path and locale the request
 * came in with; one built from `request.url` would lose both.
 */
function appUrl(request: NextRequest, pathname: string): NextRequest['nextUrl'] {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return url
}

/**
 * Send a visitor without a session to login. LoginForm reads `callbackUrl` and
 * returns them to the page they asked for, query included, once signed in.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = appUrl(request, '/login')
  loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

/** Send a signed-in user without the role an area needs back to the dashboard. */
function redirectAccessDenied(request: NextRequest): NextResponse {
  const dashboardUrl = appUrl(request, '/dashboard')
  dashboardUrl.searchParams.set('error', 'access_denied')
  return NextResponse.redirect(dashboardUrl)
}

/**
 * The session the request's cookies carry, asked of this app's own auth route,
 * which is served under the base path like every other route.
 */
function getSession(request: NextRequest) {
  return betterFetch<Session>('/api/auth/get-session', {
    baseURL: `${request.nextUrl.origin}${request.nextUrl.basePath}`,
    headers: { cookie: request.headers.get('cookie') || '' },
  })
}

/**
 * Identity headers this proxy injects for downstream server code.
 *
 * SECURITY (#87): these headers are trusted by RSC layouts and permission
 * checks, so an inbound value must NEVER reach the app. They are stripped from
 * every request before any path branching and re-added only from the verified
 * session. Gating the strip on protected prefixes is not enough: Next.js
 * dispatches Server Actions by the `Next-Action` header, not by the URL, so an
 * action can be POSTed to a public path with a forged `x-user-id`.
 */
const TRUSTED_IDENTITY_HEADERS = ['x-user-id', 'x-user-email', 'x-pathname', 'x-active-team-id'] as const

/**
 * Build the request headers forwarded to the app: inbound copy minus every
 * trusted identity header, plus the real pathname.
 */
function sanitizeRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  for (const name of TRUSTED_IDENTITY_HEADERS) {
    headers.delete(name)
  }
  headers.set('x-pathname', request.nextUrl.pathname)
  return headers
}

/**
 * Keep the readable session hint (lib/auth/session-hint) in line with the
 * session cookie, so client code knows whether to ask for the session. A browser
 * that got its session without client code seeing it (before the hint existed,
 * or through OAuth) gets the hint on its next request, and one whose session
 * cookie is gone loses it. The session itself is not checked here.
 */
function syncSessionHint(request: NextRequest, response: NextResponse): NextResponse {
  const hasSession = hasSessionCookie(request.headers.get('cookie'))
  const hinted = request.cookies.get(SESSION_HINT_COOKIE)?.value === '1'
  if (hasSession && !hinted) {
    response.cookies.set(SESSION_HINT_COOKIE, '1', {
      path: '/',
      maxAge: SESSION_HINT_MAX_AGE,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    })
  } else if (!hasSession && hinted) {
    response.cookies.set(SESSION_HINT_COOKIE, '', { path: '/', maxAge: 0 })
  }
  return response
}

/**
 * Continue to the app with the (sanitized) request headers.
 * Every pass-through in this proxy MUST go through here so the strip applies
 * to public paths, /api/v1 and unmatched routes alike.
 */
function passThrough(request: NextRequest, requestHeaders: Headers): NextResponse {
  return syncSessionHint(request, NextResponse.next({
    request: { headers: requestHeaders },
  }))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 0. Strip forgeable identity headers before ANY branching (see #87)
  const requestHeaders = sanitizeRequestHeaders(request)

  // 1. Check for theme middleware override
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME
  if (activeTheme && hasThemeMiddleware(activeTheme)) {
    const themeResponse = await executeThemeMiddleware(activeTheme, request, null)
    if (themeResponse) return themeResponse
  }

  // 2. Redirect historical 3-level docs URLs (/docs/<core|theme>/<section>/<page>)
  // to the current route. That split predates this app's history: `core` and
  // `theme` were the only two categories ever generated (a third, `plugins`,
  // was scaffolded but never activated), and both were collapsed into a single
  // docs tree per source - `public` (served at /docs) and `superadmin` (served
  // at /superadmin/docs) - without renaming any section that survived the
  // collapse. A section from that era can therefore only be in one of the two
  // registries today, or in neither if its docs were dropped rather than
  // moved; the redirect follows the section, not the old category. The page
  // has to survive too - a section can live on with a different set of pages -
  // so both are checked against the registry rather than only the section,
  // which is the one thing this route can actually confirm still resolves.
  const oldDocsMatch = pathname.match(/^\/docs\/(?:core|theme)\/([^/]+)\/([^/]+)$/)
  if (oldDocsMatch) {
    const [, sectionSlug, pageSlug] = oldDocsMatch
    const newUrl = request.nextUrl.clone()
    const superadminSection = DOCS_REGISTRY.superadmin.find((section) => section.slug === sectionSlug)
    const publicSection = DOCS_REGISTRY.public.find((section) => section.slug === sectionSlug)

    if (superadminSection?.pages.some((page) => page.slug === pageSlug)) {
      newUrl.pathname = `/superadmin/docs/${sectionSlug}/${pageSlug}`
    } else if (publicSection?.pages.some((page) => page.slug === pageSlug)) {
      newUrl.pathname = `/docs/${sectionSlug}/${pageSlug}`
    } else {
      // The section is gone, or survived without this exact page - either way
      // there is no page left to send this to, so it goes to the docs home
      // instead of a dead link.
      newUrl.pathname = '/docs'
    }
    return NextResponse.redirect(newUrl, 301)
  }

  // 3. Documentation access control
  if (isUnder(pathname, '/docs')) {
    const appConfig = getThemeAppConfig(activeTheme as string)

    if (appConfig?.docs?.public === false) {
      try {
        const { data: session } = await getSession(request)

        if (!session) {
          return redirectToLogin(request)
        }
      } catch (error) {
        return redirectToLogin(request)
      }
    }
    return passThrough(request, requestHeaders)
  }

  // 4. Allow public paths
  if (isPublicPath(pathname)) {
    return passThrough(request, requestHeaders)
  }

  // 5. API v1 routes handle their own dual authentication
  if (pathname.startsWith('/api/v1')) {
    return passThrough(request, requestHeaders)
  }

  // 6. Protected routes - require authentication and inject user headers.
  // Areas are matched by path segment, so /dashboard-guide is not /dashboard.
  // /superadmin and /devtools also need a role, the same ones SuperAdminGuard
  // and DeveloperGuard let in. The guards decide it again in the browser, but
  // only after the page has been served, so it is decided here first.
  const isAdminRoute = isUnder(pathname, '/admin')
  const isSuperadminRoute = isUnder(pathname, '/superadmin')
  const isDevtoolsRoute = isUnder(pathname, '/devtools')
  const isProtectedRoute =
    isUnder(pathname, '/dashboard') ||
    isUnder(pathname, '/settings') ||
    isUnder(pathname, '/profile') ||
    isUnder(pathname, '/update-password') ||
    isAdminRoute ||
    isSuperadminRoute ||
    isDevtoolsRoute

  if (isProtectedRoute) {
    try {
      const { data: session } = await getSession(request)

      if (!session) {
        return redirectToLogin(request)
      }

      const role = session.user?.role

      // Admin Panel superadmin-only check
      if (isAdminRoute && role !== 'superadmin') {
        return redirectAccessDenied(request)
      }

      if (isSuperadminRoute && role !== 'superadmin' && role !== 'developer') {
        return redirectAccessDenied(request)
      }

      if (isDevtoolsRoute && role !== 'developer') {
        return redirectAccessDenied(request)
      }

      // Inject user headers for downstream use, ONLY from the verified session
      // (requestHeaders already had any inbound values stripped).
      // IMPORTANT: EntityPermissionLayout depends on these headers
      if (session.user?.id) {
        requestHeaders.set('x-user-id', session.user.id)
      }
      if (session.user?.email) {
        requestHeaders.set('x-user-email', session.user.email)
      }
      // The team this session chose, for the dashboard layouts' permission
      // checks; a cookie another session left behind names no team here.
      const activeTeamId = activeTeamIdForSession(request.cookies.get(ACTIVE_TEAM_COOKIE)?.value, session.session?.id)
      if (activeTeamId) {
        requestHeaders.set('x-active-team-id', activeTeamId)
      }

      return passThrough(request, requestHeaders)
    } catch (error) {
      console.error('Proxy error:', error)
      return redirectToLogin(request)
    }
  }

  return passThrough(request, requestHeaders)
}

/**
 * Everything runs through the proxy except the exact paths of Next's own
 * output: `_next/static/`, the `_next/image` endpoint and `favicon.ico`.
 * Excluding by file extension, or by a prefix without its boundary, would let a
 * dynamic segment such as `alice.png` or `favicon.icoevil` reach the app without
 * the session check and with forged identity headers intact. Files under
 * public/ simply pass through.
 */
export const config = {
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
  ],
}
