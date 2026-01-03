/**
 * Default Theme - Permissions Configuration
 *
 * SINGLE SOURCE OF TRUTH for all permissions and roles in this theme.
 *
 * This file defines:
 * - roles: Custom roles beyond core (owner, admin, member, viewer)
 * - teams: Team-level permissions (team.view, team.edit, etc.)
 * - entities: Entity CRUD permissions (customers, tasks, etc.)
 * - features: Theme-specific feature permissions (page-builder, blog, media)
 *
 * All sections use unified format: { action: '...', roles: [...] }
 *
 * Use PermissionService.canDoAction(role, action) to check any permission.
 */

import type { ThemePermissionsConfig } from '@nextsparkjs/core/lib/permissions/types'

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // ==========================================
  // CUSTOM ROLES
  // ==========================================
  // Roles beyond core (owner, admin, member, viewer)
  roles: {
    additionalRoles: ['editor'] as const,
    hierarchy: {
      editor: 5, // Between viewer (1) and member (10)
    },
    displayNames: {
      editor: 'common.teamRoles.editor',
    },
    descriptions: {
      editor: 'Can view team content but has limited editing capabilities',
    },
  },

  // ==========================================
  // TEAM PERMISSIONS
  // ==========================================
  // Unified format: { action, label, description, roles, dangerous? }
  teams: [
    // View permissions
    { action: 'team.view', label: 'View Team', description: 'Can view team details', roles: ['owner', 'admin', 'member', 'viewer', 'editor'] },
    { action: 'team.members.view', label: 'View Members', description: 'Can see team member list', roles: ['owner', 'admin', 'member', 'viewer', 'editor'] },
    { action: 'team.settings.view', label: 'View Settings', description: 'Can view team settings', roles: ['owner', 'admin', 'member', 'editor'] },
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
  entities: {
    // ------------------------------------------
    // CUSTOMERS
    // ------------------------------------------
    customers: [
      { action: 'create', label: 'Create customers', description: 'Can create new customers', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View customers', description: 'Can view customer details', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'list', label: 'List customers', description: 'Can see the customers list', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'update', label: 'Edit customers', description: 'Can modify customer information', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete customers', description: 'Can delete customers', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // TASKS
    // Note: Editor does NOT have access to tasks (per business rules)
    // ------------------------------------------
    tasks: [
      { action: 'create', label: 'Create tasks', description: 'Can create new tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View tasks', description: 'Can view task details', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List tasks', description: 'Can see the tasks list', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit tasks', description: 'Can modify task information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete tasks', description: 'Can delete tasks', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', label: 'Assign tasks', description: 'Can assign tasks to team members', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // POSTS
    // ------------------------------------------
    posts: [
      { action: 'create', label: 'Create Posts', description: 'Can create new blog posts', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View Posts', description: 'Can view post details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List Posts', description: 'Can see the posts list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit Posts', description: 'Can modify post content', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete Posts', description: 'Can delete posts', roles: ['owner', 'admin'], dangerous: true },
      { action: 'publish', label: 'Publish Posts', description: 'Can publish posts to make them public', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // PAGES
    // ------------------------------------------
    pages: [
      { action: 'create', label: 'Create Pages', description: 'Can create new pages', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View Pages', description: 'Can view page details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List Pages', description: 'Can see the pages list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit Pages', description: 'Can modify page content', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete Pages', description: 'Can delete pages', roles: ['owner', 'admin'], dangerous: true },
      { action: 'publish', label: 'Publish Pages', description: 'Can publish pages to make them public', roles: ['owner', 'admin'] },
    ],
  },

  // ==========================================
  // FEATURE PERMISSIONS
  // ==========================================
  // Unified format: uses 'action' instead of 'id'
  features: [
    // AI ASSISTANT
    {
      action: 'ai.access',
      label: 'Access AI Assistant',
      description: 'Can access the AI chat assistant',
      category: 'AI Assistant',
      roles: ['owner', 'admin', 'member'],
    },
    {
      action: 'ai.chat',
      label: 'Send Messages',
      description: 'Can send messages to the AI assistant',
      category: 'AI Assistant',
      roles: ['owner', 'admin', 'member'],
    },
    {
      action: 'ai.history',
      label: 'View Chat History',
      description: 'Can view past conversations with AI assistant',
      category: 'AI Assistant',
      roles: ['owner', 'admin', 'member'],
    },
    {
      action: 'ai.settings',
      label: 'Manage AI Settings',
      description: 'Can configure AI assistant settings and preferences',
      category: 'AI Assistant',
      roles: ['owner', 'admin'],
    },

    // PAGE BUILDER
    {
      action: 'page-builder.access',
      label: 'Access Page Builder',
      description: 'Can use the visual page builder to create and edit content',
      category: 'Page Builder',
      roles: ['owner', 'admin', 'editor', 'member'],
    },
    {
      action: 'page-builder.manage-blocks',
      label: 'Manage Blocks',
      description: 'Can add, remove, and configure blocks in the page builder',
      category: 'Page Builder',
      roles: ['owner', 'admin'],
    },
    {
      action: 'page-builder.custom-css',
      label: 'Custom CSS',
      description: 'Can add custom CSS styles to pages and blocks',
      category: 'Page Builder',
      roles: ['owner', 'admin'],
      dangerous: true,
    },

    // BLOG PUBLISHING
    {
      action: 'blog.schedule',
      label: 'Schedule Posts',
      description: 'Can schedule posts for future publication',
      category: 'Blog',
      roles: ['owner', 'admin'],
    },
    {
      action: 'blog.featured',
      label: 'Feature Posts',
      description: 'Can mark posts as featured for homepage display',
      category: 'Blog',
      roles: ['owner', 'admin'],
    },

    // MEDIA MANAGEMENT
    {
      action: 'media.upload',
      label: 'Upload Media',
      description: 'Can upload images, videos, and other media files',
      category: 'Media',
      roles: ['owner', 'admin', 'editor', 'member'],
    },
    {
      action: 'media.delete',
      label: 'Delete Media',
      description: 'Can permanently delete media files',
      category: 'Media',
      roles: ['owner', 'admin'],
      dangerous: true,
    },
  ],

  // ==========================================
  // UI SECTIONS
  // ==========================================
  uiSections: [
    {
      id: 'ai',
      label: 'AI Assistant',
      description: 'AI-powered assistant features',
      categories: ['AI Assistant'],
    },
    {
      id: 'teams',
      label: 'Teams',
      description: 'Team management permissions',
      categories: ['Teams'],
    },
    {
      id: 'page-builder',
      label: 'Page Builder',
      description: 'Visual content editing features',
      categories: ['Page Builder'],
    },
    {
      id: 'blog',
      label: 'Blog',
      description: 'Blog publishing and management features',
      categories: ['Blog'],
    },
    {
      id: 'media',
      label: 'Media',
      description: 'Media library management',
      categories: ['Media'],
    },
  ],
}

export default PERMISSIONS_CONFIG_OVERRIDES
