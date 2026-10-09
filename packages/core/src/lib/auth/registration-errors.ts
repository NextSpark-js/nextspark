/**
 * Registration-policy rejections, as Better Auth APIErrors (403 + a code).
 *
 * A plain Error thrown from a database hook or a plugin hook reaches Better
 * Auth's router as an unknown error and becomes an empty 500; an APIError
 * keeps its status and its `{ code, message }` body.
 */

import { APIError } from 'better-auth'

export type RegistrationErrorCode = 'DOMAIN_NOT_ALLOWED' | 'SIGNUP_RESTRICTED'

const MESSAGES: Record<RegistrationErrorCode, string> = {
  DOMAIN_NOT_ALLOWED: "This email's domain can't sign in here. Use your organization's email.",
  SIGNUP_RESTRICTED: 'Registration requires an invitation. Contact an administrator.',
}

/**
 * `ctx` is the endpoint context Better Auth hands to hooks. The OAuth
 * callback turns a user-creation APIError into `?error=<its message>` on the
 * error page, so on a callback the message is the code itself.
 */
export function registrationError(code: RegistrationErrorCode, ctx?: { path?: string } | null): APIError {
  const onOAuthCallback = ctx?.path?.includes('/callback/') ?? false
  return new APIError('FORBIDDEN', { code, message: onOAuthCallback ? code : MESSAGES[code] })
}

export function isRegistrationRefusal(code: unknown): code is RegistrationErrorCode {
  return typeof code === 'string' && Object.hasOwn(MESSAGES, code)
}
