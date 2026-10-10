/**
 * The default rate limit the generated host puts around a project's and a plugin's API route methods (#226,
 * routes/_internal/route-rate-limit): read 200/min and write 50/min per client address, in the same buckets as
 * withRateLimitTier, with no CORS or origin check of its own, and off with DISABLE_RATE_LIMITING=true.
 */
import { describe, it, expect, jest, afterEach, afterAll } from '@jest/globals'

jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn(), queryWithRLS: jest.fn(), mutateWithRLS: jest.fn() }))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))

import { NextRequest } from 'next/server'
import { withReadRateLimit, withWriteRateLimit } from '@/core/routes/_internal/route-rate-limit'
import { withRateLimitTier } from '@/core/lib/api/rate-limit'

const saved = process.env.DISABLE_RATE_LIMITING
delete process.env.DISABLE_RATE_LIMITING
afterEach(() => {
  delete process.env.DISABLE_RATE_LIMITING
})
afterAll(() => {
  if (saved !== undefined) process.env.DISABLE_RATE_LIMITING = saved
})

const request = (address: string, method = 'GET', headers: Record<string, string> = {}) =>
  new NextRequest('https://app.example.com/api/intake', { method, headers: { 'x-forwarded-for': address, ...headers } })

async function statuses(handler: (request: NextRequest) => Promise<Response>, address: string, count: number, method = 'GET') {
  const found: number[] = []
  for (let i = 0; i < count; i++) found.push((await handler(request(address, method))).status)
  return found
}

const ok = async () => Response.json({ ok: true })

describe('withReadRateLimit / withWriteRateLimit', () => {
  it('read: 200 requests a minute per address, then 429 with Retry-After', async () => {
    const GET = withReadRateLimit(ok)
    const found = await statuses(GET, '203.0.113.1', 201)
    expect(found.slice(0, 200).every(status => status === 200)).toBe(true)
    expect(found[200]).toBe(429)
    const limited = await GET(request('203.0.113.1'))
    expect(limited.headers.get('Retry-After')).toBeTruthy()
    // another address has its own bucket
    expect((await GET(request('203.0.113.2'))).status).toBe(200)
  })

  it('write: 50 requests a minute per address, then 429', async () => {
    const POST = withWriteRateLimit(ok)
    const found = await statuses(POST, '203.0.113.3', 51, 'POST')
    expect(found.slice(0, 50).every(status => status === 200)).toBe(true)
    expect(found[50]).toBe(429)
  })

  it('shares the tier bucket with withRateLimitTier, as the 0.x dispatchers did', async () => {
    const GET = withReadRateLimit(ok)
    const core = withRateLimitTier(async () => Response.json({ ok: true }) as never, 'read')
    await statuses(GET, '203.0.113.4', 199)
    expect((await core(request('203.0.113.4'))).status).toBe(200)
    expect((await GET(request('203.0.113.4'))).status).toBe(429)
  })

  it('sets the X-RateLimit headers and adds no CORS or origin check of its own', async () => {
    const handler = jest.fn(ok)
    const POST = withWriteRateLimit(handler)
    const response = await POST(request('203.0.113.5', 'POST', { origin: 'https://evil.example', cookie: 'better-auth.session_token=x' }))
    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('50')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('49')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('keeps the handler signature: a method with no parameters, and the route context passed through', async () => {
    const bare = withReadRateLimit(async () => Response.json({ bare: true }))
    expect((await (bare as unknown as (request: NextRequest) => Promise<Response>)(request('203.0.113.6'))).status).toBe(200)
    const withContext = withReadRateLimit(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => Response.json(await context.params))
    const response = await withContext(request('203.0.113.6'), { params: Promise.resolve({ id: '7' }) })
    expect(await response.json()).toEqual({ id: '7' })
  })

  it('a response with immutable headers (Response.redirect) is returned as is', async () => {
    const redirect = () => {
      const response = new Response(null, { status: 302, headers: { location: 'https://app.example.com/next' } })
      Object.defineProperty(response.headers, 'set', { value: () => { throw new TypeError('immutable') } })
      return response
    }
    const GET = withReadRateLimit(async () => redirect())
    const response = await GET(request('203.0.113.7'))
    expect(response.status).toBe(302)
    expect(response.headers.get('X-RateLimit-Limit')).toBeNull()
  })

  it('DISABLE_RATE_LIMITING=true turns it off', async () => {
    process.env.DISABLE_RATE_LIMITING = 'true'
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const found = await statuses(withWriteRateLimit(ok), '203.0.113.8', 60, 'POST')
      expect(found.every(status => status === 200)).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })
})
