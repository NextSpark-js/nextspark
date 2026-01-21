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
      { action: 'create', label: 'Create Patterns', description: 'Can create reusable patterns', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View Patterns', description: 'Can view pattern details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List Patterns', description: 'Can see the patterns list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit Patterns', description: 'Can modify patterns', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete Patterns', description: 'Can delete patterns', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // TASKS ENTITY
    // ------------------------------------------
    tasks: [
      { action: 'create', label: 'Create tasks', description: 'Can create new tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View tasks', description: 'Can view task details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List tasks', description: 'Can see the tasks list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit tasks', description: 'Can modify task information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete tasks', description: 'Can delete tasks', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', label: 'Assign tasks', description: 'Can assign tasks to team members', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // PAGES ENTITY (uncommented by CLI if pages feature enabled)
    // ------------------------------------------
    // __PAGES_PERMISSIONS_START__
    // pages: [
    //   { action: 'create', label: 'Create Pages', description: 'Can create new pages', roles: ['owner', 'admin'] },
    //   { action: 'read', label: 'View Pages', description: 'Can view page details', roles: ['owner', 'admin', 'member', 'viewer'] },
    //   { action: 'list', label: 'List Pages', description: 'Can see the pages list', roles: ['owner', 'admin', 'member', 'viewer'] },
    //   { action: 'update', label: 'Edit Pages', description: 'Can modify page content', roles: ['owner', 'admin'] },
    //   { action: 'delete', label: 'Delete Pages', description: 'Can delete pages', roles: ['owner', 'admin'], dangerous: true },
    //   { action: 'publish', label: 'Publish Pages', description: 'Can publish pages to make them public', roles: ['owner', 'admin'] },
    // ],
    // __PAGES_PERMISSIONS_END__

    // ------------------------------------------
    // POSTS ENTITY (uncommented by CLI if blog feature enabled)
    // ------------------------------------------
    // __POSTS_PERMISSIONS_START__
    // posts: [
    //   { action: 'create', label: 'Create Posts', description: 'Can create new blog posts', roles: ['owner', 'admin', 'member'] },
    //   { action: 'read', label: 'View Posts', description: 'Can view post details', roles: ['owner', 'admin', 'member', 'viewer'] },
    //   { action: 'list', label: 'List Posts', description: 'Can see the posts list', roles: ['owner', 'admin', 'member', 'viewer'] },
    //   { action: 'update', label: 'Edit Posts', description: 'Can modify post content', roles: ['owner', 'admin', 'member'] },
    //   { action: 'delete', label: 'Delete Posts', description: 'Can delete posts', roles: ['owner', 'admin'], dangerous: true },
    //   { action: 'publish', label: 'Publish Posts', description: 'Can publish posts to make them public', roles: ['owner', 'admin'] },
    // ],
    // __POSTS_PERMISSIONS_END__
  },
}

export default PERMISSIONS_CONFIG_OVERRIDES
