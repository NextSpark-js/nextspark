/**
 * The API scopes a team role holds for the entities the API serves, from the permissions of the role.
 *
 * One rule, in one place: the generated scope registry builds `SCOPE_CONFIG.roles` with it (API keys, and the
 * implicit scopes of a session), and MCP browser sign-in (#541) builds the scopes it accepts and grants with it. A
 * second copy of this mapping would let what a consent grants drift from what the API enforces.
 *
 * No imports: the generated registry imports this module, and so does `lib/auth` through lib/mcp/oauth.
 */

/** A role's permissions as the permissions registry holds them: `<entity>.<action>` ids. */
type PermissionSet = { has(permission: never): boolean } | undefined

/**
 * `<entity>:read` for a role that may list or read the entity, `<entity>:write` for one that may create or update
 * it, `<entity>:delete` for one that may delete it. In the order of `entities`, without duplicates.
 */
export function entityScopesOfRole(entities: readonly string[], permissions: PermissionSet): string[] {
  const has = (permission: string) => permissions?.has(permission as never) === true
  const scopes: string[] = []
  for (const slug of entities) {
    if (has(`${slug}.list`) || has(`${slug}.read`)) scopes.push(`${slug}:read`)
    if (has(`${slug}.create`) || has(`${slug}.update`)) scopes.push(`${slug}:write`)
    if (has(`${slug}.delete`)) scopes.push(`${slug}:delete`)
  }
  return [...new Set(scopes)]
}
