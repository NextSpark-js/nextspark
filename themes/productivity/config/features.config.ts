/**
 * Productivity Theme - Features Configuration
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
  // BOARD MANAGEMENT FEATURES
  // Project/workspace organization
  // ===========================================================================

  boards: {
    name: 'Boards',
    description: 'Project boards for organizing work with lists and cards',
    category: 'entities',
    icon: 'layout-dashboard',
    entities: ['boards'],
    permissions: ['boards.*'],
    docs: [],
  },

  'board-settings': {
    name: 'Board Settings',
    description: 'Board configuration including name, description, and visibility',
    category: 'boards',
    icon: 'settings',
    entities: ['boards'],
    permissions: ['boards.settings'],
    docs: [],
  },

  'board-archive': {
    name: 'Board Archive',
    description: 'Archive boards to hide them from the main view',
    category: 'boards',
    icon: 'archive',
    entities: ['boards'],
    permissions: ['boards.archive'],
    docs: [],
  },

  // ===========================================================================
  // LIST MANAGEMENT FEATURES
  // Column/list organization within boards
  // ===========================================================================

  lists: {
    name: 'Lists',
    description: 'Organize cards into lists/columns within boards',
    category: 'entities',
    icon: 'list',
    entities: ['lists'],
    permissions: ['lists.*'],
    docs: [],
  },

  'list-reorder': {
    name: 'List Reorder',
    description: 'Drag and drop lists to reorder within a board',
    category: 'lists',
    icon: 'move',
    entities: ['lists'],
    permissions: ['lists.reorder'],
    docs: [],
  },

  // ===========================================================================
  // CARD MANAGEMENT FEATURES
  // Task/card management
  // ===========================================================================

  cards: {
    name: 'Cards',
    description: 'Task cards with titles, descriptions, and due dates',
    category: 'entities',
    icon: 'credit-card',
    entities: ['cards'],
    permissions: ['cards.*'],
    docs: [],
  },

  'card-move': {
    name: 'Card Move',
    description: 'Drag and drop cards between lists',
    category: 'cards',
    icon: 'move',
    entities: ['cards'],
    permissions: ['cards.move'],
    docs: [],
  },

  'card-assign': {
    name: 'Card Assignment',
    description: 'Assign cards to team members',
    category: 'cards',
    icon: 'user-plus',
    entities: ['cards'],
    permissions: ['cards.assign'],
    docs: [],
  },

  'card-detail': {
    name: 'Card Detail',
    description: 'Card detail modal with full information and editing',
    category: 'cards',
    icon: 'expand',
    entities: ['cards'],
    permissions: ['cards.read', 'cards.update'],
    docs: [],
  },

  // ===========================================================================
  // KANBAN FEATURES
  // Visual board management
  // ===========================================================================

  kanban: {
    name: 'Kanban Board',
    description: 'Visual kanban board interface for managing cards across lists',
    category: 'content',
    icon: 'layout',
    entities: ['boards', 'lists', 'cards'],
    permissions: ['boards.read', 'lists.*', 'cards.*'],
    docs: [],
  },

  'drag-drop': {
    name: 'Drag & Drop',
    description: 'Drag and drop functionality for cards and lists',
    category: 'content',
    icon: 'hand',
    entities: ['lists', 'cards'],
    permissions: ['lists.reorder', 'cards.move'],
    docs: [],
  },

  // ===========================================================================
  // CORE FEATURES
  // Platform-level features
  // ===========================================================================

  auth: {
    name: 'Authentication',
    description: 'User authentication, sessions, and account security',
    category: 'core',
    icon: 'shield',
    entities: [],
    permissions: ['auth.*'],
    docs: [],
  },

  teams: {
    name: 'Teams',
    description: 'Multi-tenant team management with workspace switching',
    category: 'core',
    icon: 'users',
    entities: [],
    permissions: ['teams.*', 'members.*', 'invitations.*'],
    docs: [],
  },

  'team-switch': {
    name: 'Team Switching',
    description: 'Switch between different teams/workspaces',
    category: 'core',
    icon: 'repeat',
    entities: [],
    permissions: ['teams.*'],
    docs: [],
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

  notifications: {
    name: 'Notifications',
    description: 'Notification preferences for card assignments and mentions',
    category: 'settings',
    icon: 'bell',
    entities: [],
    permissions: ['notifications.*'],
    docs: [],
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
    docs: [],
  },

  billing: {
    name: 'Billing',
    description: 'Subscription management, payments, and invoices',
    category: 'settings',
    icon: 'receipt',
    entities: [],
    permissions: ['billing.*', 'subscriptions.*', 'invoices.*'],
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
