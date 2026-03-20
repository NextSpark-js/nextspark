/**
 * Marketplace OAuth Callback API Route Tests
 *
 * GET /api/v1/marketplace/oauth/callback?code=xxx&state=<token>
 * Handles OAuth callback from MercadoPago, exchanges code for tokens.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuthenticateRequest = jest.fn()
const mockCreateAuthError = jest.fn(
  (msg: string, status: number) => NextResponse.json({ success: false, error: msg }, { status })
)
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: any[]) => mockAuthenticateRequest(...args),
  createAuthError: (...args: any[]) => mockCreateAuthError(...args),
}))

const mockMembershipGet = jest.fn()
jest.mock('@nextsparkjs/core/lib/services', () => ({
  MembershipService: { get: (...args: any[]) => mockMembershipGet(...args) },
}))

const mockQuery = jest.fn()
const mockQueryOne = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  queryOne: (...args: any[]) => mockQueryOne(...args),
}))

const mockExchangeMPAuthorizationCode = jest.fn()
jest.mock('@nextsparkjs/core/lib/marketplace', () => ({
  exchangeMPAuthorizationCode: (...args: any[]) => mockExchangeMPAuthorizationCode(...args),
}))

const mockEncryptTokens = jest.fn((tokens: any) => ({
  accessToken: 'enc_' + tokens.accessToken,
  refreshToken: 'enc_' + tokens.refreshToken,
  expiresAt: tokens.expiresAt,
  publicKey: tokens.publicKey,
}))
jest.mock('@nextsparkjs/core/lib/marketplace/token-encryption', () => ({
  encryptTokens: (...args: any[]) => mockEncryptTokens(...args),
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: any) => handler,
}))

import { GET } from '../../../../../../apps/dev/app/api/v1/marketplace/oauth/callback/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The oauth/callback route uses request.nextUrl.searchParams, which the mock
// NextRequest doesn't support. We build a minimal compatible request object.
function createOAuthRequest(params: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/v1/marketplace/oauth/callback')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  return {
    url: url.toString(),
    method: 'GET',
    headers: new Map(Object.entries(headers)),
    nextUrl: url,
  } as any
}

const fakeUser = { id: 'user-1', email: 'test@test.com', defaultTeamId: 'team-1' }
const appUrl = 'http://localhost:5173'

function authSuccess() {
  mockAuthenticateRequest.mockResolvedValue({ success: true, user: fakeUser })
}

function membershipAllowed() {
  mockMembershipGet.mockResolvedValue({
    canPerformAction: () => ({ allowed: true }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Patch NextResponse.redirect since the mock doesn't include it
const originalRedirect = (NextResponse as any).redirect
beforeAll(() => {
  ;(NextResponse as any).redirect = (url: string | URL) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    const resp = NextResponse.json({ _redirect: urlStr }, { status: 302 })
    ;(resp as any)._redirectUrl = urlStr
    return resp
  }
})

afterAll(() => {
  if (originalRedirect) {
    ;(NextResponse as any).redirect = originalRedirect
  } else {
    delete (NextResponse as any).redirect
  }
})

describe('GET /api/v1/marketplace/oauth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = appUrl
  })

  // --- Missing code ---
  test('redirects with error=no_code if no code param', async () => {
    const res = await GET(createOAuthRequest({ state: 'some-token' }))
    const url = (res as any)._redirectUrl || ''
    expect(url).toContain('error=no_code')
  })

  // --- Missing state ---
  test('redirects with error=no_state if no state param', async () => {
    const res = await GET(createOAuthRequest({ code: 'auth-code-123' }))
    const url = (res as any)._redirectUrl || ''
    expect(url).toContain('error=no_state')
  })

  // --- Auth failure ---
  test('returns 401 if not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false })
    const res = await GET(createOAuthRequest({ code: 'abc', state: 'tok-1' }))
    expect(res.status).toBe(401)
  })

  // --- Invalid state token (no matching account) ---
  test('redirects with error=invalid_state if state token not found in DB', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue(null)

    const res = await GET(createOAuthRequest({ code: 'abc', state: 'bad-token' }))
    const url = (res as any)._redirectUrl || ''
    expect(url).toContain('error=invalid_state')
  })

  // --- User not authorized for team ---
  test('redirects with error=unauthorized if user cannot perform action', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue({ id: 'acct-1', teamId: 'team-seller' })
    mockMembershipGet.mockResolvedValue({
      canPerformAction: () => ({ allowed: false, message: 'No access' }),
    })

    const res = await GET(createOAuthRequest({ code: 'abc', state: 'valid-token' }))
    const url = (res as any)._redirectUrl || ''
    expect(url).toContain('error=unauthorized')
  })

  test('redirects with error=unauthorized if membership check throws', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue({ id: 'acct-1', teamId: 'team-seller' })
    mockMembershipGet.mockRejectedValue(new Error('No membership'))

    const res = await GET(createOAuthRequest({ code: 'abc', state: 'valid-token' }))
    const url = (res as any)._redirectUrl || ''
    expect(url).toContain('error=unauthorized')
  })

  // --- Happy path ---
  test('exchanges code, encrypts tokens, updates DB, redirects to success', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue({ id: 'acct-1', teamId: 'team-seller' })
    membershipAllowed()

    mockExchangeMPAuthorizationCode.mockResolvedValue({
      accessToken: 'mp_access_token',
      refreshToken: 'mp_refresh_token',
      expiresIn: 21600,
      userId: 12345678,
      publicKey: 'APP_USR-pubkey',
    })

    mockEncryptTokens.mockReturnValue({
      accessToken: 'encrypted_access',
      refreshToken: 'encrypted_refresh',
      expiresAt: '2025-12-31T00:00:00Z',
      publicKey: 'APP_USR-pubkey',
    })

    mockQuery.mockResolvedValue(undefined)

    const res = await GET(createOAuthRequest({ code: 'real-code', state: 'valid-state' }))
    const url = (res as any)._redirectUrl || ''

    // Should redirect to success
    expect(url).toContain('onboarding=complete')

    // Should have called exchange
    expect(mockExchangeMPAuthorizationCode).toHaveBeenCalledWith(
      'real-code',
      expect.stringContaining('/api/v1/marketplace/oauth/callback')
    )

    // Should have encrypted tokens
    expect(mockEncryptTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'mp_access_token',
        refreshToken: 'mp_refresh_token',
      })
    )

    // Should have updated DB with account ID and tokens
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "connectedAccounts"'),
      expect.arrayContaining(['12345678', expect.any(String), 'acct-1'])
    )
  })

  // --- OAuth exchange failure ---
  test('redirects with error=oauth_failed if token exchange fails', async () => {
    authSuccess()
    mockQueryOne.mockResolvedValue({ id: 'acct-1', teamId: 'team-seller' })
    membershipAllowed()
    mockExchangeMPAuthorizationCode.mockRejectedValue(new Error('MP down'))

    const res = await GET(createOAuthRequest({ code: 'bad-code', state: 'valid-state' }))
    const url = (res as any)._redirectUrl || ''
    expect(url).toContain('error=oauth_failed')
  })
})
