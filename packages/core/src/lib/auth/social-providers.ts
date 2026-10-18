/**
 * The social provider map: what `auth.providers` and `auth.methods` turn into
 * Better Auth's `socialProviders` option.
 *
 * - Built-in providers (google, github, microsoft, apple) are on when listed in
 *   `auth.methods` (with a button) or in `auth.providers` (through the API
 *   only), not switched off there, and their runtime readiness passes. Each
 *   gets its profile mapping. The core default lists `providers.google`, so
 *   Google's credentials alone turn it on, as they always have.
 * - Any other key of `auth.providers` that Better Auth knows is on when both
 *   `<ID>_CLIENT_ID` and `<ID>_CLIENT_SECRET` are set. It works through the API
 *   only: the login form has no button for it.
 * - An id Better Auth does not know is dropped with a warning (Better Auth
 *   itself would fail to start on it).
 *
 * Credentials always come from the environment: app.config.ts is bundled for
 * the browser.
 */

import 'server-only'

import { createPrivateKey, sign } from 'node:crypto'
import { socialProviderList } from 'better-auth/social-providers'
import type { AuthConfig, SocialLoginMethod } from '../config/types'
import { SOCIAL_LOGIN_METHODS, isSocialLoginMethod, resolveAuthMethods } from './auth-methods'
import { isRuntimeSocialProviderAvailable } from './runtime-readiness'

type Env = Record<string, string | undefined>
type Profile = Record<string, unknown>

export interface SocialProfileDefaults {
  language: string
  role: string
}

/** First word and the rest, the split Google's mapping has always used. */
function nameParts(given: unknown, family: unknown, full: unknown): { firstName: string; lastName: string } {
  const name = typeof full === 'string' ? full : ''
  return {
    firstName: (typeof given === 'string' && given) || name.split(' ')[0] || '',
    lastName: (typeof family === 'string' && family) || name.split(' ').slice(1).join(' ') || '',
  }
}

interface GoogleProfile {
  email: string
  name: string
  given_name?: string
  family_name?: string
  picture?: string
  email_verified?: boolean
}

/**
 * Better Auth spreads the mapping over the user it built from the provider's
 * answer, so only Google's (unchanged since before the map) sets email and
 * emailVerified. The others leave Better Auth's verified flag alone: it is
 * what decides account linking.
 */
export function socialProfileMapper(provider: string, defaults: SocialProfileDefaults) {
  switch (provider) {
    case 'google':
      return (profile: GoogleProfile) => {
        // Google provides given_name and family_name separately
        const firstName = profile.given_name || profile.name.split(' ')[0] || ''
        const lastName = profile.family_name || profile.name.split(' ').slice(1).join(' ') || ''
        return {
          email: profile.email,
          name: profile.name, // Better Auth expects 'name' field
          firstName,
          lastName,
          language: defaults.language,
          role: defaults.role,
          image: profile.picture,
          emailVerified: profile.email_verified || false,
        }
      }
    case 'github':
      // `name` is optional on GitHub; Better Auth falls back to the login, and so do we
      return (profile: Profile) => ({ ...nameParts(undefined, undefined, profile.name || profile.login), ...defaults })
    default:
      // Microsoft and Apple (whose name Better Auth fills from the first consent only), and the map's other providers
      return (profile: Profile) => ({ ...nameParts(profile.given_name, profile.family_name, profile.name), ...defaults })
  }
}

/** Apple accepts a client secret valid for at most six months. */
export const APPLE_CLIENT_SECRET_LIFETIME_SECONDS = 180 * 24 * 60 * 60

export interface AppleSigningKey {
  teamId: string
  keyId: string
  /** The Services ID the web flow signs in with. */
  clientId: string
  /** The .p8 file's PEM; `\n` escapes (one-line .env values) are accepted. */
  privateKey: string
}

/**
 * The client secret Apple requires: an ES256 JWT signed with the .p8 key.
 * https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
 */
export function createAppleClientSecret(key: AppleSigningKey, now = Date.now(), lifetimeSeconds = APPLE_CLIENT_SECRET_LIFETIME_SECONDS): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const iat = Math.floor(now / 1000)
  const input = `${part({ alg: 'ES256', kid: key.keyId })}.${part({
    iss: key.teamId,
    iat,
    exp: iat + lifetimeSeconds,
    aud: 'https://appleid.apple.com',
    sub: key.clientId,
  })}`
  const privateKey = createPrivateKey(key.privateKey.replace(/\\n/g, '\n'))
  // Any other key would sign too, and Apple would refuse the secret at the first sign-in
  if (privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('APPLE_PRIVATE_KEY is not a P-256 EC key')
  const signature = sign('sha256', Buffer.from(input), {
    key: privateKey,
    // JWS wants r||s, not DER
    dsaEncoding: 'ieee-p1363',
  })
  return `${input}.${signature.toString('base64url')}`
}

/** A secret that renews itself a day before it expires, for servers that run longer than its lifetime. */
function renewingAppleSecret(key: AppleSigningKey): () => string {
  let secret = createAppleClientSecret(key)
  let renewAt = Date.now() + (APPLE_CLIENT_SECRET_LIFETIME_SECONDS - 24 * 60 * 60) * 1000
  return () => {
    if (Date.now() >= renewAt) {
      secret = createAppleClientSecret(key)
      renewAt = Date.now() + (APPLE_CLIENT_SECRET_LIFETIME_SECONDS - 24 * 60 * 60) * 1000
    }
    return secret
  }
}

/** `discord` → `DISCORD`, `microsoft-entra-id` → `MICROSOFT_ENTRA_ID`. */
export function credentialPrefix(providerId: string): string {
  return providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

function builtInCredentials(provider: SocialLoginMethod, env: Env): Record<string, unknown> {
  switch (provider) {
    case 'microsoft':
      return { clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET, tenantId: env.MICROSOFT_TENANT_ID || 'common' }
    case 'apple': {
      const secret = renewingAppleSecret({
        teamId: env.APPLE_TEAM_ID!,
        keyId: env.APPLE_KEY_ID!,
        clientId: env.APPLE_CLIENT_ID!,
        privateKey: env.APPLE_PRIVATE_KEY!,
      })
      return {
        clientId: env.APPLE_CLIENT_ID,
        // Better Auth reads it on every authorization and token request
        get clientSecret() { return secret() },
        // The iOS app's bundle id, for id tokens from native Sign in with Apple
        ...(env.APPLE_APP_BUNDLE_IDENTIFIER ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER } : {}),
      }
    }
    default: {
      const prefix = credentialPrefix(provider)
      return { clientId: env[`${prefix}_CLIENT_ID`], clientSecret: env[`${prefix}_CLIENT_SECRET`] }
    }
  }
}

export interface ResolveSocialProvidersOptions {
  authConfig: Pick<AuthConfig, 'methods' | 'providers' | 'emailAndPassword'> | null | undefined
  defaults: SocialProfileDefaults
  env?: Env
}

/** Better Auth's `socialProviders` option for this app. */
export function resolveSocialProviders({ authConfig, defaults, env = process.env }: ResolveSocialProvidersOptions): Record<string, Record<string, unknown>> {
  const providers: Record<string, Record<string, unknown>> = {}
  const listed = new Set<string>([...resolveAuthMethods(authConfig), ...Object.keys(authConfig?.providers ?? {})])

  for (const provider of SOCIAL_LOGIN_METHODS) {
    if (!listed.has(provider) || !isRuntimeSocialProviderAvailable(provider, { authConfig, env })) continue
    let credentials: Record<string, unknown>
    try {
      credentials = builtInCredentials(provider, env)
    } catch {
      // Only Apple builds something here: a key that is well formed but not an EC private key
      console.error(`[Auth] ${provider} is off: its signing key could not be read (APPLE_PRIVATE_KEY must be the .p8 file's contents)`)
      continue
    }
    const options: Record<string, unknown> = { ...authConfig?.providers?.[provider]?.options, mapProfileToUser: socialProfileMapper(provider, defaults) }
    // Credentials last, so options cannot replace them; as descriptors, so Apple's secret stays a getter
    providers[provider] = Object.defineProperties(options, Object.getOwnPropertyDescriptors(credentials))
  }

  for (const [id, entry] of Object.entries(authConfig?.providers ?? {})) {
    if (isSocialLoginMethod(id) || !entry || entry.enabled === false) continue
    if (!socialProviderList.includes(id as (typeof socialProviderList)[number])) {
      console.warn(`[Auth] Ignoring auth.providers.${id}: Better Auth has no social provider with that id`)
      continue
    }
    const prefix = credentialPrefix(id)
    const clientId = env[`${prefix}_CLIENT_ID`]?.trim()
    const clientSecret = env[`${prefix}_CLIENT_SECRET`]?.trim()
    if (!clientId || !clientSecret) {
      console.warn(`[Auth] auth.providers.${id} is off: set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET`)
      continue
    }
    providers[id] = { ...entry.options, mapProfileToUser: socialProfileMapper(id, defaults), clientId, clientSecret }
  }

  return providers
}

/**
 * The social provider a user is being created through, or null for any other
 * sign-up: an OAuth callback (`/callback/:id`) or an id-token sign-in
 * (`/sign-in/social` with `idToken`, native apps).
 */
export function socialSignUpProvider(ctx: { path?: string; params?: unknown; body?: unknown } | null | undefined): string | null {
  const path = ctx?.path ?? ''
  if (path.startsWith('/callback/')) {
    // The route's params, or the path itself when it is not the `/callback/:id` pattern
    const id = (ctx?.params as { id?: unknown } | undefined)?.id ?? path.slice('/callback/'.length)
    return typeof id === 'string' && id && id !== ':id' ? id : null
  }
  if (path === '/sign-in/social') {
    const provider = (ctx?.body as { provider?: unknown } | undefined)?.provider
    return typeof provider === 'string' ? provider : null
  }
  return null
}
