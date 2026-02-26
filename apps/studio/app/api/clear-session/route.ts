/**
 * Safety-valve endpoint to clear stale session cookies.
 *
 * When Better Auth's sign-out fails (e.g. session already deleted from DB),
 * the httpOnly cookie remains and the middleware blocks access to /login.
 * GET /api/clear-session clears the cookie and redirects to /login.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  const response = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4000'))

  // Clear all possible Better Auth session cookie names
  const cookieNames = [
    'better-auth.session_token',
    '__Secure-better-auth.session_token',
  ]

  for (const name of cookieNames) {
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      httpOnly: true,
    })
  }

  return response
}
