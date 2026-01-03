/**
 * Blog Theme - Permissions Configuration
 *
 * SINGLE SOURCE OF TRUTH for all permissions and roles in this theme.
 *
 * This file defines:
 * - entities: Entity CRUD permissions (posts, categories)
 * - features: Theme-specific feature permissions (export, import)
 *
 * All sections use unified format: { action: '...', roles: [...] }
 *
 * Single-user blog permissions:
 * - Owner has all permissions
 * - Team collaboration features are disabled
 * - Export/Import features enabled
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
      { action: 'create', label: 'Create posts', description: 'Can create new blog posts', roles: ['owner'] },
      { action: 'read', label: 'View posts', description: 'Can view post details', roles: ['owner'] },
      { action: 'list', label: 'List posts', description: 'Can see the posts list', roles: ['owner'] },
      { action: 'update', label: 'Edit posts', description: 'Can modify post content', roles: ['owner'] },
      { action: 'delete', label: 'Delete posts', description: 'Can delete posts', roles: ['owner'], dangerous: true },
      { action: 'publish', label: 'Publish posts', description: 'Can publish posts to make them public', roles: ['owner'] },
      { action: 'unpublish', label: 'Unpublish posts', description: 'Can unpublish posts to hide them', roles: ['owner'] },
    ],

    // ------------------------------------------
    // CATEGORIES
    // ------------------------------------------
    categories: [
      { action: 'create', label: 'Create categories', description: 'Can create new categories', roles: ['owner'] },
      { action: 'read', label: 'View categories', description: 'Can view category details', roles: ['owner'] },
      { action: 'list', label: 'List categories', description: 'Can see the categories list', roles: ['owner'] },
      { action: 'update', label: 'Edit categories', description: 'Can modify category information', roles: ['owner'] },
      { action: 'delete', label: 'Delete categories', description: 'Can delete categories', roles: ['owner'], dangerous: true },
    ],
  },

  // ==========================================
  // FEATURE PERMISSIONS
  // ==========================================
  // Unified format: uses 'action' instead of 'id'
  features: [
    {
      action: 'blog.export',
      label: 'Export posts',
      description: 'Export all posts to JSON format for backup or migration',
      category: 'Blog',
      roles: ['owner'],
    },
    {
      action: 'blog.import',
      label: 'Import posts',
      description: 'Import posts from JSON file',
      category: 'Blog',
      roles: ['owner'],
      dangerous: true,
    },
  ],

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

  // ==========================================
  // UI SECTIONS
  // ==========================================
  uiSections: [
    {
      id: 'blog-features',
      label: 'Blog Features',
      description: 'Permissions for blog-specific functionality',
      categories: ['Blog'],
    },
  ],
}

export default PERMISSIONS_CONFIG_OVERRIDES
