/**
 * Blog Theme - Features Configuration
 *
 * Defines all features of the application for this theme.
 * Each feature key becomes a tag: @feat-{key}
 *
 * Features are enriched at build-time with:
 * - Entity metadata (from entity-registry)
 * - Permission details (from permissions-registry)
 * - Documentation links (from docs-registry)
 * - Test coverage (from tags-registry + test files)
 */

import { defineFeatures } from '@nextsparkjs/core/lib/config/features-types'

export default defineFeatures({
  // ===========================================================================
  // ENTITY FEATURES
  // Blog-specific entity CRUD features
  // ===========================================================================

  posts: {
    name: 'Posts',
    description: 'Blog posts with rich text editor, featured images, and publishing workflow',
    category: 'entities',
    icon: 'file-text',
    entities: ['posts'],
    permissions: ['posts.*'],
    docs: [],
  },

  categories: {
    name: 'Categories',
    description: 'Post categorization and taxonomy management',
    category: 'entities',
    icon: 'folder',
    entities: ['categories'],
    permissions: ['categories.*'],
    docs: [],
  },

  // ===========================================================================
  // CONTENT FEATURES
  // Content creation and editing tools
  // ===========================================================================

  'post-editor': {
    name: 'Post Editor',
    description: 'WYSIWYG editor for creating and editing blog posts',
    category: 'content',
    icon: 'edit',
    entities: ['posts'],
    permissions: ['posts.create', 'posts.update'],
    docs: [],
  },

  publishing: {
    name: 'Publishing',
    description: 'Post publishing workflow with draft, scheduled, and published states',
    category: 'content',
    icon: 'send',
    entities: ['posts'],
    permissions: ['posts.publish', 'posts.unpublish'],
    docs: [],
  },

  // ===========================================================================
  // IMPORT/EXPORT FEATURES
  // Data management tools
  // ===========================================================================

  'post-export': {
    name: 'Export Posts',
    description: 'Export posts to JSON format for backup or migration',
    category: 'settings',
    icon: 'download',
    entities: ['posts'],
    permissions: ['blog.export'],
    docs: [],
  },

  'post-import': {
    name: 'Import Posts',
    description: 'Import posts from JSON file',
    category: 'settings',
    icon: 'upload',
    entities: ['posts'],
    permissions: ['blog.import'],
    docs: [],
  },

  // ===========================================================================
  // PUBLIC FEATURES
  // Public-facing blog features
  // ===========================================================================

  'public-blog': {
    name: 'Public Blog',
    description: 'Public blog pages including home, post detail, and author pages',
    category: 'public',
    icon: 'globe',
    entities: ['posts', 'categories'],
    permissions: [],
    docs: [],
  },

  authors: {
    name: 'Authors',
    description: 'Author profile pages and author listing',
    category: 'public',
    icon: 'users',
    entities: [],
    permissions: [],
    docs: [],
  },

  // ===========================================================================
  // CORE FEATURES
  // Platform-level features
  // ===========================================================================

  auth: {
    name: 'Authentication',
    description: 'User authentication and account security (single-user mode)',
    category: 'core',
    icon: 'shield',
    entities: [],
    permissions: ['auth.*'],
    docs: [],
  },

  // ===========================================================================
  // SETTINGS FEATURES
  // User settings
  // ===========================================================================

  users: {
    name: 'User Profile',
    description: 'User profile management and preferences',
    category: 'settings',
    icon: 'user',
    entities: [],
    permissions: ['profile.*'],
    docs: [],
  },

  // ===========================================================================
  // BILLING FEATURES
  // Plans and payments
  // ===========================================================================

  plans: {
    name: 'Plans',
    description: 'Plan catalog and selection',
    category: 'settings',
    icon: 'credit-card',
    entities: [],
    permissions: ['plans.*'],
    docs: [],
  },

  billing: {
    name: 'Billing',
    description: 'Subscription management and payments',
    category: 'settings',
    icon: 'receipt',
    entities: [],
    permissions: ['billing.*', 'subscriptions.*'],
    docs: [],
  },

  // ===========================================================================
  // ADMIN FEATURES
  // Superadmin and developer tools
  // ===========================================================================

  superadmin: {
    name: 'Superadmin',
    description: 'Superadmin dashboard and system management',
    category: 'admin',
    icon: 'shield-check',
    entities: [],
    permissions: ['superadmin.*'],
    docs: [],
  },

  devtools: {
    name: 'Developer Tools',
    description: 'Development tools and configuration inspectors',
    category: 'admin',
    icon: 'terminal',
    entities: [],
    permissions: ['developer.*'],
    docs: [],
  },
})
