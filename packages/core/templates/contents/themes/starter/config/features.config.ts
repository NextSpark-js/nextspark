/**
 * Starter Theme - Features Configuration
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
  // Business entity CRUD features
  // ===========================================================================

  tasks: {
    name: 'Tasks',
    description: 'Task tracking and assignment',
    category: 'entities',
    icon: 'check-square',
    entities: ['tasks'],
    permissions: ['tasks.*'],
    docs: [],
  },

  // ===========================================================================
  // CONTENT FEATURES
  // Content creation and editing tools
  // ===========================================================================

  'page-builder': {
    name: 'Page Builder',
    description: 'Visual block editor for page content',
    category: 'content',
    icon: 'layout',
    entities: [],
    permissions: ['blocks.*'],
    docs: ['18-page-builder/*'],
  },

  patterns: {
    name: 'Patterns',
    description: 'Reusable block patterns for page builder',
    category: 'content',
    icon: 'grid',
    entities: ['patterns'],
    permissions: ['patterns.*'],
    docs: [],
  },

  // ===========================================================================
  // CORE FEATURES
  // Platform-level features that exist in all themes
  // ===========================================================================

  auth: {
    name: 'Authentication',
    description: 'User authentication, sessions, and account security',
    category: 'core',
    icon: 'shield',
    entities: [],
    permissions: ['auth.*'],
    docs: ['06-authentication/*'],
  },

  teams: {
    name: 'Teams',
    description: 'Multi-tenant team management and membership',
    category: 'core',
    icon: 'users',
    entities: [],
    permissions: ['teams.*', 'members.*', 'invitations.*'],
    docs: ['10-teams/*'],
  },

  // ===========================================================================
  // BILLING FEATURES
  // Plans, subscriptions, and payments
  // ===========================================================================

  plans: {
    name: 'Plans',
    description: 'Plan catalog, comparison, and selection',
    category: 'settings',
    icon: 'credit-card',
    entities: [],
    permissions: ['plans.*'],
    docs: ['19-billing/02-configuration.md', '19-billing/07-pricing-strategies.md'],
  },

  billing: {
    name: 'Billing',
    description: 'Subscription management, payments, and invoices',
    category: 'settings',
    icon: 'receipt',
    entities: [],
    permissions: ['billing.*', 'subscriptions.*', 'invoices.*'],
    docs: ['19-billing/*'],
  },

  // ===========================================================================
  // SETTINGS FEATURES
  // User and team settings
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

  'api-keys': {
    name: 'API Keys',
    description: 'API key generation and management for integrations',
    category: 'settings',
    icon: 'key',
    entities: [],
    permissions: ['api-keys.*'],
    docs: ['05-api/*'],
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
    docs: ['19-restricted-zones/02-admin.md'],
  },

  devtools: {
    name: 'Developer Tools',
    description: 'Development tools, test viewers, and configuration inspectors',
    category: 'admin',
    icon: 'terminal',
    entities: [],
    permissions: ['developer.*'],
    docs: ['19-restricted-zones/03-devtools.md'],
  },
})
