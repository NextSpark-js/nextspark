/**
 * Whether act-as (`x-act-as-user`) can work in this runtime at all. No imports on purpose: the devtools API Explorer page
 * (a server component) reads it, and importing dual-auth there would bring the whole auth stack into that page.
 */

/**
 * True when running in a production runtime. On Vercel this keys on VERCEL_ENV
 * (which separates production from preview); elsewhere it falls back to
 * NODE_ENV. Act-as is hard-blocked whenever this is true.
 */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
  return process.env.NODE_ENV === 'production'
}

/**
 * Not a production runtime (gate 1a of applyActAsOverride) and the explicit opt-in flag set (gate 1b). It does not say a
 * given request is accepted: the caller must be a developer and the target user must exist.
 */
export function isActAsEnabled(): boolean {
  return !isProductionRuntime() && process.env.ALLOW_ACT_AS_USER === 'true'
}
