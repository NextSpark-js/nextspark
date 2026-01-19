/**
 * Productivity Theme - Permissions Configuration
 *
 * SINGLE SOURCE OF TRUTH for all permissions and roles in this theme.
 *
 * This file defines:
 * - teams: Team-level permissions (team.view, team.edit, etc.)
 * - entities: Entity CRUD permissions (boards, lists, cards)
 * - features: Theme-specific feature permissions (archive, reorder, move, assign)
 *
 * All sections use unified format: { action: '...', roles: [...] }
 *
 * Multi-tenant mode with differentiated permissions:
 * - Owner: Full control
 * - Admin: Can manage boards and invite members (future)
 * - Member: Can create/edit cards and lists
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
    { action: 'team.view', label: 'View Team', description: 'Can view team details', roles: ['owner', 'admin', 'member'] },
    { action: 'team.members.view', label: 'View Members', description: 'Can see team member list', roles: ['owner', 'admin', 'member'] },
    { action: 'team.settings.view', label: 'View Settings', description: 'Can view team settings', roles: ['owner', 'admin'] },
    { action: 'team.billing.view', label: 'View Billing', description: 'Can view billing information', roles: ['owner'] },

    // Edit permissions
    { action: 'team.edit', label: 'Edit Team', description: 'Can modify team name and details', roles: ['owner'] },
    { action: 'team.settings.edit', label: 'Edit Settings', description: 'Can modify team settings', roles: ['owner'] },
    { action: 'team.billing.manage', label: 'Manage Billing', description: 'Can manage subscriptions and payments', roles: ['owner'] },

    // Member management - Only owner can manage members in this app
    { action: 'team.members.invite', label: 'Invite Members', description: 'Invite team members to collaborate', roles: ['owner'] },
    { action: 'team.members.remove', label: 'Remove Members', description: 'Can remove team members', roles: ['owner'] },
    { action: 'team.members.update_role', label: 'Update Roles', description: 'Can change member roles', roles: ['owner'] },

    // Dangerous
    { action: 'team.delete', label: 'Delete Team', description: 'Can permanently delete the team', roles: ['owner'], dangerous: true },
  ],

  // ==========================================
  // ENTITY PERMISSIONS
  // ==========================================
  entities: {
    // ------------------------------------------
    // BOARDS
    // ------------------------------------------
    boards: [
      { action: 'create', label: 'Create boards', description: 'Can create new boards', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View boards', description: 'Can view board details', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List boards', description: 'Can see the boards list', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit boards', description: 'Can modify board information', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete boards', description: 'Can delete boards', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // LISTS
    // ------------------------------------------
    lists: [
      { action: 'create', label: 'Create lists', description: 'Can create new lists in boards', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View lists', description: 'Can view list details', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List lists', description: 'Can see the lists in a board', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit lists', description: 'Can modify list information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete lists', description: 'Can delete lists', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // CARDS
    // ------------------------------------------
    cards: [
      { action: 'create', label: 'Create cards', description: 'Can create new cards in lists', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View cards', description: 'Can view card details', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List cards', description: 'Can see the cards in a list', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit cards', description: 'Can modify card information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete cards', description: 'Can delete cards', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // PATTERNS
    // ------------------------------------------
    patterns: [
      { action: 'create', label: 'Create Patterns', description: 'Can create reusable patterns', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View Patterns', description: 'Can view pattern details', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List Patterns', description: 'Can see the patterns list', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit Patterns', description: 'Can modify patterns', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete Patterns', description: 'Can delete patterns', roles: ['owner', 'admin'], dangerous: true },
    ],
  },

  // ==========================================
  // FEATURE PERMISSIONS
  // ==========================================
  // Unified format: uses 'action' instead of 'id'
  features: [
    // Board management
    {
      action: 'boards.archive',
      label: 'Archive boards',
      description: 'Can archive boards to hide them from the main view',
      category: 'Boards',
      roles: ['owner'],
    },
    {
      action: 'boards.settings',
      label: 'Board settings',
      description: 'Can modify board settings like name, description, and color',
      category: 'Boards',
      roles: ['owner'],
    },

    // List management
    {
      action: 'lists.reorder',
      label: 'Reorder lists',
      description: 'Can change the order of lists within a board',
      category: 'Lists',
      roles: ['owner', 'member'],
    },

    // Card management
    {
      action: 'cards.move',
      label: 'Move cards',
      description: 'Can move cards between lists',
      category: 'Cards',
      roles: ['owner', 'member'],
    },
    {
      action: 'cards.assign',
      label: 'Assign cards',
      description: 'Can assign cards to team members',
      category: 'Cards',
      roles: ['owner', 'member'],
    },
  ],

  // ==========================================
  // DISABLED FEATURES
  // ==========================================
  disabled: [
    'settings.api_keys',
    'settings.billing',
  ],

  // ==========================================
  // UI SECTIONS
  // ==========================================
  uiSections: [
    {
      id: 'board-management',
      label: 'Board Management',
      description: 'Permissions for managing boards',
      categories: ['Boards'],
    },
    {
      id: 'list-management',
      label: 'List Management',
      description: 'Permissions for managing lists',
      categories: ['Lists'],
    },
    {
      id: 'card-management',
      label: 'Card Management',
      description: 'Permissions for managing cards',
      categories: ['Cards'],
    },
  ],
}

export default PERMISSIONS_CONFIG_OVERRIDES
