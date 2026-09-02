/**
 * NextSpark Proxy (Next.js 16+)
 *
 * Handles authentication, route protection, and user context injection.
 * Note: In Next.js 16, "middleware" was renamed to "proxy" with nodejs runtime.
 *
 * Key responsibilities:
 * 1. Theme middleware override support
 * 2. Documentation access control
 * 3. Protected route authentication
 * 4. User header injection for downstream use (x-user-id, x-pathname)
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
 * Identity headers this proxy injects for downstream server code.
 *
 * SECURITY (#87): these headers are trusted by RSC layouts and permission
 * checks, so an inbound value must NEVER reach the app. They are stripped from
 * every request before any path branching and re-added only from the verified
 * session. Gating the strip on protected prefixes is not enough: Next.js
 * dispatches Server Actions by the `Next-Action` header, not by the URL, so an
 * action can be POSTed to a public path with a forged `x-user-id`.
 */
const TRUSTED_IDENTITY_HEADERS = ['x-user-id', 'x-user-email', 'x-pathname'] as const

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
 * Continue to the app with the (sanitized) request headers.
 * Every pass-through in this proxy MUST go through here so the strip applies
 * to public paths, /api/v1 and unmatched routes alike.
 */
function passThrough(requestHeaders: Headers): NextResponse {
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
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

  // 2. Redirect old docs URLs to new structure (2-level -> 3-level)
  const oldDocsPattern = /^\/docs\/([^\/]+)\/([^\/]+)$/
  const oldDocsMatch = pathname.match(oldDocsPattern)

  if (oldDocsMatch) {
    const [, sectionSlug, pageSlug] = oldDocsMatch
    const themeSections = ['theme-overview', 'theme-features']
    const category = themeSections.includes(sectionSlug) ? 'theme' : 'core'
    const cleanSection = sectionSlug.replace(/^theme-/, '')

    const newUrl = request.nextUrl.clone()
    newUrl.pathname = `/docs/${category}/${cleanSection}/${pageSlug}`
    return NextResponse.redirect(newUrl, 301)
  }

  // 3. Documentation access control
  if (pathname.startsWith('/docs')) {
    const appConfig = getThemeAppConfig(activeTheme as string)

    if (appConfig?.docs?.public === false) {
      try {
        const { data: session } = await betterFetch<Session>(
          '/api/auth/get-session',
          {
            baseURL: request.nextUrl.origin,
            headers: { cookie: request.headers.get('cookie') || '' },
          }
        )

        if (!session) {
          const loginUrl = new URL('/login', request.url)
          loginUrl.searchParams.set('redirect', pathname)
          return NextResponse.redirect(loginUrl)
        }
      } catch (error) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }
    }
    return passThrough(requestHeaders)
  }

  // 4. Allow public paths
  if (isPublicPath(pathname)) {
    return passThrough(requestHeaders)
  }

  // 5. API v1 routes handle their own dual authentication
  if (pathname.startsWith('/api/v1')) {
    return passThrough(requestHeaders)
  }

  // 6. Protected routes - require authentication and inject user headers
  const isAdminRoute = pathname.startsWith('/admin')
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/update-password') ||
    isAdminRoute

  if (isProtectedRoute) {
    try {
      const { data: session } = await betterFetch<Session>(
        '/api/auth/get-session',
        {
          baseURL: request.nextUrl.origin,
          headers: { cookie: request.headers.get('cookie') || '' },
        }
      )

      if (!session) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // Admin Panel superadmin-only check
      if (isAdminRoute) {
        if (!session.user?.role || session.user.role !== 'superadmin') {
          const dashboardUrl = new URL('/dashboard', request.url)
          dashboardUrl.searchParams.set('error', 'access_denied')
          return NextResponse.redirect(dashboardUrl)
        }
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

      return passThrough(requestHeaders)
    } catch (error) {
      console.error('Proxy error:', error)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return passThrough(requestHeaders)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
