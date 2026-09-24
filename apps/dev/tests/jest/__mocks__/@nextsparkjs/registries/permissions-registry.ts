/**
 * Mock Permissions Registry for Jest tests
 */

export type Permission = string

export interface ResolvedPermission {
  id: string
  label: string
  description: string
  category: string
  roles: string[]
  dangerous: boolean
  source: 'core' | 'theme'
  disabled?: boolean
}

export interface PermissionUISection {
  id: string
  label: string
  description: string
  categories: string[]
}

export interface RolesConfig {
  additionalRoles?: string[]
  hierarchy?: Record<string, number>
  displayNames?: Record<string, string>
  descriptions?: Record<string, string>
}

// Mock permissions data
export const ALL_RESOLVED_PERMISSIONS: ResolvedPermission[] = [
  {
    id: 'tasks.create',
    label: 'Create tasks',
    description: 'Can create new tasks',
    category: 'Tasks',
    roles: ['owner', 'admin', 'member'],
    dangerous: false,
    source: 'theme',
  },
  {
    id: 'tasks.read',
    label: 'View tasks',
    description: 'Can view task details',
    category: 'Tasks',
    roles: ['owner', 'admin', 'member'],
    dangerous: false,
    source: 'theme',
  },
  {
    id: 'tasks.update',
    label: 'Edit tasks',
    description: 'Can modify task information',
    category: 'Tasks',
    roles: ['owner', 'admin', 'member'],
    dangerous: false,
    source: 'theme',
  },
  {
    id: 'tasks.delete',
    label: 'Delete tasks',
    description: 'Can delete tasks',
    category: 'Tasks',
    roles: ['owner', 'admin'],
    dangerous: true,
    source: 'theme',
  },
]

export const ALL_PERMISSIONS: Permission[] = ALL_RESOLVED_PERMISSIONS.map(p => p.id)

export const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS)

export const AVAILABLE_ROLES: readonly string[] = ['owner', 'admin', 'editor', 'member', 'viewer']

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

export const CUSTOM_ROLES: RolesConfig = {
  additionalRoles: ['editor'],
  hierarchy: { editor: 30 },
  displayNames: { editor: 'common.teamRoles.editor' },
  descriptions: { editor: 'Can edit content but not manage team' },
}

export const PERMISSIONS_BY_ROLE: Record<string, Set<Permission>> = {
  owner: new Set(ALL_PERMISSIONS),
  admin: new Set(['tasks.create', 'tasks.read', 'tasks.update', 'tasks.delete']),
  editor: new Set(['tasks.create', 'tasks.read', 'tasks.update']),
  member: new Set(['tasks.create', 'tasks.read', 'tasks.update']),
  viewer: new Set(['tasks.read']),
}

export const ROLE_PERMISSIONS_ARRAY: Record<string, Permission[]> = {
  owner: [...ALL_PERMISSIONS],
  admin: ['tasks.create', 'tasks.read', 'tasks.update', 'tasks.delete'],
  editor: ['tasks.create', 'tasks.read', 'tasks.update'],
  member: ['tasks.create', 'tasks.read', 'tasks.update'],
  viewer: ['tasks.read'],
}

export const PERMISSIONS_BY_CATEGORY: Record<string, ResolvedPermission[]> = {
  Tasks: ALL_RESOLVED_PERMISSIONS,
}

export const FULL_MATRIX: Record<Permission, Record<string, boolean>> = {}
for (const perm of ALL_RESOLVED_PERMISSIONS) {
  FULL_MATRIX[perm.id] = {}
  for (const role of AVAILABLE_ROLES) {
    FULL_MATRIX[perm.id][role] = PERMISSIONS_BY_ROLE[role]?.has(perm.id) ?? false
  }
}

export const UI_SECTIONS: PermissionUISection[] = [
  {
    id: 'entities',
    label: 'Entities',
    description: 'Entity-specific permissions',
    categories: ['Tasks'],
  },
]

export const TEAM_PERMISSIONS_RAW = []
export const TEAM_PERMISSIONS_BY_ROLE: Record<string, string[]> = {}

export const PERMISSIONS_METADATA = {
  totalPermissions: ALL_PERMISSIONS.length,
  corePermissions: 0,
  teamPermissions: 0,
  featurePermissions: 0,
  entityPermissions: ALL_RESOLVED_PERMISSIONS.length,
  customRoles: 0,
  availableRoles: AVAILABLE_ROLES.length,
  categories: Object.keys(PERMISSIONS_BY_CATEGORY).length,
  generatedAt: new Date().toISOString(),
  theme: 'default',
}
