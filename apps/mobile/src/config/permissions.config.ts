/**
 * Mobile App - Permissions Configuration
 *
 * SINGLE SOURCE OF TRUTH for all permissions and roles.
 * Structure matches web theme: teams, entities, features
 */

// Types (simplified for mobile - no ThemePermissionsConfig import)
interface Permission {
  action: string
  label: string
  description: string
  roles: string[]
  dangerous?: boolean
  category?: string
}

interface PermissionsConfig {
  teams: Permission[]
  entities: {
    tasks: Permission[]
    customers: Permission[]
  }
  features: Permission[]
}

export const PERMISSIONS_CONFIG: PermissionsConfig = {
  // ==========================================
  // TEAM PERMISSIONS
  // ==========================================
  teams: [
    // View permissions
    { action: 'team.view', label: 'View Team', description: 'Can view team details', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'team.members.view', label: 'View Members', description: 'Can see team member list', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'team.settings.view', label: 'View Settings', description: 'Can view team settings', roles: ['owner', 'admin', 'member'] },

    // Edit permissions
    { action: 'team.edit', label: 'Edit Team', description: 'Can modify team name and details', roles: ['owner', 'admin'] },
    { action: 'team.settings.edit', label: 'Edit Settings', description: 'Can modify team settings', roles: ['owner', 'admin'] },

    // Member management
    { action: 'team.members.invite', label: 'Invite Members', description: 'Can invite new team members', roles: ['owner', 'admin'] },
    { action: 'team.members.remove', label: 'Remove Members', description: 'Can remove team members', roles: ['owner', 'admin'] },
  ],

  // ==========================================
  // ENTITY PERMISSIONS
  // ==========================================
  entities: {
    // TASKS
    tasks: [
      { action: 'create', label: 'Create tasks', description: 'Can create new tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View tasks', description: 'Can view task details', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List tasks', description: 'Can see the tasks list', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit tasks', description: 'Can modify task information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete tasks', description: 'Can delete tasks', roles: ['owner', 'admin'], dangerous: true },
    ],

    // CUSTOMERS
    customers: [
      { action: 'create', label: 'Create customers', description: 'Can create new customers', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View customers', description: 'Can view customer details', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List customers', description: 'Can see the customers list', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit customers', description: 'Can modify customer information', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete customers', description: 'Can delete customers', roles: ['owner'], dangerous: true },
    ],
  },

  // ==========================================
  // FEATURE PERMISSIONS
  // ==========================================
  features: [
    // Offline Mode
    {
      action: 'offline.access',
      label: 'Offline Mode',
      description: 'Can use the app in offline mode',
      category: 'Mobile',
      roles: ['owner', 'admin', 'member'],
    },
    // Push Notifications
    {
      action: 'notifications.receive',
      label: 'Push Notifications',
      description: 'Can receive push notifications',
      category: 'Mobile',
      roles: ['owner', 'admin', 'member', 'viewer'],
    },
    // Quick Create
    {
      action: 'quick-create.access',
      label: 'Quick Create',
      description: 'Can use quick create from bottom nav',
      category: 'Mobile',
      roles: ['owner', 'admin', 'member'],
    },
  ],
}

// Helper function (optional - for future use)
export function canDoAction(role: string, action: string): boolean {
  // Check teams
  const teamPerm = PERMISSIONS_CONFIG.teams.find(p => p.action === action)
  if (teamPerm) return teamPerm.roles.includes(role)

  // Check entities
  for (const [entity, perms] of Object.entries(PERMISSIONS_CONFIG.entities)) {
    const entityPerm = perms.find(p => `${entity}.${p.action}` === action)
    if (entityPerm) return entityPerm.roles.includes(role)
  }

  // Check features
  const featurePerm = PERMISSIONS_CONFIG.features.find(p => p.action === action)
  if (featurePerm) return featurePerm.roles.includes(role)

  return false
}

export default PERMISSIONS_CONFIG
