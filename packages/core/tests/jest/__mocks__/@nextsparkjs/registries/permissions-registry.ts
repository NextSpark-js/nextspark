/**
 * Mock for @nextsparkjs/registries/permissions-registry
 *
 * AVAILABLE_ROLES represents team roles (not global user roles).
 * Includes 'editor' to match the default theme's additionalRoles.
 */

export const AVAILABLE_ROLES = ['owner', 'admin', 'editor', 'member', 'viewer'] as const
export const DEFAULT_TEAM_ROLE = 'member'
export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 50,
  editor: 30,
  member: 10,
  viewer: 1,
}
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  owner: 'common.teamRoles.owner',
  admin: 'common.teamRoles.admin',
  editor: 'common.teamRoles.editor',
  member: 'common.teamRoles.member',
  viewer: 'common.teamRoles.viewer',
}
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full team control, cannot be removed',
  admin: 'Manage team members and settings',
  editor: 'Can edit content but not manage team',
  member: 'Standard team access',
  viewer: 'Read-only access to team resources',
}

export const TEAM_PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  owner: ['team.view', 'team.edit', 'team.delete', 'team.members.view', 'team.members.invite', 'team.members.remove', 'team.members.update_role', 'team.settings.view', 'team.settings.edit'],
  admin: ['team.view', 'team.edit', 'team.members.view', 'team.members.invite', 'team.members.remove', 'team.members.update_role', 'team.settings.view', 'team.settings.edit'],
  editor: ['team.view', 'team.edit', 'team.members.view'],
  member: ['team.view', 'team.members.view'],
  viewer: ['team.view'],
}

// Entity permissions used by service tests (mirrors the default theme's customers entity)
const ENTITY_PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  owner: ['customers.create', 'customers.read', 'customers.list', 'customers.update', 'customers.delete'],
  admin: ['customers.create', 'customers.read', 'customers.list', 'customers.update'],
  editor: ['customers.read', 'customers.list'],
  member: ['customers.read', 'customers.list'],
  viewer: [],
}

export const ROLE_PERMISSIONS_ARRAY: Record<string, string[]> = Object.fromEntries(
  AVAILABLE_ROLES.map((role) => [
    role,
    [...(TEAM_PERMISSIONS_BY_ROLE[role] ?? []), ...(ENTITY_PERMISSIONS_BY_ROLE[role] ?? [])],
  ])
)

export const PERMISSIONS_BY_ROLE: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS_ARRAY).map(([role, perms]) => [role, new Set(perms)])
)

export const ALL_PERMISSIONS: string[] = Array.from(new Set(Object.values(ROLE_PERMISSIONS_ARRAY).flat()))
export const ALL_PERMISSIONS_SET: Set<string> = new Set(ALL_PERMISSIONS)
