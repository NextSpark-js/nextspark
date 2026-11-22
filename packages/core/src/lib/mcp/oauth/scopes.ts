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
 * What a client is told to ask for when it connects: read access to every entity, and `offline_access`, without
 * which the authorization server issues no refresh token and the connection ends with its first access token.
 *
 * A client that is told nothing asks for every scope the resource lists, writes and deletes included, and for no
 * refresh token (the MCP authorization spec: the challenge's `scope`, else the resource's `scopes_supported`).
 * Write and delete are asked for when a call needs them: the 403 names the scope and the client steps up.
 */
export function mcpOAuthDefaultScopes(): string[] {
  return ['offline_access', ...mcpOAuthResourceScopes().filter(scope => scope.endsWith(':read'))]
}

/**
 * What a client is told to ask for when a call needs scopes it was not granted: those, with what it already has and
 * `offline_access`, so that authorizing again with exactly this list loses nothing.
 */
export function mcpOAuthStepUpScopes(granted: readonly string[], missing: readonly string[]): string[] {
  return ['offline_access', ...[...new Set([...granted, ...missing])].sort()]
}
