/**
 * /api/mcp: an API key over its per-key limit gets a JSON-RPC 429 with the limit's Retry-After, not the 401
 * that tells the client its key is invalid.
 */
const mockAuthenticate = jest.fn()
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => mockAuthenticate(...args),
  resolveTeamContext: jest.fn(),
}))
jest.mock('@/core/lib/api/auth', () => ({ validateApiKey: jest.fn() }))
jest.mock('@/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '@/app/api/mcp/route'
import { RATE_LIMIT_MESSAGE } from '@/core/lib/mcp'

const post = () => {
  const url = 'http://localhost/api/mcp'
  const req = new NextRequest(url, { method: 'POST', headers: { authorization: 'Bearer sk_test_x' }, body: '{}' })
  ;(req as unknown as { nextUrl: URL }).nextUrl = new URL(url)
  return req
}

it('answers a key over its limit with 429 and the limit message', async () => {
  mockAuthenticate.mockResolvedValue({
    success: false,
    type: 'api-key',
    user: { id: 'u1', email: '', role: 'member' },
    keyId: 'k1',
    error: { code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Rate limit exceeded' },
    rateLimitResponse: NextResponse.json({}, { status: 429, headers: { 'Retry-After': '42' } }),
  })
  const res = await POST(post())
  expect(res.status).toBe(429)
  expect((await res.json()).error).toEqual({ code: -32000, message: RATE_LIMIT_MESSAGE })
  expect(res.headers.get('Retry-After')).toBe('42')
})

it('keeps the 401 for a request without a usable key', async () => {
  mockAuthenticate.mockResolvedValue({ success: false, type: 'none', user: null })
  expect((await POST(post())).status).toBe(401)
})
