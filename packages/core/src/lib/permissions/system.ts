import type { CorePermissionsConfig } from './types'

/**
 * Core Permissions Configuration
 *
 * This file defines:
 * - System permissions (teams, settings, etc.)
 * - Default permissions per role
 * - UI sections for the permissions matrix
 *
 * IMPORTANT: Themes can override these values in their app.config.ts
 */
export const CORE_PERMISSIONS_CONFIG: CorePermissionsConfig = {
  version: '1.0.0',

  /**
   * System permissions (settings, teams, etc.)
   * These are permissions the core needs and knows about
   */
  systemPermissions: [
    // Team Management
    {
      id: 'teams.invite',
      label: 'Invite members',
      description: 'Can send invitations to new team members',
      category: 'Team',
      roles: ['owner', 'admin'],
    },
    {
      id: 'teams.remove_member',
      label: 'Remove members',
      description: 'Can remove members from the team',
      category: 'Team',
      roles: ['owner', 'admin'],
      dangerous: true,
    },
    {
      id: 'teams.change_roles',
      label: 'Change roles',
      description: 'Can change the role of other members',
      category: 'Team',
      roles: ['owner', 'admin'],
    },
    {
      id: 'teams.settings',
      label: 'Team settings',
      description: 'Can modify team name, slug and configuration',
      category: 'Team',
      roles: ['owner', 'admin'],
    },
    {
      id: 'teams.delete',
      label: 'Delete team',
      description: 'Can delete the entire team',
      category: 'Team',
      roles: ['owner'],
      dangerous: true,
    },

    // Settings
    {
      id: 'settings.billing',
      label: 'Billing',
      description: 'Access to billing configuration and payments',
      category: 'Settings',
      roles: ['owner'],
    },
    {
      id: 'settings.api_keys',
      label: 'API Keys',
      description: 'Can create and manage team API keys',
      category: 'Settings',
      roles: ['owner', 'admin'],
    },
    {
      id: 'settings.integrations',
      label: 'Integrations',
      description: 'Can connect and configure external integrations',
      category: 'Settings',
      roles: ['owner', 'admin'],
    },
  ],

  /**
   * Default permissions per role (base before entity configs and theme overrides)
   */
  roleDefaults: {
    owner: ['*'], // Owners have ALL permissions
    admin: [
      'teams.invite',
      'teams.remove_member',
      'teams.change_roles',
      'teams.settings',
      'settings.api_keys',
      'settings.integrations',
    ],
    member: [],  // Permissions come from entity configs
    viewer: [],  // Only read/list of entities
  },

  /**
   * UI sections for the permissions matrix
   */
  uiSections: [
    {
      id: 'team-management',
      label: 'Team Management',
      categories: ['Team'],
    },
    {
      id: 'settings',
      label: 'Settings',
      categories: ['Settings'],
    },
    {
      id: 'entities',
      label: 'Entities',
      description: 'Entity-specific permissions',
      categories: [], // Filled dynamically from entities
    },
  ],
}
