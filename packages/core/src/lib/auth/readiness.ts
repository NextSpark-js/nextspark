import type { AuthConfig, AuthLoginMethod } from '../config/types'
import { DEFAULT_AUTH_METHODS, isAuthLoginMethod } from './auth-methods'

/**
 * @internal Pure readiness inputs; integration is intentionally deferred.
 *
 * Profiles:
 * - `web-local-auth` and `headless` validate the same configured methods: a
 *   headless host still serves the local auth routes, so it needs the same
 *   providers. There is intentionally no headless-specific readiness.
 * - `external-no-local-auth` is an assertion by the host adapter that local
 *   auth routes are not served. The evaluator does not prove it and disables
 *   no routes; it only reports `not-applicable`.
 */
export interface AuthReadinessInput {
  profile: 'web-local-auth' | 'headless' | 'external-no-local-auth'
  stage: 'build' | 'runtime'
  environment: 'development' | 'production'
  authConfig?: Pick<AuthConfig, 'methods' | 'providers' | 'emailAndPassword'> | null
  configuration?: {
    email?: {
      /**
       * Raw EMAIL_PROVIDER. Exactly `auto`, `resend` or `console`; undefined or
       * empty selects `auto`. Unlike EmailFactory, which sends unknown values
       * down its auto path, any other token (including case- or
       * whitespace-altered ones) is rejected: this check deliberately fails closed.
       */
      provider?: string
      resendApiKey?: string
      resendFromEmail?: string
      /**
       * Boolean(FORCE_RESEND_IN_DEV), supplied by the adapter; this evaluator
       * never reads process.env. Only affects `auto` in development.
       */
      forceResendInDevelopment?: boolean
      /** Missing values are expected to be injected after the build. */
      runtimeOnly?: boolean
    }
    google?: {
      clientId?: string
      clientSecret?: string
      /** Missing values are expected to be injected after the build. */
      runtimeOnly?: boolean
    }
  }
}

export type AuthReadinessDiagnosticCode =
  | 'AUTH_NO_AVAILABLE_METHOD'
  | 'AUTH_ALL_METHODS_DISABLED'
  | 'EMAIL_RUNTIME_VALIDATION_REQUIRED'
  | 'EMAIL_PROVIDER_DEVELOPMENT_ONLY'
  | 'EMAIL_PROVIDER_UNSUPPORTED'
  | 'RESEND_API_KEY_MISSING'
  | 'RESEND_API_KEY_PLACEHOLDER'
  | 'RESEND_API_KEY_MALFORMED'
  | 'RESEND_FROM_EMAIL_MISSING'
  | 'RESEND_FROM_EMAIL_PLACEHOLDER'
  | 'RESEND_FROM_EMAIL_MALFORMED'
  | 'RESEND_FROM_EMAIL_SANDBOX'
  | 'GOOGLE_RUNTIME_VALIDATION_REQUIRED'
  | 'GOOGLE_CLIENT_ID_MISSING'
  | 'GOOGLE_CLIENT_ID_PLACEHOLDER'
  | 'GOOGLE_CLIENT_ID_MALFORMED'
  | 'GOOGLE_CLIENT_SECRET_MISSING'
  | 'GOOGLE_CLIENT_SECRET_PLACEHOLDER'
  | 'GOOGLE_CLIENT_SECRET_MALFORMED'

/**
 * Severity follows the overall outcome. When the outcome is `ready` or
 * `deferred`, per-method problems are warnings: the method stays out of
 * `availableMethods` and must not be advertised, but another path exists.
 * When the outcome is `invalid`, they are errors, and a final `method: 'auth'`
 * error explains that no usable path remains. Explicitly disabled methods are
 * intentional, so they produce no per-method diagnostic.
 */
export interface AuthReadinessDiagnostic {
  method: 'auth' | 'email' | 'google' | 'email-password'
  code: AuthReadinessDiagnosticCode
  severity: 'error' | 'warning'
  message: string
}

/**
 * @internal Safe to serialize: credential values are never copied into this result.
 *
 * `declaredMethods` keeps the selected intent (like resolveAuthMethods), even
 * for disabled methods. `availableMethods` is the only list a UI may advertise.
 * The outcome is `ready` when at least one method is available. It is
 * `deferred` only at build, when none is available but a runtimeOnly one can
 * still be validated; runtime must then re-evaluate. Otherwise it is `invalid`.
 */
export interface AuthReadinessResult {
  outcome: 'ready' | 'invalid' | 'deferred' | 'not-applicable'
  declaredMethods: AuthLoginMethod[]
  availableMethods: AuthLoginMethod[]
  deferredMethods: AuthLoginMethod[]
  diagnostics: AuthReadinessDiagnostic[]
}

type CredentialState = 'missing' | 'placeholder' | 'malformed' | 'valid'
type EmailProviderToken = 'auto' | 'resend' | 'console'

const EMAIL_PROVIDER_TOKENS: readonly string[] = ['auto', 'resend', 'console']

const RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_-]{16,}$/
const GOOGLE_CLIENT_ID_PATTERN = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
/** Sender domain used by the framework's deployment docs as a template value. */
const DOCUMENTED_PLACEHOLDER_SENDER_PATTERN = /@yourdomain\.com$/i
/** Resend's shared testing sender only delivers to the Resend account owner. */
const RESEND_SANDBOX_SENDER_PATTERN = /@resend\.dev$/i

function isPlaceholder(value: string): boolean {
  return (
    value.includes('...') ||
    /(?:^|[_<\s.-])(?:your|replace|change|changeme|todo|placeholder|x{3,})(?:[_>\s.-]|$)/i.test(value) ||
    DOCUMENTED_PLACEHOLDER_SENDER_PATTERN.test(value) ||
    /^<[^>]+>$/.test(value)
  )
}

function credentialState(value: string | undefined, pattern: RegExp, minimumLength = 1): CredentialState {
  const normalized = value?.trim() ?? ''
  if (!normalized) return 'missing'
  if (isPlaceholder(normalized)) return 'placeholder'
  if (normalized.length < minimumLength || !pattern.test(normalized)) return 'malformed'
  return 'valid'
}

function credentialDiagnostic(
  method: AuthReadinessDiagnostic['method'],
  field: 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET',
  state: Exclude<CredentialState, 'valid'>
): AuthReadinessDiagnostic {
  return {
    method,
    code: `${field}_${state.toUpperCase()}` as AuthReadinessDiagnosticCode,
    severity: 'error',
    message: `${field} is ${state}; provide a syntactically valid value.`,
  }
}

/** A runtime-only build may defer missing fields, but never a concrete invalid one. */
function canDeferAtBuild(
  input: AuthReadinessInput,
  runtimeOnly: boolean | undefined,
  states: Array<CredentialState | 'sandbox'>
): boolean {
  return (
    input.stage === 'build' &&
    Boolean(runtimeOnly) &&
    states.includes('missing') &&
    states.every((state) => state === 'missing' || state === 'valid')
  )
}

function resolveDeclaredMethods(authConfig: AuthReadinessInput['authConfig']): AuthLoginMethod[] {
  if (!Array.isArray(authConfig?.methods)) return [...DEFAULT_AUTH_METHODS]

  const methods = authConfig.methods.filter(isAuthLoginMethod)
  const uniqueMethods = [...new Set(methods)]
  return uniqueMethods.length > 0 ? uniqueMethods : [...DEFAULT_AUTH_METHODS]
}

/** Mirrors EmailFactory.create provider selection without reading process.env. */
function selectEmailProvider(
  input: AuthReadinessInput,
  provider: EmailProviderToken
): 'console' | 'resend' {
  const email = input.configuration?.email
  if (provider !== 'auto') return provider
  if (input.environment === 'development') {
    // The factory falls back to console when forced but no API key is set.
    return email?.forceResendInDevelopment && email.resendApiKey ? 'resend' : 'console'
  }
  const hasResendConfiguration = Boolean(email?.resendApiKey?.trim() || email?.resendFromEmail?.trim())
  return hasResendConfiguration || (input.stage === 'build' && email?.runtimeOnly) ? 'resend' : 'console'
}

function evaluateEmailConfiguration(
  input: AuthReadinessInput,
  diagnostics: AuthReadinessDiagnostic[]
): 'available' | 'invalid' | 'deferred' {
  const email = input.configuration?.email
  const provider = email?.provider || 'auto'
  if (!EMAIL_PROVIDER_TOKENS.includes(provider)) {
    diagnostics.push({
      method: 'email',
      code: 'EMAIL_PROVIDER_UNSUPPORTED',
      severity: 'error',
      message: 'EMAIL_PROVIDER must be exactly auto, resend or console (case- and whitespace-sensitive).',
    })
    return 'invalid'
  }

  if (selectEmailProvider(input, provider as EmailProviderToken) === 'console') {
    if (input.environment === 'development') return 'available'
    diagnostics.push({
      method: 'email',
      code: 'EMAIL_PROVIDER_DEVELOPMENT_ONLY',
      severity: 'error',
      message: 'Console-delivered email is development-only; configure Resend for production local authentication.',
    })
    return 'invalid'
  }

  const apiKeyState = credentialState(email?.resendApiKey, RESEND_API_KEY_PATTERN)
  let fromEmailState: CredentialState | 'sandbox' = credentialState(email?.resendFromEmail, EMAIL_PATTERN)
  if (
    fromEmailState === 'valid' &&
    input.environment === 'production' &&
    RESEND_SANDBOX_SENDER_PATTERN.test(email?.resendFromEmail?.trim() ?? '')
  ) {
    fromEmailState = 'sandbox'
  }
  if (canDeferAtBuild(input, email?.runtimeOnly, [apiKeyState, fromEmailState])) {
    diagnostics.push({
      method: 'email',
      code: 'EMAIL_RUNTIME_VALIDATION_REQUIRED',
      severity: 'warning',
      message: 'Email configuration is runtime-only and must be validated before serving local authentication.',
    })
    return 'deferred'
  }
  if (apiKeyState !== 'valid') diagnostics.push(credentialDiagnostic('email', 'RESEND_API_KEY', apiKeyState))
  if (fromEmailState === 'sandbox') {
    diagnostics.push({
      method: 'email',
      code: 'RESEND_FROM_EMAIL_SANDBOX',
      severity: 'error',
      message:
        'RESEND_FROM_EMAIL uses the resend.dev testing sender, which only delivers to the Resend account owner; ' +
        'use a sender on a domain verified in Resend.',
    })
  } else if (fromEmailState !== 'valid') {
    diagnostics.push(credentialDiagnostic('email', 'RESEND_FROM_EMAIL', fromEmailState))
  }

  return apiKeyState === 'valid' && fromEmailState === 'valid' ? 'available' : 'invalid'
}

function evaluateGoogleConfiguration(
  input: AuthReadinessInput,
  diagnostics: AuthReadinessDiagnostic[]
): 'available' | 'invalid' | 'deferred' {
  const google = input.configuration?.google
  const clientIdState = credentialState(google?.clientId, GOOGLE_CLIENT_ID_PATTERN)
  const clientSecretState = credentialState(google?.clientSecret, /^\S+$/, 8)
  if (canDeferAtBuild(input, google?.runtimeOnly, [clientIdState, clientSecretState])) {
    diagnostics.push({
      method: 'google',
      code: 'GOOGLE_RUNTIME_VALIDATION_REQUIRED',
      severity: 'warning',
      message: 'Google credentials are runtime-only and must be validated before serving local authentication.',
    })
    return 'deferred'
  }

  if (clientIdState !== 'valid') {
    diagnostics.push(credentialDiagnostic('google', 'GOOGLE_CLIENT_ID', clientIdState))
  }
  if (clientSecretState !== 'valid') {
    diagnostics.push(credentialDiagnostic('google', 'GOOGLE_CLIENT_SECRET', clientSecretState))
  }

  return clientIdState === 'valid' && clientSecretState === 'valid' ? 'available' : 'invalid'
}

/**
 * Evaluates whether at least one method declared by AuthConfig has a
 * syntactically configured server-side provider. This performs no provider or
 * network I/O, reads no environment and does not log. Syntax checks never prove
 * that a domain is verified or that delivery works.
 *
 * @internal Integration with build/start/UI gates belongs to a later slice.
 */
export function evaluateAuthReadiness(input: AuthReadinessInput): AuthReadinessResult {
  if (input.profile === 'external-no-local-auth') {
    return {
      outcome: 'not-applicable',
      declaredMethods: [],
      availableMethods: [],
      deferredMethods: [],
      diagnostics: [],
    }
  }

  const declaredMethods = resolveDeclaredMethods(input.authConfig)
  const available = new Set<AuthLoginMethod>()
  const deferred = new Set<AuthLoginMethod>()
  const diagnostics: AuthReadinessDiagnostic[] = []

  const passwordEnabled = input.authConfig?.emailAndPassword?.enabled !== false
  const googleEnabled = input.authConfig?.providers?.google?.enabled !== false

  const providerBackedEmailMethods = declaredMethods.filter(
    (method) => method === 'email-otp' || (method === 'email-password' && passwordEnabled)
  )
  if (providerBackedEmailMethods.length > 0) {
    const emailStatus = evaluateEmailConfiguration(input, diagnostics)
    if (emailStatus === 'available') providerBackedEmailMethods.forEach((method) => available.add(method))
    if (emailStatus === 'deferred') providerBackedEmailMethods.forEach((method) => deferred.add(method))
  }

  if (declaredMethods.includes('google') && googleEnabled) {
    const googleStatus = evaluateGoogleConfiguration(input, diagnostics)
    if (googleStatus === 'available') available.add('google')
    if (googleStatus === 'deferred') deferred.add('google')
  }

  const availableMethods = declaredMethods.filter((method) => available.has(method))
  const deferredMethods = declaredMethods.filter((method) => deferred.has(method))

  const outcome = availableMethods.length > 0
    ? 'ready'
    : deferredMethods.length > 0
      ? 'deferred'
      : 'invalid'

  if (outcome !== 'invalid') {
    // Another path exists, so these only explain why a method is not offered.
    return {
      outcome,
      declaredMethods,
      availableMethods,
      deferredMethods,
      diagnostics: diagnostics.map((diagnostic) => ({ ...diagnostic, severity: 'warning' })),
    }
  }

  const allDisabled = declaredMethods.every(
    (method) => (method === 'google' && !googleEnabled) || (method === 'email-password' && !passwordEnabled)
  )
  diagnostics.push(allDisabled
    ? {
      method: 'auth',
      code: 'AUTH_ALL_METHODS_DISABLED',
      severity: 'error',
      message: 'Every method in auth.methods is disabled server-side; enable one or select another login method.',
    }
    : {
      method: 'auth',
      code: 'AUTH_NO_AVAILABLE_METHOD',
      severity: 'error',
      message: 'No selected login method has a usable configuration; fix at least one method reported above.',
    })

  return { outcome, declaredMethods, availableMethods, deferredMethods, diagnostics }
}
