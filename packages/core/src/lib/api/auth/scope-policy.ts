/**
 * API-key scope policy (#93)
 *
 * Shared by both auth entry points — `authenticateRequest` (dual-auth.ts) and
 * `validateAndAuthenticateRequest` (helpers.ts) — so the rule cannot drift
 * between them. Pure: no I/O, no framework imports.
 *
 * The rule, applied only to API-key authentication (sessions carry no scopes
 * and are never gated here):
 *
 *   1. The route declared `{ requiredScope }` → the key must hold one of the
 *      listed scopes (or the wildcard `*`). Otherwise `INSUFFICIENT_SCOPE`.
 *   2. The route declared `{ allowAnyScope: true }` → any valid key passes.
 *      This is the explicit, self-documenting opt-out for routes that are
 *      genuinely scope-agnostic (a public route that only *enriches* its
 *      answer for authenticated callers, an MCP transport whose tools enforce
 *      scopes themselves, ...).
 *   3. The route declared nothing → the key is rejected with
 *      `SCOPE_NOT_DECLARED` and the route is named in the server log.
 *
 * Rule 3 is the point of the change: forgetting a declaration now produces a
 * visible 403 on an integration instead of a silently over-privileged
 * credential. Before, `scopes` were populated and nobody was obliged to look.
 */

export type DualAuthFailureCode =
  | 'AUTHENTICATION_FAILED'
  | 'INSUFFICIENT_SCOPE'
  | 'SCOPE_NOT_DECLARED'

export interface DualAuthFailure {
  code: DualAuthFailureCode
  /** 401 when no usable credential was presented, 403 when a valid key was rejected on scope. */
  status: 401 | 403
  message: string
}

export interface AuthenticateOptions {
  /**
   * Scope(s) an API key must hold to use this route. A string requires that
   * scope; an array is satisfied by any one of its entries. Ignored for
   * session auth. An empty array counts as "nothing declared".
   */
  requiredScope?: string | string[]
  /**
   * Accept any valid API key regardless of its scopes. Explicit opt-out of
   * fail-closed enforcement — say why in a comment at the call site.
   * A declared `requiredScope` still wins if both are set.
   */
  allowAnyScope?: boolean
}

/** Failure attached to a result that carried no usable credential at all. */
export function authenticationFailed(): DualAuthFailure {
  return { code: 'AUTHENTICATION_FAILED', status: 401, message: 'Authentication required' }
}

export function normalizeRequiredScopes(requiredScope: AuthenticateOptions['requiredScope']): string[] {
  if (requiredScope === undefined) return []
  return (Array.isArray(requiredScope) ? requiredScope : [requiredScope]).filter(
    (scope): scope is string => typeof scope === 'string' && scope.length > 0,
  )
}

/**
 * True when `scopes` (an API key's stored scopes) satisfy `requiredScope`:
 * holds one of the required scopes, or the wildcard `*`. An empty requirement
 * is never satisfied — "no scope needed" must be said with `allowAnyScope`,
 * not with an empty list.
 */
export function scopesSatisfy(
  scopes: readonly string[] | undefined,
  requiredScope: string | string[],
): boolean {
  const required = normalizeRequiredScopes(requiredScope)
  if (required.length === 0 || !scopes) return false
  return scopes.includes('*') || required.some((scope) => scopes.includes(scope))
}

/** Minimal request shape needed to name a route in logs (works for mocks too). */
export interface RouteDescribable {
  method?: string
  url?: string
  nextUrl?: { pathname: string }
}

export function describeRoute(request: RouteDescribable): string {
  let pathname = request.nextUrl?.pathname
  if (!pathname && request.url) {
    try {
      pathname = new URL(request.url).pathname
    } catch {
      pathname = request.url
    }
  }
  return `${request.method ?? 'GET'} ${pathname ?? '<unknown route>'}`
}

/**
 * Apply the policy to an already-authenticated API key.
 *
 * @returns null when the key may proceed, otherwise the failure to report.
 */
export function resolveApiKeyScopeFailure(
  scopes: readonly string[] | undefined,
  options: AuthenticateOptions,
  route: string,
): DualAuthFailure | null {
  const required = normalizeRequiredScopes(options.requiredScope)

  if (required.length > 0) {
    if (scopesSatisfy(scopes, required)) return null
    return {
      code: 'INSUFFICIENT_SCOPE',
      status: 403,
      message: `API key lacks required scope '${required.join("' or '")}'`,
    }
  }

  if (options.allowAnyScope) return null

  console.error(
    `[auth] ${route} did not declare a required API key scope; rejecting the API-key request (fail closed). ` +
      'Pass { requiredScope } — or { allowAnyScope: true } if any valid key is really acceptable — to the auth entry point.',
  )
  return {
    code: 'SCOPE_NOT_DECLARED',
    status: 403,
    message: 'API key access is not enabled for this route: it declares no required scope',
  }
}
