import 'server-only'

import { AUTH_CONFIG } from '../config'
import type { AuthConfig, AuthLoginMethod } from '../config/types'
import { isPasswordLoginEnabled } from './auth-methods'
import {
  authReadinessConfigurationFromEnv,
  evaluateAuthReadiness,
  type AuthReadinessDiagnostic,
  type AuthReadinessResult,
} from './readiness'

type RuntimeEnvironment = Record<string, string | undefined>

export interface RuntimeAuthReadinessOptions {
  authConfig?: Pick<AuthConfig, 'methods' | 'providers' | 'emailAndPassword'> | null
  env?: RuntimeEnvironment
}

/**
 * Server-derived flows that do not follow the login UI intent (`auth.methods`).
 * The password backend (`auth.emailAndPassword.enabled`) stays on under the
 * passwordless preset, so invitation registration and password recovery must
 * not be inferred from `availableMethods`.
 */
export interface PublicAuthCapabilities {
  /** `/api/v1/auth/signup-with-invite` accepts a password (backend switch only). */
  invitationPasswordSignup: boolean
  /** `/request-password-reset` can run: password backend + usable email delivery. */
  passwordRecovery: boolean
}

export interface PublicAuthReadiness {
  status: 'ready' | 'unavailable'
  availableMethods: AuthLoginMethod[]
  capabilities: PublicAuthCapabilities
}

function runtimeInput(options: RuntimeAuthReadinessOptions = {}) {
  const env = options.env ?? process.env
  return {
    profile: 'web-local-auth' as const,
    stage: 'runtime' as const,
    environment: env.NODE_ENV === 'production' ? 'production' as const : 'development' as const,
    authConfig: options.authConfig === undefined ? AUTH_CONFIG : options.authConfig,
    configuration: authReadinessConfigurationFromEnv(env),
  }
}

/** Server-owned runtime adapter for the pure readiness evaluator. */
export function getRuntimeAuthReadiness(options: RuntimeAuthReadinessOptions = {}): AuthReadinessResult {
  return evaluateAuthReadiness(runtimeInput(options))
}

/**
 * Startup re-validation for production servers. The build check may have
 * deferred runtime-only providers, and the runtime environment can differ from
 * the build's, so this logs one error with safe diagnostics (codes and
 * messages, never values) when no login method can work. It never throws or
 * stops the server: the per-request gates already fail closed.
 */
export function logAuthReadinessAtStartup(options: RuntimeAuthReadinessOptions = {}): void {
  try {
    const env = options.env ?? process.env
    if (env.NODE_ENV !== 'production') return
    const result = getRuntimeAuthReadiness(options)
    if (result.outcome !== 'invalid') return
    console.error('[auth-readiness] no login method can authenticate; login requests will be refused until this is fixed', {
      declaredMethods: result.declaredMethods,
      diagnostics: result.diagnostics.map(({ method, code, message }) => ({ method, code, message })),
    })
  } catch {
    console.error('[auth-readiness] startup readiness check could not run; per-request gates still apply')
  }
}

/** The only readiness representation safe to return to an unauthenticated browser. */
export function getPublicAuthReadiness(options: RuntimeAuthReadinessOptions = {}): PublicAuthReadiness {
  const result = getRuntimeAuthReadiness(options)
  const authConfig = options.authConfig === undefined ? AUTH_CONFIG : options.authConfig
  const passwordBackend = isPasswordLoginEnabled(authConfig)
  return {
    status: result.outcome === 'ready' ? 'ready' : 'unavailable',
    availableMethods: result.availableMethods,
    capabilities: {
      invitationPasswordSignup: passwordBackend,
      passwordRecovery: passwordBackend && isRuntimeEmailAvailable(options),
    },
  }
}

function evaluateProvider(
  method: Extract<AuthLoginMethod, 'email-otp' | 'google'>,
  options: RuntimeAuthReadinessOptions,
): AuthReadinessResult {
  const authConfig = options.authConfig === undefined ? AUTH_CONFIG : options.authConfig
  return evaluateAuthReadiness({
    ...runtimeInput(options),
    authConfig: {
      methods: [method],
      providers: authConfig?.providers,
      emailAndPassword: authConfig?.emailAndPassword,
    },
  })
}

export function isRuntimeEmailAvailable(options: RuntimeAuthReadinessOptions = {}): boolean {
  return evaluateProvider('email-otp', options).availableMethods.includes('email-otp')
}

export function isRuntimeGoogleAvailable(options: RuntimeAuthReadinessOptions = {}): boolean {
  return evaluateProvider('google', options).availableMethods.includes('google')
}

function authRoutePath(pathname: string): string | null {
  const marker = '/api/auth'
  const index = pathname.lastIndexOf(marker)
  if (index === -1) return null
  const suffix = pathname.slice(index + marker.length)
  return suffix || '/'
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}

interface SafeRuntimeDiagnostic { code: string; message: string }

function unavailableResponse(
  method: AuthLoginMethod,
  diagnostics: readonly SafeRuntimeDiagnostic[],
  pathname: string,
): Response {
  console.error('[auth-readiness] blocked unavailable authentication operation', {
    pathname,
    method,
    diagnostics: diagnostics.map(({ code, message }) => ({ code, message })),
  })
  return jsonResponse({
    error: 'Authentication method unavailable',
    code: 'AUTH_METHOD_UNAVAILABLE',
    method,
  }, 503)
}

async function requestedSocialProvider(request: Request): Promise<string | null> {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return null
    const body = await request.clone().json() as { provider?: unknown }
    return typeof body?.provider === 'string' ? body.provider : null
  } catch {
    return null
  }
}

/**
 * Runtime gate around a Better Auth route handler. It deliberately leaves
 * session inspection and sign-out untouched, while blocking provider-backed
 * operations before Better Auth can invoke an unusable provider.
 */
export async function getAuthReadinessResponse(
  request: Request,
  options: RuntimeAuthReadinessOptions = {},
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  const route = authRoutePath(pathname)
  if (!route) return null

  if (request.method === 'GET' && route === '/readiness') {
    return jsonResponse(getPublicAuthReadiness(options))
  }

  const authConfig = options.authConfig === undefined ? AUTH_CONFIG : options.authConfig
  let method: AuthLoginMethod | null = null
  let diagnostics: AuthReadinessDiagnostic[] = []

  const isOtpOperation = route === '/email-otp/send-verification-otp' || route === '/sign-in/email-otp'
  const isPasswordOperation = [
    '/sign-in/email',
    '/sign-up/email',
    '/sign-up/credentials',
    '/request-password-reset',
    '/forget-password',
    '/reset-password',
    '/change-password',
  ].includes(route)
  const isPasswordEmailDeliveryOperation = [
    '/sign-up/email',
    '/sign-up/credentials',
    '/request-password-reset',
    '/forget-password',
  ].includes(route)
  const isGeneralEmailDeliveryOperation = ['/send-verification-email', '/change-email'].includes(route)

  if (isOtpOperation) {
    method = 'email-otp'
    const readiness = evaluateProvider('email-otp', options)
    diagnostics = readiness.diagnostics
    if (!readiness.availableMethods.includes('email-otp')) {
      return unavailableResponse(method, diagnostics, pathname)
    }
  }

  if (isPasswordOperation && authConfig?.emailAndPassword?.enabled === false) {
    return unavailableResponse('email-password', [{
      code: 'EMAIL_PASSWORD_POLICY_DISABLED',
      message: 'Password authentication is disabled by auth.emailAndPassword.enabled.',
    }], pathname)
  }

  if (isPasswordEmailDeliveryOperation || isGeneralEmailDeliveryOperation) {
    method = isPasswordEmailDeliveryOperation ? 'email-password' : 'email-otp'
    const readiness = evaluateProvider('email-otp', options)
    diagnostics = readiness.diagnostics
    if (!readiness.availableMethods.includes('email-otp')) {
      return unavailableResponse(method, diagnostics, pathname)
    }
  }

  const socialProvider = route === '/sign-in/social' ? await requestedSocialProvider(request) : null
  const isGoogleOperation =
    (route === '/sign-in/social' && (socialProvider === null || socialProvider === 'google')) ||
    route === '/callback/google'
  if (isGoogleOperation) {
    method = 'google'
    const readiness = evaluateProvider('google', options)
    diagnostics = readiness.diagnostics
    if (authConfig?.providers?.google?.enabled === false) {
      return unavailableResponse(method, [{
        code: 'GOOGLE_POLICY_DISABLED',
        message: 'Google authentication is disabled by auth.providers.google.enabled.',
      }], pathname)
    }
    if (!readiness.availableMethods.includes('google')) {
      return unavailableResponse(method, diagnostics, pathname)
    }
  }

  return null
}

/** Execute a Better Auth handler only after its operation passes the runtime gate. */
export async function withAuthRequestReadiness(
  request: Request,
  handler: () => Promise<Response>,
  options: RuntimeAuthReadinessOptions = {},
): Promise<Response> {
  const response = await getAuthReadinessResponse(request, options)
  return response ?? handler()
}
