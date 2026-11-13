/**
 * Fixed email sign-in code for end-to-end runs (#448)
 *
 * NEXTSPARK_E2E_FIXED_OTP=<digits> makes the emailOTP plugin issue that code instead of a random one, so an E2E
 * suite can sign in by code without reading an inbox. Only the code changes: Better Auth still stores it with the
 * usual expiry, counts failed attempts and rate limits the routes. lib/auth.ts sends no email while it is on.
 *
 * The variable is the explicit signal; nothing is inferred from the host or the URL. Production refuses it: a
 * production build or server that sees it fails with this module's message (the build's auth check, the startup
 * hook, and lib/auth.ts when it loads). There is no override, so E2E by code runs against a development server.
 *
 * Pure: no `server-only`, so the build check and tests can import it. Messages never include the value.
 */

export const E2E_FIXED_OTP_ENV = 'NEXTSPARK_E2E_FIXED_OTP'

type Env = Record<string, string | undefined>

/** Set at all (a non-empty value), whatever the environment. */
export function isE2eFixedOtpSet(env: Env = process.env): boolean {
  return Boolean(env[E2E_FIXED_OTP_ENV])
}

export const E2E_FIXED_OTP_PRODUCTION_MESSAGE =
  `${E2E_FIXED_OTP_ENV} is set, and production refuses it: it is for end-to-end runs against a development server. Unset it in this environment.`

/**
 * The fixed code to issue, or null when the variable is unset or empty.
 * Throws in production (NODE_ENV=production, which `next build` and `next start` set) and when the value is not
 * exactly `otpLength` digits.
 */
export function resolveE2eFixedOtp(env: Env, otpLength: number): string | null {
  const value = env[E2E_FIXED_OTP_ENV]
  if (!value) return null
  // The literal `process.env.NODE_ENV` is on purpose: Next inlines it as "production" in a production build, so a
  // build started with another NODE_ENV at runtime (and a project instrumentation that skips core's register()) still
  // refuses the code. `env.NODE_ENV` covers the runtime value and the build check.
  if (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') throw new Error(E2E_FIXED_OTP_PRODUCTION_MESSAGE)
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
