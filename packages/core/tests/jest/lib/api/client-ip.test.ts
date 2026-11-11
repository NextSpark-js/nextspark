/**
 * The client address helper (lib/api/client-ip):
 * - each NEXTSPARK_CLIENT_IP_SOURCE mode reads only its own header and ignores the others;
 * - with nothing set on Vercel (VERCEL=1) it reads Vercel's headers, and a set value still wins;
 * - with nothing set elsewhere it returns what rate-limit.ts returned before the setting existed, minus cf-connecting-ip;
 * - rate limits, API audit rows and entity audit rows all take the address from it;
 * - production logs one warning when nothing is set.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))

import { NextRequest, NextResponse } from 'next/server'
import { mutateWithRLS } from '@/core/lib/db'
import {
  getClientIp,
  getClientIpSource,
  getClientIpSourceOrigin,
  getBetterAuthIpHeaders,
  warnClientIpSourceAtStartup,
} from '@/core/lib/api/client-ip'
import { withRateLimitTier } from '@/core/lib/api/rate-limit'
import { logApiUsage } from '@/core/lib/api/helpers'
import { logGenericHandlerUsage } from '@/core/lib/api/entity/audit-log'
import { extractClientIp } from '@/core/lib/auth/security-notifications/device-fingerprint'

const mockedMutate = mutateWithRLS as unknown as jest.Mock

/** Every header a client can send that some mode reads. */
const ALL = {
  'cf-connecting-ip': '198.51.100.1',
  'x-forwarded-for': '198.51.100.2, 198.51.100.3, 198.51.100.4',
  'x-real-ip': '198.51.100.5',
  'true-client-ip': '198.51.100.6',
  'x-vercel-forwarded-for': '198.51.100.7',
  'x-client-address': '198.51.100.8',
}

const ip = (env: Record<string, string>, headers: Record<string, string>) => getClientIp(new Headers(headers), env)

describe('source modes', () => {
  it('vercel reads x-vercel-forwarded-for, then x-real-ip, and nothing else', () => {
    const env = { NEXTSPARK_CLIENT_IP_SOURCE: 'vercel' }
    expect(ip(env, ALL)).toBe('198.51.100.7')
    const { 'x-vercel-forwarded-for': _v, ...rest } = ALL
    expect(ip(env, rest)).toBe('198.51.100.5')
    expect(ip(env, { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2', 'true-client-ip': '3.3.3.3' })).toBe('unknown')
  })

  it('cloudflare reads cf-connecting-ip only', () => {
    const env = { NEXTSPARK_CLIENT_IP_SOURCE: 'cloudflare' }
    expect(ip(env, ALL)).toBe('198.51.100.1')
    const { 'cf-connecting-ip': _c, ...rest } = ALL
    expect(ip(env, rest)).toBe('unknown')
  })

  it('header:<name> reads that header only, case-insensitively', () => {
    const env = { NEXTSPARK_CLIENT_IP_SOURCE: 'header:X-Client-Address' }
    expect(ip(env, ALL)).toBe('198.51.100.8')
    const { 'x-client-address': _h, ...rest } = ALL
    expect(ip(env, rest)).toBe('unknown')
    // A list in the header: the entry the proxy wrote is the last one
    expect(ip(env, { 'x-client-address': '203.0.113.9, 198.51.100.8' })).toBe('198.51.100.8')
  })

  it('xff counts trusted hops from the right and ignores what the client prepends', () => {
    const one = { NEXTSPARK_CLIENT_IP_SOURCE: 'xff' } // hops default to 1
    expect(ip(one, ALL)).toBe('198.51.100.4')
    expect(ip(one, { 'x-forwarded-for': 'client-supplied-1, client-supplied-2, 198.51.100.4' })).toBe('198.51.100.4')
    const two = { NEXTSPARK_CLIENT_IP_SOURCE: 'xff', NEXTSPARK_TRUSTED_PROXY_HOPS: '2' }
    expect(ip(two, ALL)).toBe('198.51.100.3')
    expect(ip(two, { 'x-forwarded-for': 'client-supplied, 198.51.100.3, 10.0.0.1' })).toBe('198.51.100.3')
    // Fewer entries than hops: the request did not pass through every trusted proxy, so no entry counts
    expect(ip(two, { 'x-forwarded-for': '198.51.100.4' })).toBe('unknown')
    // Other headers never count
    const { 'x-forwarded-for': _x, ...rest } = ALL
    expect(ip(one, rest)).toBe('unknown')
  })

  it('none puts every request in one bucket', () => {
    const env = { NEXTSPARK_CLIENT_IP_SOURCE: 'none' }
    expect(ip(env, ALL)).toBe('unknown')
    expect(ip(env, { 'x-forwarded-for': '203.0.113.1' })).toBe('unknown')
  })

  it('refuses values it does not understand', () => {
    for (const bad of ['vercell', 'header:', 'header:bad header', 'x-forwarded-for']) {
      expect(() => getClientIpSource({ NEXTSPARK_CLIENT_IP_SOURCE: bad })).toThrow(/NEXTSPARK_CLIENT_IP_SOURCE/)
    }
    for (const hops of ['0', '-1', '1.5', 'two']) {
      expect(() => getClientIpSource({ NEXTSPARK_CLIENT_IP_SOURCE: 'xff', NEXTSPARK_TRUSTED_PROXY_HOPS: hops })).toThrow(/HOPS/)
    }
  })

  it('names the same header to Better Auth for the single-header modes, none for none, and keeps its default otherwise', () => {
    expect(getBetterAuthIpHeaders({ NEXTSPARK_CLIENT_IP_SOURCE: 'vercel' })).toEqual(['x-vercel-forwarded-for', 'x-real-ip'])
    expect(getBetterAuthIpHeaders({ NEXTSPARK_CLIENT_IP_SOURCE: 'cloudflare' })).toEqual(['cf-connecting-ip'])
    expect(getBetterAuthIpHeaders({ NEXTSPARK_CLIENT_IP_SOURCE: 'header:x-real-ip' })).toEqual(['x-real-ip'])
    // An empty list: Better Auth resolves no address and counts every request to a path together
    expect(getBetterAuthIpHeaders({ NEXTSPARK_CLIENT_IP_SOURCE: 'none' })).toEqual([])
    for (const source of [undefined, 'xff', 'nonsense']) {
      expect(getBetterAuthIpHeaders({ NEXTSPARK_CLIENT_IP_SOURCE: source })).toBeUndefined()
    }
  })
})

describe('nothing set on Vercel (VERCEL=1)', () => {
  const vercel = { VERCEL: '1' }

  it('keys a request with a cf-connecting-ip by x-vercel-forwarded-for, then x-real-ip', () => {
    expect(ip(vercel, ALL)).toBe('198.51.100.7')
    for (const forged of ['203.0.113.1', '203.0.113.2']) {
      expect(ip(vercel, { 'cf-connecting-ip': forged, 'x-vercel-forwarded-for': '198.51.100.7' })).toBe('198.51.100.7')
      expect(ip(vercel, { 'cf-connecting-ip': forged, 'x-real-ip': '198.51.100.5' })).toBe('198.51.100.5')
      expect(ip(vercel, { 'cf-connecting-ip': forged, 'x-forwarded-for': forged })).toBe('unknown')
    }
    expect(getClientIpSource(vercel)).toEqual({ kind: 'vercel' })
    expect(getClientIpSourceOrigin(vercel)).toBe('vercel')
    expect(getBetterAuthIpHeaders(vercel)).toEqual(['x-vercel-forwarded-for', 'x-real-ip'])
  })

  it('only VERCEL=1 counts as Vercel', () => {
    for (const VERCEL of ['', '0', 'true']) {
      expect(getClientIpSourceOrigin({ VERCEL })).toBe('default')
      expect(getClientIpSource({ VERCEL })).toEqual({ kind: 'default' })
    }
  })

  it('an explicit NEXTSPARK_CLIENT_IP_SOURCE still takes precedence', () => {
    expect(ip({ ...vercel, NEXTSPARK_CLIENT_IP_SOURCE: 'cloudflare' }, ALL)).toBe('198.51.100.1')
    expect(ip({ ...vercel, NEXTSPARK_CLIENT_IP_SOURCE: 'xff' }, ALL)).toBe('198.51.100.4')
    expect(ip({ ...vercel, NEXTSPARK_CLIENT_IP_SOURCE: 'none' }, ALL)).toBe('unknown')
    expect(getClientIpSourceOrigin({ ...vercel, NEXTSPARK_CLIENT_IP_SOURCE: 'vercel' })).toBe('variable')
    expect(getBetterAuthIpHeaders({ ...vercel, NEXTSPARK_CLIENT_IP_SOURCE: 'cloudflare' })).toEqual(['cf-connecting-ip'])
    expect(getBetterAuthIpHeaders({ ...vercel, NEXTSPARK_CLIENT_IP_SOURCE: 'xff' })).toBeUndefined()
    expect(() => getClientIpSource({ ...vercel, NEXTSPARK_CLIENT_IP_SOURCE: 'vercell' })).toThrow(/NEXTSPARK_CLIENT_IP_SOURCE/)
  })
})

describe('default (nothing set)', () => {
  /** rate-limit.ts getClientIp as it was before the setting (main 3b03e481), verbatim apart from the signature. */
  function previousGetClientIp(request: { headers: Headers }): string {
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp;
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(Boolean);
      if (ips.length > 0) return ips[ips.length - 1];
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;
    const trueClientIp = request.headers.get('true-client-ip');
    if (trueClientIp) return trueClientIp;
    return 'unknown';
  }

  const names = ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip', 'true-client-ip', 'x-vercel-forwarded-for'] as const
  const values: Record<string, string[]> = {
    'cf-connecting-ip': ['198.51.100.1'],
    'x-forwarded-for': ['198.51.100.2', '198.51.100.2, 198.51.100.3', ' , ', '198.51.100.3 ,'],
    'x-real-ip': ['198.51.100.5'],
    'true-client-ip': ['198.51.100.6'],
    'x-vercel-forwarded-for': ['198.51.100.7'],
  }

  it('ignores cf-connecting-ip, and reads it only with cloudflare set', () => {
    const headers = { 'cf-connecting-ip': '198.51.100.1', 'x-real-ip': '198.51.100.5' }
    expect(ip({}, headers)).toBe('198.51.100.5')
    expect(ip({}, { 'cf-connecting-ip': '198.51.100.1' })).toBe('unknown')
    expect(ip({ NEXTSPARK_CLIENT_IP_SOURCE: 'cloudflare' }, headers)).toBe('198.51.100.1')
    expect(getClientIpSourceOrigin({})).toBe('default')
  })

  it('returns what the previous rate-limit function returned without cf-connecting-ip, for every combination of headers', () => {
    let cases = 0
    for (let mask = 0; mask < 1 << names.length; mask++) {
      let combos: Record<string, string>[] = [{}]
      names.forEach((name, i) => {
        if (mask & (1 << i)) combos = combos.flatMap(c => values[name].map(v => ({ ...c, [name]: v })))
      })
      for (const headers of combos) {
        const h = new Headers(headers)
        const { 'cf-connecting-ip': _cf, ...withoutCf } = headers
        expect(getClientIp(h, {})).toBe(previousGetClientIp({ headers: new Headers(withoutCf) }))
        cases++
      }
    }
    expect(cases).toBeGreaterThan(50)
  })

})

describe('call sites', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    delete process.env.DISABLE_RATE_LIMITING
    process.env.NEXTSPARK_CLIENT_IP_SOURCE = 'header:x-client-address'
    mockedMutate.mockReset()
    mockedMutate.mockImplementation(async () => ({ rows: [], rowCount: 1 }))
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  it('security notifications fingerprint the configured address', () => {
    expect(extractClientIp(new Headers(ALL))).toBe('198.51.100.8')
  })

  const request = (address: string, method = 'GET') =>
    new NextRequest('https://app.example.com/api/v1/things', {
      method,
      headers: { ...ALL, 'x-client-address': address, 'x-forwarded-for': `${address}-client-supplied`, 'user-agent': 'jest' },
    })

  it('rate limits count per configured address', async () => {
    const route = withRateLimitTier(async () => NextResponse.json({ ok: true }), 'authIdentifier')
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = request('203.0.113.10')
      r.headers.set('x-forwarded-for', `203.0.113.${100 + i}`) // varying a header the setting does not name
      statuses.push((await route(r)).status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    expect((await route(request('203.0.113.11'))).status).toBe(200)
  })

  it('on Vercel with nothing set, requests that vary cf-connecting-ip share one rate limit bucket', async () => {
    delete process.env.NEXTSPARK_CLIENT_IP_SOURCE
    process.env.VERCEL = '1'
    const route = withRateLimitTier(async () => NextResponse.json({ ok: true }), 'authIdentifier')
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = new NextRequest('https://app.example.com/api/v1/things', {
        headers: { 'cf-connecting-ip': `203.0.113.${200 + i}`, 'x-vercel-forwarded-for': '198.51.100.70', 'user-agent': 'jest' },
      })
      statuses.push((await route(r)).status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    const other = new NextRequest('https://app.example.com/api/v1/things', {
      headers: { 'cf-connecting-ip': '203.0.113.200', 'x-vercel-forwarded-for': '198.51.100.72', 'user-agent': 'jest' },
    })
    expect((await route(other)).status).toBe(200)
  })

  it('off Vercel with nothing set, requests that vary cf-connecting-ip share one rate limit bucket', async () => {
    delete process.env.NEXTSPARK_CLIENT_IP_SOURCE
    delete process.env.VERCEL
    const route = withRateLimitTier(async () => NextResponse.json({ ok: true }), 'authIdentifier')
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = new NextRequest('https://app.example.com/api/v1/things', {
        headers: { 'cf-connecting-ip': `203.0.113.${210 + i}`, 'x-forwarded-for': '198.51.100.71', 'user-agent': 'jest' },
      })
      statuses.push((await route(r)).status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    const other = new NextRequest('https://app.example.com/api/v1/things', {
      headers: { 'cf-connecting-ip': '203.0.113.210', 'x-forwarded-for': '198.51.100.73', 'user-agent': 'jest' },
    })
    expect((await route(other)).status).toBe(200)
  })

  it('API audit rows record the configured address', async () => {
    await logApiUsage({ userId: 'u1', keyId: 'k1', scopes: [] }, request('203.0.113.20'), 200)
    expect(mockedMutate.mock.calls[0][1]).toContain('203.0.113.20')
  })

  it('entity audit rows record the configured address', async () => {
    const auth = { success: true, type: 'session', user: { id: 'u1' } } as never
    await logGenericHandlerUsage(auth, request('203.0.113.30'), 200)
    expect(mockedMutate.mock.calls[0][1]).toContain('203.0.113.30')
  })

  describe('with an invalid setting', () => {
    let error: jest.SpiedFunction<typeof console.error>
    beforeEach(() => {
      process.env.NEXTSPARK_CLIENT_IP_SOURCE = 'not-a-source'
      error = jest.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => error.mockRestore())

    it('rate limits refuse the request', async () => {
      const route = withRateLimitTier(async () => NextResponse.json({ ok: true }), 'auth')
      await expect(Promise.resolve().then(() => route(request('203.0.113.40')))).rejects.toThrow(/NEXTSPARK_CLIENT_IP_SOURCE/)
    })

    it('audit rows are still written, with an unknown address', async () => {
      await logApiUsage({ userId: 'u1', keyId: 'k1', scopes: [] }, request('203.0.113.41'), 200)
      const auth = { success: true, type: 'session', user: { id: 'u1' } } as never
      await logGenericHandlerUsage(auth, request('203.0.113.42'), 200)
      expect(mockedMutate).toHaveBeenCalledTimes(2)
      for (const [, params] of mockedMutate.mock.calls) expect(params).toContain('unknown')
    })

    it('the new-device fingerprint uses an unknown address', () => {
      expect(extractClientIp(new Headers(ALL))).toBe('unknown')
    })
  })
})

describe('startup warning', () => {
  const WARNED = Symbol.for('nextspark.clientIpSourceWarned')
  let warn: jest.SpiedFunction<typeof console.warn>
  let error: jest.SpiedFunction<typeof console.error>
  let info: jest.SpiedFunction<typeof console.info>
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[WARNED]
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
    info = jest.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
    error.mockRestore()
    info.mockRestore()
    delete (globalThis as Record<symbol, unknown>)[WARNED]
  })

  it('warns once in production when nothing is set, however many times it runs', () => {
    const env = { NODE_ENV: 'production' }
    warnClientIpSourceAtStartup(env)
    warnClientIpSourceAtStartup(env)
    getClientIp(new Headers(ALL), env)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('NEXTSPARK_CLIENT_IP_SOURCE')
    expect(String(warn.mock.calls[0][0])).toContain('NEXTSPARK_CLIENT_IP_SOURCE=cloudflare')
  })

  it('says once that it detected Vercel, in every environment, and not when the variable is set', () => {
    for (const NODE_ENV of ['production', 'development']) {
      delete (globalThis as Record<symbol, unknown>)[WARNED]
      info.mockClear()
      const env = { NODE_ENV, VERCEL: '1' }
      warnClientIpSourceAtStartup(env)
      getClientIp(new Headers(ALL), env)
      expect(info).toHaveBeenCalledTimes(1)
      expect(String(info.mock.calls[0][0])).toContain('x-vercel-forwarded-for')
    }
    delete (globalThis as Record<symbol, unknown>)[WARNED]
    info.mockClear()
    warnClientIpSourceAtStartup({ NODE_ENV: 'production', VERCEL: '1', NEXTSPARK_CLIENT_IP_SOURCE: 'cloudflare' })
    expect(info).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays quiet outside production and when a source is set', () => {
    warnClientIpSourceAtStartup({ NODE_ENV: 'development' })
    warnClientIpSourceAtStartup({ NODE_ENV: 'test' })
    warnClientIpSourceAtStartup({ NODE_ENV: 'production', NEXTSPARK_CLIENT_IP_SOURCE: 'cloudflare' })
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('reports an invalid setting as an error once, in every environment', () => {
    for (const NODE_ENV of ['production', 'development', 'test']) {
      delete (globalThis as Record<symbol, unknown>)[WARNED]
      error.mockClear()
      const env = { NODE_ENV, NEXTSPARK_CLIENT_IP_SOURCE: 'vercell' }
      warnClientIpSourceAtStartup(env)
      warnClientIpSourceAtStartup(env)
      expect(error).toHaveBeenCalledTimes(1)
    }
    expect(warn).not.toHaveBeenCalled()
  })
})
