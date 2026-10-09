/**
 * Check if rate limiting is disabled via environment variable.
 * Use DISABLE_RATE_LIMITING=true to disable rate limiting (development/testing only).
 * It also turns off Better Auth's own limiter (lib/auth.ts); the per-API-key limit stays.
 * WARNING: Never disable rate limiting in production!
 */
// On globalThis so the server bundles that each load this module log once per process between them.
const WARNED = Symbol.for('nextspark.rateLimitDisabledWarned');
export function isRateLimitingDisabled(): boolean {
  const disabled = process.env.DISABLE_RATE_LIMITING === 'true';
  const state = globalThis as Record<symbol, unknown>;
  if (disabled && !state[WARNED]) {
    console.warn('[RateLimit] WARNING: Rate limiting is DISABLED via DISABLE_RATE_LIMITING=true (per-address limits and the Better Auth sign-in, sign-up and OTP limits). Do not use in production!');
    state[WARNED] = true;
  }
  return disabled;
}
