/**
 * Starter Theme - Permissions Configuration
 *
 * SINGLE SOURCE OF TRUTH for all permissions and roles in this theme.
 *
 * This file defines:
 * - roles: Custom roles beyond core (owner, admin, member, viewer)
 * - teams: Team-level permissions (team.view, team.edit, etc.)
 * - entities: Entity CRUD permissions (tasks)
 * - features: Theme-specific feature permissions
 *
 * All sections use unified format: { action: '...', roles: [...] }
 *
 * Use PermissionService.canDoAction(role, action) to check any permission.
 */

import type { ThemePermissionsConfig } from '@nextsparkjs/core/lib/permissions/types'

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // ==========================================
  // TEAM PERMISSIONS
  // ==========================================
  // Unified format: { action, label, description, roles, dangerous? }
  teams: [
    // View permissions
    { action: 'team.view', label: 'View Team', description: 'Can view team details', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'team.members.view', label: 'View Members', description: 'Can see team member list', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'team.settings.view', label: 'View Settings', description: 'Can view team settings', roles: ['owner', 'admin', 'member'] },
    { action: 'team.billing.view', label: 'View Billing', description: 'Can view billing information', roles: ['owner', 'admin'] },

    // Edit permissions
    { action: 'team.edit', label: 'Edit Team', description: 'Can modify team name and details', roles: ['owner', 'admin'] },
    { action: 'team.settings.edit', label: 'Edit Settings', description: 'Can modify team settings', roles: ['owner', 'admin'] },
    { action: 'team.billing.manage', label: 'Manage Billing', description: 'Can manage subscriptions and payments', roles: ['owner'] },

    // Member management
    { action: 'team.members.invite', label: 'Invite Members', description: 'Can invite new team members', roles: ['owner', 'admin'] },
    { action: 'team.members.remove', label: 'Remove Members', description: 'Can remove team members', roles: ['owner', 'admin'] },
    { action: 'team.members.update_role', label: 'Update Roles', description: 'Can change member roles', roles: ['owner', 'admin'] },

    // Dangerous
    { action: 'team.delete', label: 'Delete Team', description: 'Can permanently delete the team', roles: ['owner'], dangerous: true },
  ],

  // ==========================================
  // ENTITY PERMISSIONS
  // ==========================================
  // Define CRUD permissions for each entity in your theme
  entities: {
    // ------------------------------------------
    // PATTERNS ENTITY (Core entity - reusable block compositions)
    // ------------------------------------------
    patterns: [
      { action: 'create', roles: ['owner', 'admin'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // TASKS ENTITY
    // ------------------------------------------
    tasks: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // PAGES ENTITY (bundled with the starter theme by default)
    // ------------------------------------------
    pages: [
      { action: 'create', roles: ['owner', 'admin'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
      { action: 'publish', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // POSTS ENTITY (bundled with the starter theme by default)
    // ------------------------------------------
    posts: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
      { action: 'publish', roles: ['owner', 'admin'] },
    ],
  },
}

export default PERMISSIONS_CONFIG_OVERRIDES
