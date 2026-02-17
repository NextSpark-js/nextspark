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
import { exchangeToken, encryptToken, parseState } from '@/lib/github-manager'

export const runtime = 'nodejs'

const COOKIE_NAME = 'gh_token'

/** Public-facing origin — avoids Docker container hostname in redirects */
const PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4000'

function publicUrl(path: string): URL {
  return new URL(path, PUBLIC_ORIGIN)
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') || ''
  const { returnTo } = parseState(state)

  if (!code) {
    // User denied or error — redirect back
    const errorUrl = publicUrl(returnTo)
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

    // Redirect back to the original page with success indicator
    const successUrl = publicUrl(returnTo)
    successUrl.searchParams.set('gh_connected', '1')
    return NextResponse.redirect(successUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth failed'
    console.error('[github/callback] OAuth error:', message)

    const errorUrl = publicUrl(returnTo)
    errorUrl.searchParams.set('gh_error', 'token_exchange_failed')
    return NextResponse.redirect(errorUrl)
  }
}
