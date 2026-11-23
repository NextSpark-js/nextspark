/**
 * The scopes of MCP browser sign-in (#541): the vocabulary API keys already use, `<entity>:read|write|delete`.
 */
import { ScopeService } from '../../services/scope.service'
import { mcpToolScopes } from './tool-scopes'

/**
 * The scopes of the resource: every scope a team role can hold that some tool of the MCP server needs. Wildcards
 * are never offered.
 *
 * It is what the authorization server publishes (`scopes_supported`), what it accepts from an application it
 * registers from now on, and what the consent screen offers. A scope no tool needs (an entity kept out of MCP, an
 * operation an entity's `mcp.ts` excludes) is not in it, whatever a client chooses to request.
 *
 * An application registered earlier has the list of that day in its `oauthClient` row, which is what the
 * authorization server checks a request against: until that row is refreshed it can still ask for a scope that
 * was retired since, and hold it. Such a scope does nothing, because no tool needs it.
 */
export function mcpOAuthResourceScopes(): string[] {
  const scopes = new Set<string>(ScopeService.getBaseScopes())
  for (const role of ScopeService.getRoles()) {
    for (const scope of ScopeService.getRoleScopes(role)) scopes.add(scope)
  }
  const usedByTools = new Set(mcpToolScopes())
  return [...scopes].filter(scope => !scope.includes('*') && usedByTools.has(scope)).sort()
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

export { entityScope, isPreselectedScope } from './scope-names'

/**
 * What a client is told to ask for when a call needs scopes it was not granted: those, with what it already has and
 * `offline_access`, so that authorizing again with exactly this list loses nothing.
 */
export function mcpOAuthStepUpScopes(granted: readonly string[], missing: readonly string[]): string[] {
  return ['offline_access', ...[...new Set([...granted, ...missing])].sort()]
}
