/**
 * GitHub OAuth Callback
 *
 * GET /api/github/callback?code=xxx&state=yyy
 *
 * Exchanges the OAuth code for an access token,
 * stores it in an encrypted httpOnly cookie,
 * and redirects back to the build page.
 */

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { exchangeToken, encryptToken } from '@/lib/github-manager'

export const runtime = 'nodejs'

const COOKIE_NAME = 'gh_token'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    // User denied or error — redirect back
    const errorUrl = new URL('/build', request.url)
    errorUrl.searchParams.set('gh_error', 'no_code')
    return NextResponse.redirect(errorUrl)
  }

  try {
    const token = await exchangeToken(code)
    const encrypted = encryptToken(token)

    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, encrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    // Redirect to build page with success indicator
    const successUrl = new URL('/build', request.url)
    successUrl.searchParams.set('gh_connected', '1')
    return NextResponse.redirect(successUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth failed'
    console.error('[github/callback] OAuth error:', message)

    const errorUrl = new URL('/build', request.url)
    errorUrl.searchParams.set('gh_error', 'token_exchange_failed')
    return NextResponse.redirect(errorUrl)
  }
}
