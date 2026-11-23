/**
 * The scopes of MCP browser sign-in (#541): the vocabulary API keys already use, `<entity>:read|write|delete`.
 */
import { ScopeService } from '../../services/scope.service'
import { entityScope } from './scope-names'
import { mcpToolScopes } from './tool-scopes'

/**
 * The scopes the authorization server accepts: every entity scope (`<entity>:read|write|delete`) a team role can
 * hold, whether or not a tool needs it today. Wildcards and scopes that are not an entity's are never accepted.
 *
 * It is wider than what the server publishes and offers (`mcpOAuthResourceScopes`) on purpose, and it does not
 * change when a tool is added or removed. A client keeps the list of scopes it discovered the day it was set up
 * (ChatGPT stores it with the connector) and a connection keeps the scopes it was granted: if excluding an
 * operation or an entity from MCP made its scope unknown, that client could no longer authorize and that
 * connection could no longer renew, both with `invalid_scope` and nothing a user can act on. Accepted is not
 * granted: the consent hooks, the tokens issued for the resource and the consent screen all go by the active list.
 */
export function mcpOAuthAcceptedScopes(): string[] {
  const scopes = new Set<string>(ScopeService.getBaseScopes())
  for (const role of ScopeService.getRoles()) {
    for (const scope of ScopeService.getRoleScopes(role)) scopes.add(scope)
  }
  return [...scopes].filter(scope => !scope.includes('*') && entityScope(scope) !== null).sort()
}

/**
 * The scopes of the resource, the active ones: every accepted scope that some tool of the MCP server needs.
 *
 * It is what the server publishes (`scopes_supported` of both metadata documents), what the 401 challenge asks
 * for, what the consent screen offers, what a consent can hold from now on and what a token issued for the
 * resource carries. A scope no tool needs (an entity kept out of MCP, an operation an entity's `mcp.ts`
 * excludes) is not in it, whatever a client asks for: asked for, it is accepted and not granted.
 */
export function mcpOAuthResourceScopes(): string[] {
  const usedByTools = new Set(mcpToolScopes())
  return mcpOAuthAcceptedScopes().filter(scope => usedByTools.has(scope))
}

/** Of `scopes`, the ones that are not an entity's (identity, `offline_access`) and the entity scopes that are active. */
export function activeScopes(scopes: readonly string[]): string[] {
  const active = new Set(mcpOAuthResourceScopes())
  return scopes.filter(scope => entityScope(scope) === null || active.has(scope))
}

/**
 * What a client is told to ask for when it connects: every scope of the resource, and `offline_access`, without
 * which the authorization server issues no refresh token and the connection ends with its first access token (a
 * client that is told nothing asks for the resource's scopes and for no refresh token).
 *
 * Asking is not getting: the consent screen lists them per entity and the user decides (isPreselectedScope). The
 * request has to carry them all because consent can only take scopes away from what was asked for.
 *
 * `usedByTools`: the scopes some tool of the engine at hand needs, to narrow the list further. The resource's
 * scopes are already the ones the tools of the default route need (`mcpToolScopes`).
 */
export function mcpOAuthDefaultScopes(usedByTools?: readonly string[]): string[] {
  const resource = mcpOAuthResourceScopes()
  return ['offline_access', ...(usedByTools ? resource.filter(scope => usedByTools.includes(scope)) : resource)]
}

export { isPreselectedScope } from './scope-names'
export { entityScope }

/**
 * What a client is told to ask for when a call needs scopes it was not granted: those, with what it already has and
 * `offline_access`, so that authorizing again with exactly this list loses nothing.
 *
 * Only active scopes are named: a connection from before a scope was retired may still hold it, and a challenge
 * that named it would publish what the metadata no longer does.
 */
export function mcpOAuthStepUpScopes(granted: readonly string[], missing: readonly string[]): string[] {
  return ['offline_access', ...activeScopes([...new Set([...granted, ...missing])].filter(scope => entityScope(scope) !== null)).sort()]
}
