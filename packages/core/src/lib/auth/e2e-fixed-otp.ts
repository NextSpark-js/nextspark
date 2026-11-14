/**
 * Fixed email sign-in code for end-to-end runs (#448)
 *
 * NEXTSPARK_E2E_FIXED_OTP=<digits> makes the emailOTP plugin issue that code instead of a random one, so an E2E
 * suite can sign in by code without reading an inbox. Only the code changes: Better Auth still stores it with the
 * usual expiry, counts failed attempts and rate limits the routes. lib/auth.ts sends no email while it is on.
 *
 * The variable is the explicit signal; nothing turns the code on without it. It works in a development server and in
 * a production build alike (a deployed preview or QA build, #460), where the startup hook, every send and the build's
 * auth check warn that a fixed code is active. A deployment its host marks as production (VERCEL_ENV=production)
 * refuses it, whatever else is set: lib/auth.ts throws when it loads, the server does not start and the build fails.
 * e2eFixedOtpRefusal() is the one decision. Off Vercel nothing tells a production deployment apart: keep the variable
 * out of the production environment.
 *
 * Pure: no `server-only`, so the build check and tests can import it. Messages never include the value.
 */

export const E2E_FIXED_OTP_ENV = 'NEXTSPARK_E2E_FIXED_OTP'

type Env = Record<string, string | undefined>

/** Set at all (a non-empty value), whatever the environment. */
export function isE2eFixedOtpSet(env: Env = process.env): boolean {
  return Boolean(env[E2E_FIXED_OTP_ENV])
}

export const E2E_FIXED_OTP_PRODUCTION_DEPLOYMENT_MESSAGE =
  `${E2E_FIXED_OTP_ENV} is set on a production deployment (VERCEL_ENV=production), which refuses it whatever else is set. Unset it in this environment.`

/** What lib/auth.ts and the startup hook add to their warnings in a production build. */
export const E2E_FIXED_OTP_PRODUCTION_BUILD_WARNING =
  `WARNING: a fixed sign-in code is active on a production build, for every address. Never set ${E2E_FIXED_OTP_ENV} in the production environment.`

export type E2eFixedOtpRefusal = {
  code: 'E2E_FIXED_OTP_ON_PRODUCTION_DEPLOYMENT'
  message: string
}

/**
 * Why the fixed code must not be served here, or null when it may (#460). The one decision, shared by lib/auth.ts,
 * the startup hook and the build's auth check: the host's production marker refuses it; nothing else does.
 */
export function e2eFixedOtpRefusal(env: Env): E2eFixedOtpRefusal | null {
  if (env.VERCEL_ENV === 'production') {
    return { code: 'E2E_FIXED_OTP_ON_PRODUCTION_DEPLOYMENT', message: E2E_FIXED_OTP_PRODUCTION_DEPLOYMENT_MESSAGE }
  }
  return null
}

/**
 * The fixed code to issue, or null when the variable is unset or empty.
 * Throws when e2eFixedOtpRefusal() refuses it and when the value is not exactly `otpLength` digits.
 */
export function resolveE2eFixedOtp(env: Env, otpLength: number): string | null {
  const value = env[E2E_FIXED_OTP_ENV]
  if (!value) return null
  const refusal = e2eFixedOtpRefusal(env)
  if (refusal) throw new Error(refusal.message)
  if (!/^\d+$/.test(value) || value.length !== otpLength) {
    throw new Error(`${E2E_FIXED_OTP_ENV} must be exactly ${otpLength} digits, the code length (auth.otp.otpLength).`)
  }
  return value
}

/** The emailOTP plugin options for the fixed code: `{ generateOTP }` when it is on, `{}` otherwise. */
export function e2eFixedOtpPluginOptions(env: Env, otpLength: number): { generateOTP?: () => string } {
  const code = resolveE2eFixedOtp(env, otpLength)
  return code ? { generateOTP: () => code } : {}
}
