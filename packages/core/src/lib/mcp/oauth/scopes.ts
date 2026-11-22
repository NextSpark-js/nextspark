/**
 * The scopes of MCP browser sign-in (#541): the vocabulary API keys already use, `<entity>:read|write|delete`.
 */
import { ScopeService } from '../../services/scope.service'

/** Every scope a team role can hold. Wildcards are never offered. */
export function mcpOAuthResourceScopes(): string[] {
  const scopes = new Set<string>(ScopeService.getBaseScopes())
  for (const role of ScopeService.getRoles()) {
    for (const scope of ScopeService.getRoleScopes(role)) scopes.add(scope)
  }
  return [...scopes].filter(scope => !scope.includes('*')).sort()
}

/**
 * What a client is told to ask for when it connects: every scope of the resource, and `offline_access`, without
 * which the authorization server issues no refresh token and the connection ends with its first access token (a
 * client that is told nothing asks for the resource's scopes and for no refresh token).
 *
 * Asking is not getting: the consent screen lists them per entity and the user decides (isPreselectedScope). The
 * request has to carry them all because consent can only take scopes away from what was asked for.
 */
export function mcpOAuthDefaultScopes(): string[] {
  return ['offline_access', ...mcpOAuthResourceScopes()]
}

export { entityScope, isPreselectedScope } from './scope-names'

/**
 * What a client is told to ask for when a call needs scopes it was not granted: those, with what it already has and
 * `offline_access`, so that authorizing again with exactly this list loses nothing.
 */
export function mcpOAuthStepUpScopes(granted: readonly string[], missing: readonly string[]): string[] {
  return ['offline_access', ...[...new Set([...granted, ...missing])].sort()]
}
