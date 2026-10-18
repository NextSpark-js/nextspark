/**
 * The social provider map (#279): what auth.methods / auth.providers and the
 * environment turn into Better Auth's socialProviders, the profile mappings,
 * and Apple's client secret.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { generateKeyPairSync, verify } from 'node:crypto'
import {
  APPLE_CLIENT_SECRET_LIFETIME_SECONDS,
  createAppleClientSecret,
  credentialPrefix,
  resolveSocialProviders,
  socialProfileMapper,
  socialSignUpProvider,
} from '@/core/lib/auth/social-providers'
import type { AuthConfig } from '@/core/lib/config/types'

const defaults = { language: 'en', role: 'member' }
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const applePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const env = {
  GOOGLE_CLIENT_ID: '1234567890-social.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  GITHUB_CLIENT_ID: 'Ov23liAbCdEfGhIjKlMn',
  GITHUB_CLIENT_SECRET: 'github-secret-0123456789',
  MICROSOFT_CLIENT_ID: '00000000-1111-2222-3333-444444444444',
  MICROSOFT_CLIENT_SECRET: 'microsoft-secret',
  APPLE_CLIENT_ID: 'com.example.web',
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_KEY_ID: 'KEY1234567',
  APPLE_PRIVATE_KEY: applePem,
}

type Config = Pick<AuthConfig, 'methods' | 'providers'>
const resolve = (authConfig: Config, environment: Record<string, string | undefined> = env) =>
  resolveSocialProviders({ authConfig, defaults, env: environment })

function decode(jwt: string) {
  const [header, payload, signature] = jwt.split('.')
  const json = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString())
  const valid = verify('sha256', Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))
  return { header: json(header), payload: json(payload), valid }
}

beforeEach(() => {
  jest.restoreAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('resolveSocialProviders: built-in providers', () => {
  test('Google keeps its options: the env credentials and its mapping, nothing else', () => {
    const providers = resolve({ methods: ['email-otp', 'google'], providers: { google: { enabled: true } } })
    expect(Object.keys(providers)).toEqual(['google'])
    expect(Object.keys(providers.google).sort()).toEqual(['clientId', 'clientSecret', 'mapProfileToUser'])
    expect(providers.google).toMatchObject({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })
  })

  test('each built-in listed in methods with ready credentials is on', () => {
    const providers = resolve({ methods: ['apple', 'email-otp', 'github', 'microsoft', 'google'] })
    expect(Object.keys(providers).sort()).toEqual(['apple', 'github', 'google', 'microsoft'])
    expect(providers.github).toMatchObject({ clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET })
    for (const provider of Object.values(providers)) expect(typeof provider.mapProfileToUser).toBe('function')
  })

  test('a built-in listed only in providers works through the API, as Google always did without a button', () => {
    expect(Object.keys(resolve({ methods: ['email-otp'], providers: { github: {} } }))).toEqual(['github'])
    // The core default lists providers.google, so Google's credentials alone keep enabling it
    expect(Object.keys(resolve({ methods: ['email-otp'], providers: { google: { enabled: true } } }))).toEqual(['google'])
  })

  test('a built-in is off when it is not listed, is switched off, or its credentials are missing or malformed', () => {
    // Credentials alone do not turn on a provider nobody listed (a GITHUB_CLIENT_ID may belong to another integration)
    expect(resolve({ methods: ['email-otp'] })).toEqual({})
    expect(resolve({ methods: ['github'], providers: { github: { enabled: false } } })).toEqual({})
    expect(resolve({ methods: ['github'] }, { ...env, GITHUB_CLIENT_SECRET: undefined })).toEqual({})
    expect(resolve({ methods: ['microsoft'] }, { ...env, MICROSOFT_CLIENT_ID: 'not-a-guid' })).toEqual({})
    expect(resolve({ methods: ['apple'] }, { ...env, APPLE_TEAM_ID: 'your-team-id' })).toEqual({})
  })

  test('Microsoft signs in on the common tenant unless MICROSOFT_TENANT_ID names another', () => {
    expect(resolve({ methods: ['microsoft'] }).microsoft.tenantId).toBe('common')
    expect(resolve({ methods: ['microsoft'] }, { ...env, MICROSOFT_TENANT_ID: 'organizations' }).microsoft.tenantId).toBe('organizations')
  })

  test('options pass through to Better Auth but cannot replace the credentials', () => {
    const providers = resolve({ methods: ['github'], providers: { github: { options: { scope: ['repo'], clientId: 'from-config' } } } })
    expect(providers.github).toMatchObject({ scope: ['repo'], clientId: env.GITHUB_CLIENT_ID })
  })

  test("Apple gets a signed client secret, and the iOS bundle id when it is set", () => {
    const apple = resolve({ methods: ['apple'] }, { ...env, APPLE_APP_BUNDLE_IDENTIFIER: 'com.example.ios' }).apple
    expect(apple).toMatchObject({ clientId: 'com.example.web', appBundleIdentifier: 'com.example.ios' })
    const { header, payload, valid } = decode(apple.clientSecret as string)
    expect(valid).toBe(true)
    expect(header).toEqual({ alg: 'ES256', kid: 'KEY1234567' })
    expect(payload).toMatchObject({ iss: 'TEAM123456', sub: 'com.example.web', aud: 'https://appleid.apple.com' })
    expect(resolve({ methods: ['apple'] }).apple).not.toHaveProperty('appBundleIdentifier')
  })

  test("Apple's secret renews itself before it expires", () => {
    const start = Date.now()
    const now = jest.spyOn(Date, 'now').mockReturnValue(start)
    const apple = resolve({ methods: ['apple'] }).apple
    const first = apple.clientSecret as string
    now.mockReturnValue(start + 1000 * 60 * 60 * 24 * 10)
    expect(apple.clientSecret).toBe(first)
    now.mockReturnValue(start + (APPLE_CLIENT_SECRET_LIFETIME_SECONDS - 60 * 60) * 1000)
    const renewed = apple.clientSecret as string
    expect(renewed).not.toBe(first)
    expect(decode(renewed).payload.exp).toBe(Math.floor((start + (APPLE_CLIENT_SECRET_LIFETIME_SECONDS - 60 * 60) * 1000) / 1000) + APPLE_CLIENT_SECRET_LIFETIME_SECONDS)
  })

  test('a well-formed PEM that is not an EC key turns Apple off instead of breaking the auth instance', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(resolve({ methods: ['apple', 'github'] }, { ...env, APPLE_PRIVATE_KEY: rsa })).not.toHaveProperty('apple')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('APPLE_PRIVATE_KEY'))
  })
})

describe('resolveSocialProviders: the map\'s other providers', () => {
  const discord = { DISCORD_CLIENT_ID: 'discord-id', DISCORD_CLIENT_SECRET: 'discord-secret' }

  test('a provider Better Auth knows is on when listed with <ID>_CLIENT_ID and <ID>_CLIENT_SECRET', () => {
    const providers = resolve({ methods: ['email-otp'], providers: { discord: { options: { prompt: 'none' } } } }, discord)
    expect(Object.keys(providers)).toEqual(['discord'])
    expect(providers.discord).toMatchObject({ clientId: 'discord-id', clientSecret: 'discord-secret', prompt: 'none' })
    expect(typeof providers.discord.mapProfileToUser).toBe('function')
  })

  test('missing credentials or enabled: false leave it off', () => {
    expect(resolve({ providers: { discord: {} } }, { DISCORD_CLIENT_ID: 'discord-id' })).toEqual({})
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET'))
    expect(resolve({ providers: { discord: { enabled: false } } }, discord)).toEqual({})
  })

  test('an id Better Auth does not know is ignored with a warning (Better Auth would not start on it)', () => {
    expect(resolve({ providers: { myspace: {} } }, { MYSPACE_CLIENT_ID: 'x', MYSPACE_CLIENT_SECRET: 'y' })).toEqual({})
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('auth.providers.myspace'))
  })

  test('credential variables are named after the id', () => {
    expect(credentialPrefix('discord')).toBe('DISCORD')
    expect(credentialPrefix('microsoft-entra-id')).toBe('MICROSOFT_ENTRA_ID')
  })
})

describe('profile mappings', () => {
  test('Google maps exactly as before the provider map', () => {
    expect(socialProfileMapper('google', defaults)({
      email: 'ada@example.com', name: 'Ada King Lovelace', given_name: 'Ada', picture: 'https://p', email_verified: true,
    } as never)).toEqual({
      email: 'ada@example.com', name: 'Ada King Lovelace', firstName: 'Ada', lastName: 'King Lovelace',
      language: 'en', role: 'member', image: 'https://p', emailVerified: true,
    })
    expect((socialProfileMapper('google', defaults) as (p: object) => { emailVerified: boolean })({ email: 'a@b.c', name: 'A' }).emailVerified).toBe(false)
  })

  test('GitHub splits the name, falls back to the login, and leaves email and its verification to Better Auth', () => {
    const map = socialProfileMapper('github', defaults) as (p: object) => object
    expect(map({ login: 'octocat', name: 'The Octo Cat', email: 'o@example.com' })).toEqual({ firstName: 'The', lastName: 'Octo Cat', language: 'en', role: 'member' })
    expect(map({ login: 'octocat', name: null })).toEqual({ firstName: 'octocat', lastName: '', language: 'en', role: 'member' })
  })

  test('Microsoft prefers given_name / family_name', () => {
    const map = socialProfileMapper('microsoft', defaults) as (p: object) => object
    expect(map({ name: 'Grace B. Hopper', given_name: 'Grace', family_name: 'Hopper' })).toEqual({ firstName: 'Grace', lastName: 'Hopper', language: 'en', role: 'member' })
    expect(map({ name: 'Grace Hopper' })).toEqual({ firstName: 'Grace', lastName: 'Hopper', language: 'en', role: 'member' })
  })

  test('Apple splits the name it sends on the first consent, and maps an empty one to empty names', () => {
    const map = socialProfileMapper('apple', defaults) as (p: object) => object
    expect(map({ sub: '001', name: 'Tim Apple', email: 'x@privaterelay.appleid.com' })).toEqual({ firstName: 'Tim', lastName: 'Apple', language: 'en', role: 'member' })
    expect(map({ sub: '001', name: '' })).toEqual({ firstName: '', lastName: '', language: 'en', role: 'member' })
  })

  test('another provider of the map gets the default role and language', () => {
    expect((socialProfileMapper('discord', defaults) as (p: object) => object)({ username: 'x' })).toEqual({ firstName: '', lastName: '', language: 'en', role: 'member' })
  })

  test('no mapping but Google\'s sets email or emailVerified (Better Auth\'s verified flag decides linking)', () => {
    for (const provider of ['github', 'microsoft', 'apple', 'discord']) {
      const mapped = (socialProfileMapper(provider, defaults) as (p: object) => object)({ name: 'A B', email: 'a@b.c', email_verified: true })
      expect(mapped).not.toHaveProperty('email')
      expect(mapped).not.toHaveProperty('emailVerified')
    }
  })
})

describe('createAppleClientSecret', () => {
  const key = { teamId: 'TEAM123456', keyId: 'KEY1234567', clientId: 'com.example.web', privateKey: applePem }

  test('an ES256 JWT with the claims Apple checks, verifiable with the public key', () => {
    const now = Date.UTC(2026, 9, 17)
    const { header, payload, valid } = decode(createAppleClientSecret(key, now))
    expect(valid).toBe(true)
    expect(header).toEqual({ alg: 'ES256', kid: 'KEY1234567' })
    expect(payload).toEqual({
      iss: 'TEAM123456', iat: now / 1000, exp: now / 1000 + APPLE_CLIENT_SECRET_LIFETIME_SECONDS,
      aud: 'https://appleid.apple.com', sub: 'com.example.web',
    })
    // Apple refuses a secret valid for more than six months
    expect(APPLE_CLIENT_SECRET_LIFETIME_SECONDS).toBeLessThanOrEqual(15777000)
  })

  test('a one-line .env key with \\n escapes signs the same way', () => {
    const { valid } = decode(createAppleClientSecret({ ...key, privateKey: applePem.trim().replace(/\n/g, '\\n') }))
    expect(valid).toBe(true)
  })
})

describe('socialSignUpProvider', () => {
  test('names the provider of an OAuth callback or an id-token sign-in, and nothing else', () => {
    expect(socialSignUpProvider({ path: '/callback/:id', params: { id: 'github' } })).toBe('github')
    expect(socialSignUpProvider({ path: '/callback/apple' })).toBe('apple')
    expect(socialSignUpProvider({ path: '/sign-in/social', body: { provider: 'microsoft' } })).toBe('microsoft')
    expect(socialSignUpProvider({ path: '/callback/:id' })).toBeNull()
    expect(socialSignUpProvider({ path: '/sign-up/email' })).toBeNull()
    expect(socialSignUpProvider({ path: '/sign-in/email-otp' })).toBeNull()
    expect(socialSignUpProvider(null)).toBeNull()
  })
})
