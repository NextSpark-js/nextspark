import { createHash } from 'node:crypto'

/**
 * Which POSTs under /api/auth/* are charged to the rate limit.
 *
 * An explicit allowlist, not a list of exclusions: a route Better Auth adds later is neither charged
 * nor freed by accident, someone decides it here. Only the routes that let a caller guess a password
 * or a code, or make the server send an email, are charged. Everything else (sign-out, session reads
 * and updates, OAuth callbacks, change-password, ...) needs a valid session or a provider redirect,
 * so it is no way to guess a credential and costs nothing.
 *
 * `by` names the per-identifier budget a route also draws from (the email in the body); a route with
 * no `by` is charged per address only. Each `by` is its own budget per email, so asking for codes
 * never uses up the attempts to verify one.
 */
const CHARGED: Record<string, 'send' | 'verify' | 'password' | undefined> = {
  // ask for a code or a reset email
  'email-otp/send-verification-otp': 'send',
  'email-otp/request-password-reset': 'send',
  'forget-password/email-otp': 'send',
  'request-password-reset': 'send',
  // try a code
  'sign-in/email-otp': 'verify',
  'email-otp/check-verification-otp': 'verify',
  'email-otp/verify-email': 'verify',
  'email-otp/reset-password': 'verify',
  // try a password
  'sign-in/email': 'password',
  // resend the verification link
  'send-verification-email': 'send',
  // create an account, use a reset token: no email in the request worth counting by
  'sign-up/email': undefined,
  'reset-password': undefined,
}

export type AuthRateLimitBudget = 'send' | 'verify' | 'password'

/** The charge of a POST: `null` when it is free, otherwise the per-identifier budget it also draws from (`undefined` if none). */
export function authChargeFor(pathname: string): { by: AuthRateLimitBudget | undefined } | null {
  const at = pathname.indexOf('/api/auth/')
  if (at < 0) return null
  const route = pathname.slice(at + '/api/auth/'.length).replace(/\/$/, '')
  return Object.prototype.hasOwnProperty.call(CHARGED, route) ? { by: CHARGED[route] } : null
}

/** The key of the per-email budget: the email trimmed and lowercased, hashed so it is never logged or stored in the clear. `null` (a body with no readable email) shares one fixed key per budget. */
export function authIdentifierKey(budget: AuthRateLimitBudget, email: string | null): string {
  if (email === null) return `auth:id:${budget}:unknown`
  const digest = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32)
  return `auth:id:${budget}:${digest}`
}

/**
 * The email in the body (JSON, urlencoded or multipart form, as Better Auth accepts them), read from a clone so the stream
 * Better Auth reads is untouched. `undefined` when the request has no content type (no body), `null` when it has one and no email can be read.
 */
export async function readRequestEmail(req: Request): Promise<string | null | undefined> {
  const type = (req.headers.get('content-type') ?? '').toLowerCase()
  if (!type) return undefined // no content type, no body to read: a request Better Auth refuses anyway
  try {
    let value: unknown
    // Same order as better-call 1.4.0 getBody (dist/utils.mjs), which Better Auth uses to parse the body, so both read the same one:
    // /^application\/([a-z0-9.+-]*\+)?json/i first, then includes() for urlencoded and multipart. A repeated field keeps the last value there.
    if (/^application\/([a-z0-9.+-]*\+)?json/i.test(type)) value = ((await req.clone().json()) as { email?: unknown } | null)?.email
    else if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) value = (await req.clone().formData()).getAll('email').pop()
    const email = typeof value === 'string' ? value.trim() : ''
    return email && email.length <= 320 ? email : null
  } catch {
    return null
  }
}
