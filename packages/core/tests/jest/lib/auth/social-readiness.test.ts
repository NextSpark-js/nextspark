/**
 * Readiness of the built-in social providers other than Google (#279): the
 * pure evaluator's diagnostics, the runtime check and the route gate on their
 * sign-in and callback.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { generateKeyPairSync } from 'node:crypto'
import { evaluateAuthReadiness, authReadinessConfigurationFromEnv } from '@/core/lib/auth/readiness'
import {
  getPublicAuthReadiness,
  isRuntimeGoogleAvailable,
  isRuntimeSocialProviderAvailable,
  withAuthRequestReadiness,
} from '@/core/lib/auth/runtime-readiness'

const github = { GITHUB_CLIENT_ID: 'Ov23liAbCdEfGhIjKlMn', GITHUB_CLIENT_SECRET: 'github-secret-0123456789' }
const microsoft = { MICROSOFT_CLIENT_ID: '00000000-1111-2222-3333-444444444444', MICROSOFT_CLIENT_SECRET: 'microsoft-secret' }
const apple = {
  APPLE_CLIENT_ID: 'com.example.web',
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_KEY_ID: 'KEY1234567',
  APPLE_PRIVATE_KEY: generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
}
// PEM-shaped, but no key inside
const ARMORED_GARBAGE = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----'
const google = { GOOGLE_CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'GOCSPX-production-secret' }
const production = { NODE_ENV: 'production' }
const all = { ...production, ...github, ...microsoft, ...apple, ...google }

const evaluate = (methods: string[], env: Record<string, string | undefined>, stage: 'build' | 'runtime' = 'runtime', providers?: Record<string, { enabled?: boolean }>) =>
  evaluateAuthReadiness({
    profile: 'web-local-auth',
    stage,
    environment: 'production',
    authConfig: { methods: methods as never, providers },
    configuration: authReadinessConfigurationFromEnv(env),
  })

describe('evaluateAuthReadiness: GitHub, Microsoft, Apple', () => {
  test('each is available with well-formed credentials, in the declared order', () => {
    const result = evaluate(['apple', 'github', 'microsoft', 'google'], all)
    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['apple', 'github', 'microsoft', 'google'])
    expect(result.diagnostics).toEqual([])
  })

  test('missing, placeholder and malformed credentials name the variable, never its value', () => {
    const result = evaluate(['github', 'microsoft', 'apple'], {
      ...production,
      GITHUB_CLIENT_SECRET: 'your-github-client-secret',
      MICROSOFT_CLIENT_ID: 'not-a-guid',
      MICROSOFT_CLIENT_SECRET: 'microsoft-secret',
      MICROSOFT_TENANT_ID: 'bad tenant',
      ...apple,
      APPLE_KEY_ID: 'short',
      APPLE_PRIVATE_KEY: 'not a pem',
    })
    expect(result.outcome).toBe('invalid')
    expect(result.diagnostics.map(({ method, code }) => `${method}:${code}`)).toEqual([
      'github:GITHUB_CLIENT_ID_MISSING',
      'github:GITHUB_CLIENT_SECRET_PLACEHOLDER',
      'microsoft:MICROSOFT_CLIENT_ID_MALFORMED',
      'microsoft:MICROSOFT_TENANT_ID_MALFORMED',
      'apple:APPLE_KEY_ID_MALFORMED',
      'apple:APPLE_PRIVATE_KEY_MALFORMED',
      'auth:AUTH_NO_AVAILABLE_METHOD',
    ])
    expect(JSON.stringify(result)).not.toContain('microsoft-secret')
    expect(JSON.stringify(result)).not.toContain('not a pem')
  })

  test('MICROSOFT_TENANT_ID is optional; Apple accepts a one-line key with \\n escapes', () => {
    expect(evaluate(['microsoft'], { ...production, ...microsoft }).availableMethods).toEqual(['microsoft'])
    expect(evaluate(['microsoft'], { ...production, ...microsoft, MICROSOFT_TENANT_ID: 'contoso.onmicrosoft.com' }).availableMethods).toEqual(['microsoft'])
    const oneLine = apple.APPLE_PRIVATE_KEY.replace(/\n/g, '\\n')
    expect(evaluate(['apple'], { ...production, ...apple, APPLE_PRIVATE_KEY: oneLine }).availableMethods).toEqual(['apple'])
  })

  test('a build may defer a runtime-only provider whose values are missing, never a malformed one', () => {
    const configuration = authReadinessConfigurationFromEnv(production)
    configuration.github!.runtimeOnly = true
    const deferred = evaluateAuthReadiness({ profile: 'web-local-auth', stage: 'build', environment: 'production', authConfig: { methods: ['github'] }, configuration })
    expect(deferred.outcome).toBe('deferred')
    expect(deferred.diagnostics.map(({ code }) => code)).toEqual(['GITHUB_RUNTIME_VALIDATION_REQUIRED'])

    const malformed = authReadinessConfigurationFromEnv({ ...production, MICROSOFT_CLIENT_ID: 'nope' })
    malformed.microsoft!.runtimeOnly = true
    expect(evaluateAuthReadiness({ profile: 'web-local-auth', stage: 'build', environment: 'production', authConfig: { methods: ['microsoft'] }, configuration: malformed }).outcome).toBe('invalid')
  })

  test('a provider switched off in auth.providers is intentional: no diagnostic, and all-disabled is reported as such', () => {
    const result = evaluate(['github'], all, 'runtime', { github: { enabled: false } })
    expect(result.availableMethods).toEqual([])
    expect(result.diagnostics.map(({ code }) => code)).toEqual(['AUTH_ALL_METHODS_DISABLED'])
  })
})

describe('Apple readiness checks the key the way the signer reads it', () => {
  const originalError = console.error
  beforeEach(() => { console.error = jest.fn() })
  afterEach(() => { console.error = originalError })
  const pem = (type: 'ec' | 'rsa', namedCurve?: string) =>
    (type === 'ec' ? generateKeyPairSync('ec', { namedCurve: namedCurve! }) : generateKeyPairSync('rsa', { modulusLength: 1024 })).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const handler = jest.fn(async () => new Response('better-auth', { status: 200 }))
  const options = (key: string) => ({ authConfig: { methods: ['apple' as const] }, env: { ...production, ...apple, APPLE_PRIVATE_KEY: key } })

  test('a P-256 key (also one-line with \\n escapes) is ready', () => {
    const key = pem('ec', 'P-256')
    expect(isRuntimeSocialProviderAvailable('apple', options(key))).toBe(true)
    expect(isRuntimeSocialProviderAvailable('apple', options(key.trim().replace(/\n/g, '\\n')))).toBe(true)
  })

  test.each([
    ['an RSA key', () => pem('rsa')],
    ['a P-384 key', () => pem('ec', 'P-384')],
    ['garbage inside valid armor', () => ARMORED_GARBAGE],
  ])('%s is not ready: no button, and the sign-in is refused with 503 before Better Auth', async (_name, key) => {
    const settings = options(key())
    expect(isRuntimeSocialProviderAvailable('apple', settings)).toBe(false)
    expect(getPublicAuthReadiness(settings).availableMethods).toEqual([])
    const blocked = await withAuthRequestReadiness(new Request('https://example.com/api/auth/sign-in/social', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'apple' }),
    }), handler, settings)
    expect(blocked.status).toBe(503)
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'APPLE_PRIVATE_KEY_MALFORMED' })]),
    }))
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('runtime readiness of the built-in social providers', () => {
  const originalError = console.error
  beforeEach(() => { console.error = jest.fn() })
  afterEach(() => { console.error = originalError })

  test('isRuntimeSocialProviderAvailable follows the switch and the credentials, not the button list; Google keeps its helper', () => {
    expect(isRuntimeSocialProviderAvailable('github', { authConfig: { methods: ['github'] }, env: all })).toBe(true)
    expect(isRuntimeSocialProviderAvailable('github', { authConfig: { methods: ['email-otp'] }, env: all })).toBe(true)
    expect(isRuntimeSocialProviderAvailable('github', { authConfig: { methods: ['github'], providers: { github: { enabled: false } } }, env: all })).toBe(false)
    expect(isRuntimeSocialProviderAvailable('apple', { authConfig: { methods: ['apple'] }, env: production })).toBe(false)
    expect(isRuntimeGoogleAvailable({ authConfig: { methods: ['google'] }, env: all })).toBe(true)
  })

  test('the public readiness lists only the ready ones, which is what the forms render', () => {
    const readiness = getPublicAuthReadiness({ authConfig: { methods: ['google', 'github', 'microsoft', 'apple'] }, env: { ...production, ...github, ...apple } })
    expect(readiness.availableMethods).toEqual(['github', 'apple'])
  })

  const handler = jest.fn(async () => new Response('better-auth', { status: 200 }))
  const social = (provider: string) => new Request('https://example.com/api/auth/sign-in/social', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider }),
  })

  test.each(['github', 'microsoft', 'apple'])('%s sign-in and callback are refused with 503 until the provider is ready', async (provider) => {
    for (const request of [social(provider), new Request(`https://example.com/api/auth/callback/${provider}?code=c&state=s`)]) {
      const blocked = await withAuthRequestReadiness(request, handler, { authConfig: { methods: [provider as never] }, env: production })
      expect(blocked.status).toBe(503)
      expect(await blocked.json()).toEqual({ error: 'Authentication method unavailable', code: 'AUTH_METHOD_UNAVAILABLE', method: provider })
    }
    expect(handler).not.toHaveBeenCalled()
    const passed = await withAuthRequestReadiness(new Request(`https://example.com/base/api/auth/callback/${provider}`, { method: 'POST' }), handler, { authConfig: { methods: [provider as never] }, env: all })
    expect(passed.status).toBe(200)
    handler.mockClear()
  })

  test('a switched-off provider answers with its policy code', async () => {
    const blocked = await withAuthRequestReadiness(social('github'), handler, { authConfig: { methods: ['github'], providers: { github: { enabled: false } } }, env: all })
    expect(blocked.status).toBe(503)
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      diagnostics: [expect.objectContaining({ code: 'GITHUB_POLICY_DISABLED' })],
    }))
  })

  test('another provider of the map is left to Better Auth', async () => {
    const passed = await withAuthRequestReadiness(social('discord'), handler, { authConfig: { methods: ['email-otp'] }, env: production })
    expect(passed.status).toBe(200)
    const callback = await withAuthRequestReadiness(new Request('https://example.com/api/auth/callback/discord?code=c'), handler, { authConfig: { methods: ['email-otp'] }, env: production })
    expect(callback.status).toBe(200)
  })
})
