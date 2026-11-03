/**
 * The auth route charges only the routes that need brute-force protection, per client address
 * and, for the ones that ask for or try a code or a password, per email too (#364).
 * The counters are a fake of checkDistributedRateLimit with the default numbers of the tiers
 * (auth 60, authIdentifier 5 per 15 minutes).
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { NextRequest } from 'next/server'

const LIMITS: Record<string, number> = { auth: 60, authIdentifier: 5 }
const counts = new Map<string, number>()
const mockPost = jest.fn(async (req: Request) => new Response(await req.text(), { status: 200 }))

jest.mock('@nextsparkjs/core/lib/auth', () => ({ auth: {} }))
jest.mock('better-auth/next-js', () => ({ toNextJsHandler: () => ({ GET: jest.fn(), POST: mockPost }) }))
jest.mock('@nextsparkjs/core/lib/config', () => ({
  AUTH_CONFIG: { registration: { mode: 'open' } },
  TEAMS_CONFIG: { mode: 'multi-tenant' },
}))
jest.mock('@nextsparkjs/core/lib/teams/helpers', () => ({ isPublicSignupRestricted: () => false }))
jest.mock('@nextsparkjs/core/lib/services', () => ({ TeamService: { isBootstrapDone: async () => false } }))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  handleCorsPreflightRequest: jest.fn(),
  addCorsHeaders: async (response: Response) => response,
  wrapAuthHandlerWithCors: async (handler: () => Promise<Response>) => handler(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  checkDistributedRateLimit: async (id: string, tier: string) => {
    const key = `${tier}:${id}`
    const n = (counts.get(key) ?? 0) + 1
    counts.set(key, n)
    return { allowed: n <= LIMITS[tier], limit: LIMITS[tier], remaining: Math.max(0, LIMITS[tier] - n), resetTime: Date.now() + 120_000 }
  },
}))
jest.mock('@nextsparkjs/core/lib/auth-context', () => ({ withSignupContext: (_v: unknown, fn: () => unknown) => fn() }))
jest.mock('@nextsparkjs/core/lib/auth/security-notifications', () => ({ dispatchSecurityNotificationsForRequest: async () => undefined }))
jest.mock('@nextsparkjs/core/lib/auth/verify-email-link', () => ({ verifyEmailPageUrl: () => null }))
jest.mock('@nextsparkjs/core/lib/base-path', () => ({ withBasePathRequest: (request: Request) => request }))
jest.mock('@nextsparkjs/core/lib/auth/runtime-readiness', () => ({ getAuthReadinessResponse: async () => null }))

import { POST } from '@/app/api/auth/[...all]/route'

// jest's NextRequest has no working clone(): give each clone its own copy of the body, as a real one has
function makeRequest(path: string, text: string, ip: string, type = 'application/json'): NextRequest {
  const req = new NextRequest(`https://example.com${path}`, {
    method: 'POST',
    headers: { 'content-type': type, 'x-forwarded-for': ip },
    body: text,
  }) as NextRequest & { clone: () => NextRequest }
  req.clone = () => makeRequest(path, text, ip, type)
  // this jest environment's request has no formData(); a real one parses the form the same way
  if (type.includes('urlencoded')) (req as unknown as { formData: () => Promise<URLSearchParams> }).formData = async () => new URLSearchParams(text)
  return req
}
const post = (path: string, body: unknown, ip = '203.0.113.7') => POST(makeRequest(path, JSON.stringify(body), ip))

beforeEach(() => {
  counts.clear()
  mockPost.mockClear()
})

describe('auth route rate limit (#364)', () => {
  test('sign-out does not consume the auth tier', async () => {
    for (let i = 0; i < 100; i++) expect((await post('/api/auth/sign-out', {})).status).toBe(200)
    expect(counts.size).toBe(0)
  })

  test('a route that is not listed is not charged', async () => {
    for (let i = 0; i < 100; i++) expect((await post('/api/auth/some-new-route', { email: 'a@x.com' })).status).toBe(200)
    expect(counts.size).toBe(0)
  })

  test('two emails behind one address can both sign in within the window', async () => {
    for (const email of ['ana@example.com', 'luis@example.com']) {
      expect((await post('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' })).status).toBe(200)
      expect((await post('/api/auth/sign-in/email-otp', { email, otp: '123456' })).status).toBe(200)
    }
  })

  test('repeated code verification for one email ends in 429, however the email is written', async () => {
    const variants = ['ana@example.com', ' Ana@Example.com ', 'ANA@EXAMPLE.COM', 'ana@example.com', 'Ana@example.com']
    for (const email of variants) expect((await post('/api/auth/sign-in/email-otp', { email, otp: '000000' })).status).toBe(200)
    const blocked = await post('/api/auth/sign-in/email-otp', { email: 'ana@example.com', otp: '111111' })
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect((await blocked.json()).code).toBe('RATE_LIMIT_EXCEEDED')
    // another email from the same address, and asking for a new code for the same email, are not blocked
    expect((await post('/api/auth/sign-in/email-otp', { email: 'luis@example.com', otp: '000000' })).status).toBe(200)
    expect((await post('/api/auth/email-otp/send-verification-otp', { email: 'ana@example.com', type: 'sign-in' })).status).toBe(200)
  })

  test('password sign-in is limited per email, and the address budget is shared by all emails', async () => {
    for (let i = 0; i < 5; i++) await post('/api/auth/sign-in/email', { email: 'ana@example.com', password: 'x' })
    expect((await post('/api/auth/sign-in/email', { email: 'ana@example.com', password: 'x' })).status).toBe(429)
    for (let i = 0; i < 60; i++) await post('/api/auth/sign-up/email', { email: `u${i}@example.com` })
    expect((await post('/api/auth/sign-up/email', { email: 'late@example.com' })).status).toBe(429)
    expect((await post('/api/auth/sign-up/email', { email: 'late@example.com' }, '198.51.100.9')).status).toBe(200)
  })

  test('the email is read from a clone: Better Auth still gets the body, and no key holds the email', async () => {
    const res = await post('/api/auth/sign-in/email', { email: 'Ana@Example.com', password: 'pw' })
    expect(JSON.parse(await res.text())).toEqual({ email: 'Ana@Example.com', password: 'pw' })
    expect([...counts.keys()].some((key) => /ana@|example\.com/i.test(key))).toBe(false)
  })

  test('a form-encoded sign-in is counted per email too', async () => {
    const form = (email: string) => POST(makeRequest('/api/auth/sign-in/email', `email=${encodeURIComponent(email)}&password=x`, '203.0.113.7', 'application/x-www-form-urlencoded'))
    for (let i = 0; i < 5; i++) expect((await form(i % 2 ? 'ANA@example.com' : 'ana@example.com')).status).toBe(200)
    expect((await form('ana@example.com')).status).toBe(429)
    expect((await form('luis@example.com')).status).toBe(200)
  })

  test('a body with no readable email shares one fixed budget instead of passing', async () => {
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/sign-in/email-otp', { otp: '1' })).status).toBe(200)
    expect((await post('/api/auth/sign-in/email-otp', { otp: '1' })).status).toBe(429)
    const garbage = () => POST(makeRequest('/api/auth/sign-in/email', '{not json', '198.51.100.5'))
    for (let i = 0; i < 5; i++) expect((await garbage()).status).toBe(200)
    expect((await garbage()).status).toBe(429)
  })

  test('resending the verification email is charged per email', async () => {
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/send-verification-email', { email: 'ana@example.com' })).status).toBe(200)
    expect((await post('/api/auth/send-verification-email', { email: 'ana@example.com' })).status).toBe(429)
  })
})
