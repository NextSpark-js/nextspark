/**
 * CORS headers on API responses and preflights (addCorsHeaders,
 * handleCorsPreflightRequest, wrapAuthHandlerWithCors): a listed origin is
 * echoed with credentials; any other origin gets no Access-Control-Allow-Origin
 * and no credentials. In development with allowAllOrigins, other origins are
 * echoed without credentials unless the cookie-write origin check trusts them.
 */
const mockConfig = {
  api: {
    cors: {
      allowedOrigins: { development: ['https://partner.example.com'], production: ['https://partner.example.com'] },
      additionalOrigins: {},
      allowAllOrigins: { development: false, production: false },
    },
  },
}
jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: mockConfig,
  getApplicationConfig: async () => mockConfig,
}))
// The next/server mock's headers are a Map, which has no append: give NextResponse fuller headers
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  class NextResponse extends actual.NextResponse {
    constructor(body?: unknown, init?: object) {
      super(body, init)
      const map = this.headers as Map<string, string>
      Object.assign(map, {
        get: (name: string) => Map.prototype.get.call(map, name.toLowerCase()) ?? null,
        set: (name: string, value: string) => Map.prototype.set.call(map, name.toLowerCase(), value),
        append: (name: string, value: string) => Map.prototype.set.call(map, name.toLowerCase(), value),
      })
    }
  }
  return { ...actual, NextResponse }
})
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))
jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn(), queryWithRLS: jest.fn(), mutateWithRLS: jest.fn() }))

import { addCorsHeaders, handleCorsPreflightRequest, wrapAuthHandlerWithCors } from '@/core/lib/api/helpers'
import type { NextRequest, NextResponse } from 'next/server'

const APP = 'https://app.example.com'
const LISTED = 'https://partner.example.com'
const UNLISTED = 'https://other.example'

/** A response whose headers record what addCorsHeaders writes (the jest mocks' Headers lack append). */
function fakeResponse() {
  const map = new Map<string, string>()
  const headers = {
    get: (name: string) => map.get(name.toLowerCase()) ?? null,
    set: (name: string, value: string) => void map.set(name.toLowerCase(), value),
    append: (name: string, value: string) => void map.set(name.toLowerCase(), map.has(name.toLowerCase()) ? `${map.get(name.toLowerCase())}, ${value}` : value),
    has: (name: string) => map.has(name.toLowerCase()),
  }
  return { headers } as unknown as NextResponse
}

function req(origin?: string) {
  return {
    url: 'https://app.example.com/api/v1/tasks',
    headers: { get: (name: string) => (name.toLowerCase() === 'origin' ? origin ?? null : null) },
  } as unknown as NextRequest
}

async function grant(origin?: string) {
  const res = await addCorsHeaders(fakeResponse(), req(origin))
  return { acao: res.headers.get('Access-Control-Allow-Origin'), acac: res.headers.get('Access-Control-Allow-Credentials') }
}

const env = process.env as Record<string, string | undefined>
const saved = { node: env.NODE_ENV, app: env.NEXT_PUBLIC_APP_URL }
beforeAll(() => {
  env.NEXT_PUBLIC_APP_URL = APP
})
afterAll(() => {
  env.NODE_ENV = saved.node
  env.NEXT_PUBLIC_APP_URL = saved.app
})
afterEach(() => {
  mockConfig.api.cors.allowAllOrigins.development = false
})

describe.each(['production', 'development'])('addCorsHeaders in %s', (nodeEnv) => {
  beforeEach(() => {
    env.NODE_ENV = nodeEnv
  })

  it('echoes a listed origin and the app origin, with credentials', async () => {
    expect(await grant(LISTED)).toEqual({ acao: LISTED, acac: 'true' })
    expect(await grant(APP)).toEqual({ acao: APP, acac: 'true' })
  })

  it('names no origin and sends no credentials for an unlisted origin', async () => {
    expect(await grant(UNLISTED)).toEqual({ acao: null, acac: null })
    expect(await grant('null')).toEqual({ acao: null, acac: null })
  })

  it('answers a preflight from an unlisted origin without a grant, and from a listed one with it', async () => {
    const refused = await handleCorsPreflightRequest(req(UNLISTED))
    expect(refused.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(refused.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    const allowed = await handleCorsPreflightRequest(req(LISTED))
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(LISTED)
    expect(allowed.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })
})

describe('addCorsHeaders with allowAllOrigins in development', () => {
  beforeEach(() => {
    env.NODE_ENV = 'development'
    mockConfig.api.cors.allowAllOrigins.development = true
  })

  it('echoes any origin, with credentials only for one the origin check trusts', async () => {
    expect(await grant(UNLISTED)).toEqual({ acao: UNLISTED, acac: null })
    expect(await grant(LISTED)).toEqual({ acao: LISTED, acac: 'true' })
    expect(await grant('http://192.168.1.20:3000')).toEqual({ acao: 'http://192.168.1.20:3000', acac: 'true' })
  })

  it('does not apply in production', async () => {
    env.NODE_ENV = 'production'
    expect(await grant(UNLISTED)).toEqual({ acao: null, acac: null })
  })
})

describe('wrapAuthHandlerWithCors', () => {
  const OriginalResponse = globalThis.Response
  beforeAll(() => {
    // A Response whose headers keep what is written to them
    globalThis.Response = class {
      status = 200
      statusText = 'OK'
      body = null
      headers = fakeResponse().headers
      constructor(_body?: unknown, init?: { status?: number }) {
        if (init?.status) this.status = init.status
      }
    } as unknown as typeof Response
    env.NODE_ENV = 'production'
  })
  afterAll(() => {
    globalThis.Response = OriginalResponse
  })

  it('grants a listed origin and not an unlisted one', async () => {
    const handler = async () => new Response(null)
    const listed = await wrapAuthHandlerWithCors(handler, req(LISTED))
    expect(listed.headers.get('Access-Control-Allow-Origin')).toBe(LISTED)
    expect(listed.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    const unlisted = await wrapAuthHandlerWithCors(handler, req(UNLISTED))
    expect(unlisted.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(unlisted.headers.get('Access-Control-Allow-Credentials')).toBeNull()
  })
})
