/**
 * lib/auth.ts hands Better Auth the social provider map (#279): Google's
 * options as before, the other built-ins when listed and ready, and Apple's
 * origin as trusted for its form_post callback.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { generateKeyPairSync } from 'node:crypto'

const mockBetterAuth = jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} }))

jest.mock('better-auth', () => ({ betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])), APIError: class extends Error {} }))
jest.mock('better-auth/plugins', () => ({ emailOTP: jest.fn(() => ({ id: 'email-otp' })) }))
jest.mock('better-auth/next-js', () => ({ nextCookies: jest.fn(() => ({ id: 'next-cookies' })) }))
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))
jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn(), parseSSLConfig: jest.fn(() => false), stripSSLParams: jest.fn((url: string) => url) }))

const applePem = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const credentials: Record<string, string> = {
  GOOGLE_CLIENT_ID: '1234567890-social.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  GITHUB_CLIENT_ID: 'Ov23liAbCdEfGhIjKlMn',
  GITHUB_CLIENT_SECRET: 'github-secret-0123456789',
  APPLE_CLIENT_ID: 'com.example.web',
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_KEY_ID: 'KEY1234567',
  APPLE_PRIVATE_KEY: applePem,
}

function optionsWith(auth: Record<string, unknown>) {
  mockBetterAuth.mockClear()
  jest.isolateModules(() => {
    jest.doMock('@/core/lib/config/config-sync', () => {
      const actual = jest.requireActual<Record<string, any>>('@/core/lib/config/config-sync')
      return { ...actual, AUTH_CONFIG: { ...actual.AUTH_CONFIG, ...auth } }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  return (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
}

describe('lib/auth.ts social providers', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    Object.assign(process.env, credentials)
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    for (const key of Object.keys(credentials)) delete process.env[key]
    Object.assign(process.env, saved)
    jest.restoreAllMocks()
  })

  test('the core default still gives Better Auth Google alone, with its credentials and mapping', async () => {
    const options = optionsWith({})
    expect(Object.keys(options.socialProviders)).toEqual(['google'])
    expect(options.socialProviders.google).toMatchObject({ clientId: credentials.GOOGLE_CLIENT_ID, clientSecret: credentials.GOOGLE_CLIENT_SECRET })
    expect(await options.trustedOrigins()).not.toContain('https://appleid.apple.com')
  })

  test('GitHub and Apple join when listed and ready, and Apple\'s origin is trusted for its callback', async () => {
    const options = optionsWith({ methods: ['email-otp', 'google', 'github', 'apple'] })
    expect(Object.keys(options.socialProviders).sort()).toEqual(['apple', 'github', 'google'])
    expect(options.socialProviders.apple.clientSecret).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(await options.trustedOrigins()).toContain('https://appleid.apple.com')
  })

  test('without credentials a listed provider stays out of Better Auth', () => {
    delete process.env.GITHUB_CLIENT_SECRET
    const options = optionsWith({ methods: ['email-otp', 'github'] })
    expect(options.socialProviders).not.toHaveProperty('github')
  })
})
