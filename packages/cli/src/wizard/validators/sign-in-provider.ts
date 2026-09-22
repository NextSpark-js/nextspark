/**
 * Production Sign-In Provider Validators
 *
 * Field-level wrappers around the *exact* placeholder/shape rules in
 * `packages/core/src/lib/auth/readiness.ts` (`isPlaceholder`,
 * `credentialState`, and the four field patterns — see that file's
 * `RESEND_API_KEY_PATTERN`, `GOOGLE_CLIENT_ID_PATTERN`, `EMAIL_PATTERN`,
 * `DOCUMENTED_PLACEHOLDER_SENDER_PATTERN`, `RESEND_SANDBOX_SENDER_PATTERN`,
 * and the Google secret's `/^\S+$/` + min-length-8 check inside
 * `evaluateGoogleConfiguration`), copied verbatim below.
 *
 * Duplicated rather than imported: this package does not depend on
 * `@nextsparkjs/core` at build time. A table-driven parity test
 * (`packages/cli/tests/wizard-sign-in-provider.test.ts`) imports core's
 * `readiness.ts` directly via `evaluateAuthReadiness` and asserts the two
 * agree on a shared table of shapes — that test is the tripwire if core's
 * rules ever change, not this comment.
 *
 * One deliberate difference: core's evaluator only treats `@resend.dev` as
 * unusable when `environment: 'production'` (in development it is a normal,
 * if limited, sandbox sender). This wizard step exists specifically to
 * collect *production* sign-in credentials, so it always rejects it —
 * matching what `evaluateAuthReadiness({ environment: 'production', ... })`
 * would report for the value the user is about to write to `.env`.
 */

export type ValidationResult = true | string

// --- verbatim from packages/core/src/lib/auth/readiness.ts ---
type CredentialState = 'missing' | 'placeholder' | 'malformed' | 'valid'

const RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_-]{16,}$/
const GOOGLE_CLIENT_ID_PATTERN = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
/** Sender domain used by the framework's deployment docs as a template value. */
const DOCUMENTED_PLACEHOLDER_SENDER_PATTERN = /@yourdomain\.com$/i
/** Resend's shared testing sender only delivers to the Resend account owner. */
const RESEND_SANDBOX_SENDER_PATTERN = /@resend\.dev$/i
/** Google's OAuth client secret has no published shape beyond "not blank/whitespace". */
const GOOGLE_CLIENT_SECRET_PATTERN = /^\S+$/

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
// --- end verbatim copy ---

function messageFor(field: string, state: Exclude<CredentialState, 'valid'>, shapeHint: string): string {
  if (state === 'missing') return `${field} is required.`
  if (state === 'placeholder') return `That looks like a placeholder, not a real ${field}.`
  return shapeHint
}

export function validateResendApiKey(value: string): ValidationResult {
  const state = credentialState(value, RESEND_API_KEY_PATTERN)
  if (state === 'valid') return true
  return messageFor(
    'Resend API key',
    state,
    'Resend API keys look like re_ followed by at least 16 letters/digits/-/_ (e.g. re_123456789012345678).'
  )
}

export function validateResendFromEmail(value: string): ValidationResult {
  const trimmed = value.trim()
  const state = credentialState(value, EMAIL_PATTERN)
  if (state !== 'valid') {
    return messageFor('sender email', state, 'Enter a valid email address (e.g. hello@yourcompany-domain.com).')
  }
  // See module comment: this step always validates as if environment === 'production'.
  if (RESEND_SANDBOX_SENDER_PATTERN.test(trimmed)) {
    return 'resend.dev only delivers to the Resend account owner; use a sender on a domain verified in Resend for production.'
  }
  return true
}

export function validateGoogleClientId(value: string): ValidationResult {
  const state = credentialState(value, GOOGLE_CLIENT_ID_PATTERN)
  if (state === 'valid') return true
  return messageFor('Google OAuth client ID', state, 'Google client IDs look like 123456789-abc123.apps.googleusercontent.com.')
}

export function validateGoogleClientSecret(value: string): ValidationResult {
  const state = credentialState(value, GOOGLE_CLIENT_SECRET_PATTERN, 8)
  if (state === 'valid') return true
  return messageFor('Google OAuth client secret', state, 'Google client secrets are non-whitespace strings of at least 8 characters.')
}

// ---------------------------------------------------------------------------
// CLI-only: not part of the core parity contract above. Core never writes
// `.env`, so it has no reason to know about `dotenv`'s parsing quirks.
// ---------------------------------------------------------------------------

/**
 * `RESEND_API_KEY`/`GOOGLE_CLIENT_ID` are restrictive enough (`[A-Za-z0-9_-]`
 * plus a few structural characters) that this can never trigger for them.
 * `RESEND_FROM_EMAIL` (`EMAIL_PATTERN` only excludes whitespace/`@`/`<`/`>`)
 * and especially `GOOGLE_CLIENT_SECRET` (`/^\S+$/`, otherwise unconstrained)
 * can contain a quote, `#`, or backslash — and this project's `dotenv`
 * (v17, verified empirically, see wizard-sign-in-provider.test.ts) does not
 * implement real escaping: a `"` inside a double-quoted value can shift
 * where the parser thinks the value ends, and a `#` outside a cleanly
 * closed quote truncates the rest as a comment. Rather than write a value
 * that reads back different from what the user typed, values containing
 * any of these characters are refused here.
 */
const UNSAFE_ENV_VALUE_PATTERN = /["'`#\\\r\n]/

export function validateEnvSafeValue(value: string): ValidationResult {
  if (UNSAFE_ENV_VALUE_PATTERN.test(value)) {
    return 'This value contains a quote, #, backslash, or line break, which .env files cannot safely store here — please remove it.'
  }
  return true
}
