/**
 * Reading the names of the scopes of MCP browser sign-in (#541). No imports: the consent screen loads this in the
 * browser.
 */

/**
 * Whether the consent screen offers a scope already ticked: reading and writing are, deleting is not, so that
 * permission to delete is always something the user chose.
 */
export function isPreselectedScope(scope: string): boolean {
  return !scope.endsWith(':delete')
}

/** `tasks:write` as its entity and action; null for a scope that is not an entity permission. */
export function entityScope(scope: string): { entity: string; action: 'read' | 'write' | 'delete' } | null {
  const match = /^(.+):(read|write|delete)$/.exec(scope)
  return match ? { entity: match[1], action: match[2] as 'read' | 'write' | 'delete' } : null
}
