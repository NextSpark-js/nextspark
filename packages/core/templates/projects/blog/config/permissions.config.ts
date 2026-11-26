/**
 * Blog Theme - Permissions Configuration
 *
 * SINGLE SOURCE OF TRUTH for all permissions and roles in this theme.
 *
 * This file defines:
 * - entities: Entity CRUD permissions (posts, categories)
 *
 * All sections use unified format: { action: '...', roles: [...] }
 *
 * Single-user blog permissions:
 * - Owner has all permissions
 * - Team collaboration features are disabled
 *
 * Use PermissionService.canDoAction(role, action) to check any permission.
 */

import type { ThemePermissionsConfig } from '@nextsparkjs/core/lib/permissions/types'

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // ==========================================
  // ENTITY PERMISSIONS
  // ==========================================
  // Single-user mode: only owner role
  entities: {
    // ------------------------------------------
    // POSTS
    // ------------------------------------------
    posts: [
      { action: 'create', roles: ['owner'] },
      { action: 'read', roles: ['owner'] },
      { action: 'list', roles: ['owner'] },
      { action: 'update', roles: ['owner'] },
      { action: 'delete', roles: ['owner'], dangerous: true },
      { action: 'publish', roles: ['owner'] },
      { action: 'unpublish', roles: ['owner'] },
    ],

    // ------------------------------------------
    // CATEGORIES
    // ------------------------------------------
    categories: [
      { action: 'create', roles: ['owner'] },
      { action: 'read', roles: ['owner'] },
      { action: 'list', roles: ['owner'] },
      { action: 'update', roles: ['owner'] },
      { action: 'delete', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // PATTERNS
    // ------------------------------------------
    patterns: [
      { action: 'create', roles: ['owner'] },
      { action: 'read', roles: ['owner'] },
      { action: 'list', roles: ['owner'] },
      { action: 'update', roles: ['owner'] },
      { action: 'delete', roles: ['owner'], dangerous: true },
    ],
  },

  // ==========================================
  // DISABLED FEATURES
  // ==========================================
  // These don't apply in single-user mode
  disabled: [
    'teams.invite',
    'teams.remove_member',
    'teams.change_roles',
    'teams.delete',
    'settings.api_keys',
    'settings.billing',
  ],
}

export default PERMISSIONS_CONFIG_OVERRIDES
