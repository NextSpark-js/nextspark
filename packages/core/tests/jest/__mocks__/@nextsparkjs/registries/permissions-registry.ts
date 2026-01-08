/**
 * Mock for @nextsparkjs/registries/permissions-registry
 */

export const AVAILABLE_ROLES = ['member', 'superadmin', 'developer'] as const
export const ROLE_HIERARCHY = {
  member: 1,
  superadmin: 99,
  developer: 100,
}
export const ROLE_DISPLAY_NAMES = {
  member: 'common.userRoles.member',
  superadmin: 'common.userRoles.superadmin',
  developer: 'common.userRoles.developer',
}
export const ROLE_DESCRIPTIONS = {
  member: 'Regular user with team-based permissions',
  superadmin: 'Full system access (product owners only)',
  developer: 'Ultimate access (platform developers only)',
}

export const TEAM_PERMISSIONS_BY_ROLE = {
  member: ['view', 'edit'],
  superadmin: ['view', 'edit', 'delete', 'admin'],
  developer: ['view', 'edit', 'delete', 'admin', 'dev'],
}
