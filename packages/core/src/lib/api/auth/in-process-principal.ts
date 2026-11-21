/**
 * A principal the server resolved itself and hands to a handler it calls in process (#541).
 *
 * The MCP endpoint verifies an OAuth access token once, then runs each tool by calling the real API handler with a
 * request it builds. That request carries no credential: the verified principal is attached to the request object
 * here, and `authenticateRequest` reads it back. The map is keyed by object identity and never leaves the process,
 * so nothing sent over HTTP can set or imitate it, and the access token (issued for `/api/mcp` only) is never
 * presented to another route.
 */
import type { DualAuthResult } from './dual-auth'

const principals = new WeakMap<Request, DualAuthResult>()

/** The per-credential rate-limit key of an OAuth principal: the client acting for the user. */
export function oauthRateLimitKey(principal: DualAuthResult): string {
  return `oauth:${principal.oauth?.clientId ?? 'unknown'}:${principal.user?.id ?? 'unknown'}`
}

export function attachInProcessPrincipal(request: Request, principal: DualAuthResult): void {
  principals.set(request, principal)
}

export function inProcessPrincipal(request: Request): DualAuthResult | undefined {
  return principals.get(request)
}
