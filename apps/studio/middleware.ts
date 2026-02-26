import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const PUBLIC_PATHS = ['/login', '/register', '/api/auth', '/api/clear-session']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if path is public
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Optimistic session check via cookie
  const sessionCookie = getSessionCookie(request)

  if (!sessionCookie && !isPublic) {
    // Unauthenticated — redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (sessionCookie && (pathname === '/login' || pathname === '/register')) {
    // Don't block login/register access — cookie may be stale (session expired in DB).
    // Let the page render; the login page itself will redirect if truly authenticated.
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
