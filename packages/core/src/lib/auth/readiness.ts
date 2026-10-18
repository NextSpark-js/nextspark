import type { AuthConfig, AuthLoginMethod, SocialLoginMethod } from '../config/types'
import { findSmtpProblems, smtpEnvironmentFrom, SMTP_VARIABLES, type SmtpEnvironment, type SmtpVariable } from '../email/smtp-config'
import { resolveEmailSender, type SenderAddressVariable } from '../email/sender'
import { DEFAULT_AUTH_METHODS, SOCIAL_LOGIN_METHODS, isAuthLoginMethod, isSocialLoginMethod } from './auth-methods'

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
    /**
     * Raw BETTER_AUTH_SECRET. Only a present value is judged: a missing one is
     * left to the auth library, and a runtime-only build never sees it.
     */
    betterAuthSecret?: string
    email?: {
      /**
       * Raw EMAIL_PROVIDER. Exactly `auto`, `resend`, `smtp` or `console`; undefined or
       * empty selects `auto`. Unlike EmailFactory, which sends unknown values
       * down its auto path, any other token (including case- or
       * whitespace-altered ones) is rejected: this check deliberately fails closed.
       */
      provider?: string
      resendApiKey?: string
      /** The sender of both Resend and SMTP: EMAIL_FROM, or RESEND_FROM_EMAIL when EMAIL_FROM is unset (lib/email/sender). */
      emailFrom?: string
      resendFromEmail?: string
      /** Raw SMTP_* values; only judged when the provider is exactly `smtp` (`auto` never selects it). */
      smtp?: SmtpEnvironment
      /**
       * Boolean(FORCE_RESEND_IN_DEV), supplied by the adapter; this evaluator
       * never reads process.env. Only affects `auto` in development.
       */
      forceResendInDevelopment?: boolean
      /** Missing values are expected to be injected after the build. */
      runtimeOnly?: boolean
    }
    google?: SocialProviderConfiguration
    github?: SocialProviderConfiguration
    /** `tenantId` is optional (MICROSOFT_TENANT_ID, default `common`); a present one must be well formed. */
    microsoft?: SocialProviderConfiguration & { tenantId?: string }
    /** Apple signs its own client secret from the .p8 key: no clientSecret. */
    apple?: {
      clientId?: string
      teamId?: string
      keyId?: string
      privateKey?: string
      /**
       * Whether the key parses as the P-256 key Apple signs with, supplied by
       * an adapter that can parse keys (lib/auth/apple-key); this evaluator
       * only checks the PEM's shape. `false` makes the key malformed.
       */
      privateKeyUsable?: boolean
      runtimeOnly?: boolean
    }
  }
}

interface SocialProviderConfiguration {
  clientId?: string
  clientSecret?: string
  /** Missing values are expected to be injected after the build. */
  runtimeOnly?: boolean
}

/** The environment variable each built-in provider's credential comes from. */
type SocialCredentialVariable =
  | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'
  | 'GITHUB_CLIENT_ID' | 'GITHUB_CLIENT_SECRET'
  | 'MICROSOFT_CLIENT_ID' | 'MICROSOFT_CLIENT_SECRET' | 'MICROSOFT_TENANT_ID'
  | 'APPLE_CLIENT_ID' | 'APPLE_TEAM_ID' | 'APPLE_KEY_ID' | 'APPLE_PRIVATE_KEY'

export type AuthReadinessDiagnosticCode =
  | 'AUTH_NO_AVAILABLE_METHOD'
  | 'AUTH_ALL_METHODS_DISABLED'
  | 'EMAIL_RUNTIME_VALIDATION_REQUIRED'
  | 'EMAIL_PROVIDER_DEVELOPMENT_ONLY'
  | 'EMAIL_PROVIDER_UNSUPPORTED'
  | 'RESEND_API_KEY_MISSING'
  | 'RESEND_API_KEY_PLACEHOLDER'
  | 'RESEND_API_KEY_MALFORMED'
  | `${SenderAddressVariable}_${'MISSING' | 'PLACEHOLDER' | 'MALFORMED' | 'SANDBOX'}`
  | `${SmtpVariable}_${'MISSING' | 'PLACEHOLDER' | 'MALFORMED'}`
  | `${Uppercase<SocialLoginMethod>}_RUNTIME_VALIDATION_REQUIRED`
  | `${SocialCredentialVariable}_${'MISSING' | 'PLACEHOLDER' | 'MALFORMED'}`
  | 'BETTER_AUTH_SECRET_PLACEHOLDER'
  | 'BETTER_AUTH_SECRET_MALFORMED'

/**
 * Severity follows the overall outcome. When the outcome is `ready` or
 * `deferred`, per-method problems are warnings: the method stays out of
 * `availableMethods` and must not be advertised, but another path exists.
 * When the outcome is `invalid`, they are errors, and a final `method: 'auth'`
 * error explains that no usable path remains. Explicitly disabled methods are
 * intentional, so they produce no per-method diagnostic.
 */
export interface AuthReadinessDiagnostic {
  method: 'auth' | 'email' | SocialLoginMethod | 'email-password'
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
type EmailProviderToken = 'auto' | 'resend' | 'smtp' | 'console'

const EMAIL_PROVIDER_TOKENS: readonly string[] = ['auto', 'resend', 'smtp', 'console']

const RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_-]{16,}$/
const GOOGLE_CLIENT_ID_PATTERN = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/
const SECRET_PATTERN = /^\S+$/
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const APPLE_ID_PATTERN = /^[A-Z0-9]{10}$/
/** Shorter secrets are below the length the auth library itself warns about. */
const BETTER_AUTH_SECRET_MIN_LENGTH = 32
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

/**
 * A session-signing secret copied from a template, or too short to resist
 * guessing. In production it is an error that takes every method out of
 * service; elsewhere it is only a warning.
 */
export function evaluateSessionSecret(input: AuthReadinessInput): AuthReadinessDiagnostic | null {
  const state = credentialState(
    input.configuration?.betterAuthSecret,
    /./,
    BETTER_AUTH_SECRET_MIN_LENGTH
  )
  if (state === 'missing' || state === 'valid') return null
  return {
    ...credentialDiagnostic('auth', 'BETTER_AUTH_SECRET', state),
    severity: input.environment === 'production' ? 'error' : 'warning',
    message:
      state === 'placeholder'
        ? 'BETTER_AUTH_SECRET is a placeholder; set a random secret of at least 32 characters.'
        : `BETTER_AUTH_SECRET is shorter than ${BETTER_AUTH_SECRET_MIN_LENGTH} characters; set a random secret of at least 32 characters.`,
  }
}

function credentialDiagnostic(
  method: AuthReadinessDiagnostic['method'],
  field: 'RESEND_API_KEY' | SenderAddressVariable | 'BETTER_AUTH_SECRET' | SmtpVariable | SocialCredentialVariable,
  state: Exclude<CredentialState, 'valid'>
): AuthReadinessDiagnostic {
  return {
    method,
    code: `${field}_${state.toUpperCase()}` as AuthReadinessDiagnosticCode,
    severity: 'error',
    message:
      (field === 'SMTP_USER' || field === 'SMTP_PASS') && state === 'missing'
        ? `${field} is missing; SMTP_USER and SMTP_PASS must be set together or both left unset.`
        : field === 'EMAIL_FROM' && state === 'missing'
          ? 'EMAIL_FROM is missing; set the sender address (RESEND_FROM_EMAIL is still read when EMAIL_FROM is unset).'
          : `${field} is ${state}; provide a syntactically valid value.`,
  }
}

/** The configured sender, resolved like the providers resolve it. */
function senderOf(input: AuthReadinessInput) {
  const email = input.configuration?.email
  return resolveEmailSender({ EMAIL_FROM: email?.emailFrom, RESEND_FROM_EMAIL: email?.resendFromEmail })
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
): 'console' | 'resend' | 'smtp' {
  const email = input.configuration?.email
  if (provider !== 'auto') return provider
  if (input.environment === 'development') {
    // The factory falls back to console when forced but no API key is set.
    return email?.forceResendInDevelopment && email.resendApiKey ? 'resend' : 'console'
  }
  const hasResendConfiguration = Boolean(email?.resendApiKey?.trim() || senderOf(input).address)
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
      message: 'EMAIL_PROVIDER must be exactly auto, resend, smtp or console (case- and whitespace-sensitive).',
    })
    return 'invalid'
  }

  const selected = selectEmailProvider(input, provider as EmailProviderToken)
  if (selected === 'smtp') return evaluateSmtpConfiguration(input, diagnostics)

  if (selected === 'console') {
    if (input.environment === 'development') return 'available'
    diagnostics.push({
      method: 'email',
      code: 'EMAIL_PROVIDER_DEVELOPMENT_ONLY',
      severity: 'error',
      message: 'Console-delivered email is development-only; configure Resend or SMTP for production local authentication.',
    })
    return 'invalid'
  }

  const apiKeyState = credentialState(email?.resendApiKey, RESEND_API_KEY_PATTERN)
  const sender = senderOf(input)
  let fromEmailState: CredentialState | 'sandbox' = credentialState(sender.address, EMAIL_PATTERN)
  if (
    fromEmailState === 'valid' &&
    input.environment === 'production' &&
    RESEND_SANDBOX_SENDER_PATTERN.test(sender.address ?? '')
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
      code: `${sender.addressVariable}_SANDBOX`,
      severity: 'error',
      message:
        `${sender.addressVariable} uses the resend.dev testing sender, which only delivers to the Resend account owner; ` +
        'use a sender on a domain verified in Resend.',
    })
  } else if (fromEmailState !== 'valid') {
    diagnostics.push(credentialDiagnostic('email', sender.addressVariable, fromEmailState))
  }

  return apiKeyState === 'valid' && fromEmailState === 'valid' ? 'available' : 'invalid'
}

/**
 * A complete SMTP configuration: the SMTP_* contract plus the sender, the same
 * EMAIL_FROM (or RESEND_FROM_EMAIL) Resend uses. Checks syntax only, never
 * reaches the server.
 */
function evaluateSmtpConfiguration(
  input: AuthReadinessInput,
  diagnostics: AuthReadinessDiagnostic[]
): 'available' | 'invalid' | 'deferred' {
  const email = input.configuration?.email
  const smtp = email?.smtp ?? {}
  const problems = new Map(findSmtpProblems(smtp).map(({ variable, state }) => [variable, state]))
  const states: Array<{ variable: SmtpVariable | SenderAddressVariable; state: CredentialState }> = SMTP_VARIABLES.map(
    (variable) => ({ variable, state: problems.get(variable) ?? ('valid' as CredentialState) })
  )
  const host = states[0]
  if (host.state === 'valid' && isPlaceholder(smtp.host?.trim() ?? '')) host.state = 'placeholder'
  const sender = senderOf(input)
  states.push({ variable: sender.addressVariable, state: credentialState(sender.address, EMAIL_PATTERN) })

  if (canDeferAtBuild(input, email?.runtimeOnly, states.map(({ state }) => state))) {
    diagnostics.push({
      method: 'email',
      code: 'EMAIL_RUNTIME_VALIDATION_REQUIRED',
      severity: 'warning',
      message: 'Email configuration is runtime-only and must be validated before serving local authentication.',
    })
    return 'deferred'
  }
  for (const { variable, state } of states) {
    if (state !== 'valid') diagnostics.push(credentialDiagnostic('email', variable, state))
  }
  return states.every(({ state }) => state === 'valid') ? 'available' : 'invalid'
}

interface SocialCredentialField {
  key: string
  variable: SocialCredentialVariable
  pattern: RegExp
  minimumLength?: number
  /** A missing optional value is fine; a present one must still be valid. */
  optional?: boolean
}

/** What each built-in provider needs, in the order its diagnostics are reported. */
const SOCIAL_CREDENTIALS: Record<SocialLoginMethod, { label: string; fields: readonly SocialCredentialField[] }> = {
  google: {
    label: 'Google',
    fields: [
      { key: 'clientId', variable: 'GOOGLE_CLIENT_ID', pattern: GOOGLE_CLIENT_ID_PATTERN },
      { key: 'clientSecret', variable: 'GOOGLE_CLIENT_SECRET', pattern: SECRET_PATTERN, minimumLength: 8 },
    ],
  },
  github: {
    label: 'GitHub',
    fields: [
      { key: 'clientId', variable: 'GITHUB_CLIENT_ID', pattern: /^[A-Za-z0-9._-]+$/, minimumLength: 10 },
      { key: 'clientSecret', variable: 'GITHUB_CLIENT_SECRET', pattern: SECRET_PATTERN, minimumLength: 8 },
    ],
  },
  microsoft: {
    label: 'Microsoft',
    fields: [
      { key: 'clientId', variable: 'MICROSOFT_CLIENT_ID', pattern: GUID_PATTERN },
      { key: 'clientSecret', variable: 'MICROSOFT_CLIENT_SECRET', pattern: SECRET_PATTERN, minimumLength: 8 },
      // common, organizations, consumers, a tenant GUID or a verified domain
      { key: 'tenantId', variable: 'MICROSOFT_TENANT_ID', pattern: /^[A-Za-z0-9.-]+$/, optional: true },
    ],
  },
  apple: {
    label: 'Apple',
    fields: [
      // The Services ID, reverse-DNS (com.example.web)
      { key: 'clientId', variable: 'APPLE_CLIENT_ID', pattern: /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/ },
      { key: 'teamId', variable: 'APPLE_TEAM_ID', pattern: APPLE_ID_PATTERN },
      { key: 'keyId', variable: 'APPLE_KEY_ID', pattern: APPLE_ID_PATTERN },
      // The .p8 file's contents; newlines may be written as \n in .env
      { key: 'privateKey', variable: 'APPLE_PRIVATE_KEY', pattern: /^(?:\\n)*-----BEGIN PRIVATE KEY-----(?:\s|\\n)[\s\S]+(?:\s|\\n)-----END PRIVATE KEY-----(?:\\n)*$/ },
    ],
  },
}

function evaluateSocialConfiguration(
  input: AuthReadinessInput,
  provider: SocialLoginMethod,
  diagnostics: AuthReadinessDiagnostic[]
): 'available' | 'invalid' | 'deferred' {
  const { label, fields } = SOCIAL_CREDENTIALS[provider]
  const configuration = (input.configuration?.[provider] ?? {}) as Record<string, unknown> & { runtimeOnly?: boolean; privateKeyUsable?: boolean }
  const states = fields.map((field) => {
    const value = configuration[field.key]
    let state = credentialState(typeof value === 'string' ? value : undefined, field.pattern, field.minimumLength)
    if (field.key === 'privateKey' && state === 'valid' && configuration.privateKeyUsable === false) state = 'malformed'
    return { field, state }
  }).filter(({ field, state }) => !(field.optional && state === 'missing'))

  if (canDeferAtBuild(input, configuration.runtimeOnly, states.map(({ state }) => state))) {
    diagnostics.push({
      method: provider,
      code: `${provider.toUpperCase() as Uppercase<SocialLoginMethod>}_RUNTIME_VALIDATION_REQUIRED`,
      severity: 'warning',
      message: `${label} credentials are runtime-only and must be validated before serving local authentication.`,
    })
    return 'deferred'
  }

  for (const { field, state } of states) {
    if (state !== 'valid') diagnostics.push(credentialDiagnostic(provider, field.variable, state))
  }
  return states.every(({ state }) => state === 'valid') ? 'available' : 'invalid'
}

/**
 * Maps the provider environment contract (EMAIL_PROVIDER, RESEND_API_KEY,
 * EMAIL_FROM, RESEND_FROM_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FORCE_RESEND_IN_DEV, and the built-in social providers'
 * variables in SOCIAL_CREDENTIALS) onto evaluator configuration. Shared by the runtime
 * adapter and the production build check so both read the same variables.
 */
export function authReadinessConfigurationFromEnv(
  env: Record<string, string | undefined>
): NonNullable<AuthReadinessInput['configuration']> {
  return {
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    email: {
      provider: env.EMAIL_PROVIDER,
      resendApiKey: env.RESEND_API_KEY,
      emailFrom: env.EMAIL_FROM,
      resendFromEmail: env.RESEND_FROM_EMAIL,
      smtp: smtpEnvironmentFrom(env),
      forceResendInDevelopment: Boolean(env.FORCE_RESEND_IN_DEV),
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      tenantId: env.MICROSOFT_TENANT_ID,
    },
    apple: {
      clientId: env.APPLE_CLIENT_ID,
      teamId: env.APPLE_TEAM_ID,
      keyId: env.APPLE_KEY_ID,
      privateKey: env.APPLE_PRIVATE_KEY,
    },
  }
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
  const secretDiagnostic = evaluateSessionSecret(input)
  if (secretDiagnostic?.severity === 'error') {
    // Nothing that signs a session can be trusted, so no method is offered.
    const others = evaluateAuthReadiness({
      ...input,
      configuration: { ...input.configuration, betterAuthSecret: undefined },
    })
    return {
      outcome: 'invalid',
      declaredMethods,
      availableMethods: [],
      deferredMethods: [],
      diagnostics: [
        secretDiagnostic,
        ...others.diagnostics.map((diagnostic) => ({ ...diagnostic, severity: 'warning' as const })),
      ],
    }
  }
  const available = new Set<AuthLoginMethod>()
  const deferred = new Set<AuthLoginMethod>()
  const diagnostics: AuthReadinessDiagnostic[] = secretDiagnostic ? [secretDiagnostic] : []

  const passwordEnabled = input.authConfig?.emailAndPassword?.enabled !== false
  const socialEnabled = (provider: SocialLoginMethod) => input.authConfig?.providers?.[provider]?.enabled !== false

  const providerBackedEmailMethods = declaredMethods.filter(
    (method) => method === 'email-otp' || (method === 'email-password' && passwordEnabled)
  )
  if (providerBackedEmailMethods.length > 0) {
    const emailStatus = evaluateEmailConfiguration(input, diagnostics)
    if (emailStatus === 'available') providerBackedEmailMethods.forEach((method) => available.add(method))
    if (emailStatus === 'deferred') providerBackedEmailMethods.forEach((method) => deferred.add(method))
  }

  for (const provider of SOCIAL_LOGIN_METHODS) {
    if (!declaredMethods.includes(provider) || !socialEnabled(provider)) continue
    const status = evaluateSocialConfiguration(input, provider, diagnostics)
    if (status === 'available') available.add(provider)
    if (status === 'deferred') deferred.add(provider)
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
    (method) => (isSocialLoginMethod(method) && !socialEnabled(method)) || (method === 'email-password' && !passwordEnabled)
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
