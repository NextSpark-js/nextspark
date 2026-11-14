/**
 * Fixed email sign-in code for end-to-end runs (#448)
 *
 * NEXTSPARK_E2E_FIXED_OTP=<digits> makes the emailOTP plugin issue that code instead of a random one, so an E2E
 * suite can sign in by code without reading an inbox. Only the code changes: Better Auth still stores it with the
 * usual expiry, counts failed attempts and rate limits the routes. lib/auth.ts sends no email while it is on.
 *
 * The variable is the explicit signal; nothing is inferred from the host or the URL. A production build refuses it
 * (the build's auth check, the startup hook, and lib/auth.ts when it loads all fail with this module's message), unless
 * a second variable set on purpose next to it names the deployment as a preview one (#460):
 * NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT=preview, that exact value. A deployment its host marks as production
 * (VERCEL_ENV=production) refuses the code whatever else is set. e2eFixedOtpRefusal() is the one decision.
 *
 * Pure: no `server-only`, so the build check and tests can import it. Messages never include the value.
 */

export const E2E_FIXED_OTP_ENV = 'NEXTSPARK_E2E_FIXED_OTP'

type Env = Record<string, string | undefined>

/** Set at all (a non-empty value), whatever the environment. */
export function isE2eFixedOtpSet(env: Env = process.env): boolean {
  return Boolean(env[E2E_FIXED_OTP_ENV])
}

/** The second signal: a production build accepts the code only when this is exactly E2E_FIXED_OTP_PREVIEW. */
export const E2E_FIXED_OTP_DEPLOYMENT_ENV = 'NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT'
export const E2E_FIXED_OTP_PREVIEW = 'preview'

export const E2E_FIXED_OTP_PRODUCTION_MESSAGE =
  `${E2E_FIXED_OTP_ENV} is set, and production refuses it: it is for end-to-end runs against a development server, or a preview deployment that also sets ${E2E_FIXED_OTP_DEPLOYMENT_ENV}=${E2E_FIXED_OTP_PREVIEW}. Unset it in this environment.`

export const E2E_FIXED_OTP_PRODUCTION_DEPLOYMENT_MESSAGE =
  `${E2E_FIXED_OTP_ENV} is set on a production deployment (VERCEL_ENV=production), which refuses it whatever else is set. Unset it in this environment.`

/** What lib/auth.ts and the startup hook add to their warnings when a production build serves the code. */
export const E2E_FIXED_OTP_PREVIEW_WARNING =
  `WARNING: this is a production build, and ${E2E_FIXED_OTP_DEPLOYMENT_ENV}=${E2E_FIXED_OTP_PREVIEW} makes it accept the fixed code for every address. Never set either variable on a production deployment.`

export type E2eFixedOtpRefusal = {
  code: 'E2E_FIXED_OTP_IN_PRODUCTION' | 'E2E_FIXED_OTP_ON_PRODUCTION_DEPLOYMENT'
  message: string
}

/**
 * Why the fixed code must not be served here, or null when it may (#460). The one decision, shared by lib/auth.ts,
 * the startup hook and the build's auth check. `productionBuild`: the caller's view of whether this is a production
 * build. The host's production marker refuses always; a production build needs the preview signal, exact value only.
 */
export function e2eFixedOtpRefusal(env: Env, productionBuild: boolean): E2eFixedOtpRefusal | null {
  if (env.VERCEL_ENV === 'production') {
    return { code: 'E2E_FIXED_OTP_ON_PRODUCTION_DEPLOYMENT', message: E2E_FIXED_OTP_PRODUCTION_DEPLOYMENT_MESSAGE }
  }
  if (productionBuild && env[E2E_FIXED_OTP_DEPLOYMENT_ENV] !== E2E_FIXED_OTP_PREVIEW) {
    return { code: 'E2E_FIXED_OTP_IN_PRODUCTION', message: E2E_FIXED_OTP_PRODUCTION_MESSAGE }
  }
  return null
}

/**
 * The fixed code to issue, or null when the variable is unset or empty.
 * Throws when e2eFixedOtpRefusal() refuses it (a production build is NODE_ENV=production, which `next build` and
 * `next start` set) and when the value is not exactly `otpLength` digits.
 */
export function resolveE2eFixedOtp(env: Env, otpLength: number): string | null {
  const value = env[E2E_FIXED_OTP_ENV]
  if (!value) return null
  // The literal `process.env.NODE_ENV` is on purpose: Next inlines it as "production" in a production build, so a
  // build started with another NODE_ENV at runtime (and a project instrumentation that skips core's register()) still
  // refuses the code without the preview signal. `env.NODE_ENV` covers the runtime value.
  const refusal = e2eFixedOtpRefusal(env, env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production')
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
