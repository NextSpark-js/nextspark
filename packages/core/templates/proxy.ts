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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
    return NextResponse.next()
  }

  // 4. Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 5. API v1 routes handle their own dual authentication
  if (pathname.startsWith('/api/v1')) {
    return NextResponse.next()
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

      // Inject user headers for downstream use
      // IMPORTANT: EntityPermissionLayout depends on these headers
      const requestHeaders = new Headers(request.headers)
      if (session.user?.id) {
        requestHeaders.set('x-user-id', session.user.id)
      }
      if (session.user?.email) {
        requestHeaders.set('x-user-email', session.user.email)
      }
      requestHeaders.set('x-pathname', pathname)

      return NextResponse.next({
        request: { headers: requestHeaders },
      })
    } catch (error) {
      console.error('Proxy error:', error)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
