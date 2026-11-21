/** The registration-gates permissions registry, with `posts.read` and `posts.list` for a team owner (the author in the test). */
import { ROLE_PERMISSIONS_ARRAY as BASE } from '../registration-gates/permissions-registry'

export * from '../registration-gates/permissions-registry'

export const ROLE_PERMISSIONS_ARRAY: Record<string, string[]> = { ...BASE, owner: [...BASE.owner, 'posts.read', 'posts.list'] }
export const PERMISSIONS_BY_ROLE: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS_ARRAY).map(([role, perms]) => [role, new Set(perms)])
)
export const ALL_PERMISSIONS: string[] = Array.from(new Set(Object.values(ROLE_PERMISSIONS_ARRAY).flat()))
export const ALL_PERMISSIONS_SET: Set<string> = new Set(ALL_PERMISSIONS)
