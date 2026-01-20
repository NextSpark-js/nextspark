/**
 * CRM Theme - Permissions Configuration
 *
 * SINGLE SOURCE OF TRUTH for all permissions and roles in this theme.
 *
 * This file defines:
 * - teams: Team-level permissions (team.view, team.edit, etc.)
 * - entities: Entity CRUD permissions (leads, contacts, companies, etc.)
 * - features: Theme-specific feature permissions (reports, bulk ops, lead conversion)
 *
 * All sections use unified format: { action: '...', roles: [...] }
 *
 * Single-tenant mode with differentiated permissions:
 * - Owner: CRM Administrator (full control)
 * - Admin: Sales/Marketing Manager (team management + reports)
 * - Member: Sales/Marketing Rep (daily operations)
 * - Viewer: Read-only access
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
    { action: 'team.settings.view', label: 'View Settings', description: 'Can view team settings', roles: ['owner', 'admin'] },
    { action: 'team.billing.view', label: 'View Billing', description: 'Can view billing information', roles: ['owner'] },

    // Edit permissions
    { action: 'team.edit', label: 'Edit Team', description: 'Can modify team name and details', roles: ['owner'] },
    { action: 'team.settings.edit', label: 'Edit Settings', description: 'Can modify team settings', roles: ['owner'] },
    { action: 'team.billing.manage', label: 'Manage Billing', description: 'Can manage subscriptions and payments', roles: ['owner'] },

    // Member management - Owner and Admin can invite in CRM
    { action: 'team.members.invite', label: 'Invite Members', description: 'Invite new team members to the CRM', roles: ['owner', 'admin'] },
    { action: 'team.members.remove', label: 'Remove Members', description: 'Can remove team members', roles: ['owner', 'admin'] },
    { action: 'team.members.update_role', label: 'Update Roles', description: 'Only CRM admins can change user roles', roles: ['owner'] },

    // Dangerous - Disabled in single-tenant
    { action: 'team.delete', label: 'Delete Team', description: 'Cannot delete organization in single-tenant mode', roles: [], dangerous: true },
  ],

  // ==========================================
  // ENTITY PERMISSIONS
  // ==========================================
  entities: {
    // ------------------------------------------
    // LEADS
    // ------------------------------------------
    leads: [
      { action: 'create', label: 'Create leads', description: 'Can create new leads', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View leads', description: 'Can view lead details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List leads', description: 'Can see the leads list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit leads', description: 'Can modify lead information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete leads', description: 'Can delete leads', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', label: 'Assign leads', description: 'Can assign leads to team members', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // CONTACTS
    // ------------------------------------------
    contacts: [
      { action: 'create', label: 'Create contacts', description: 'Can create new contacts', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View contacts', description: 'Can view contact details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List contacts', description: 'Can see the contacts list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit contacts', description: 'Can modify contact information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete contacts', description: 'Can delete contacts', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // COMPANIES
    // ------------------------------------------
    companies: [
      { action: 'create', label: 'Create companies', description: 'Can create new companies', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View companies', description: 'Can view company details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List companies', description: 'Can see the companies list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit companies', description: 'Can modify company information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete companies', description: 'Can delete companies', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // OPPORTUNITIES
    // ------------------------------------------
    opportunities: [
      { action: 'create', label: 'Create opportunities', description: 'Can create new opportunities', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View opportunities', description: 'Can view opportunity details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List opportunities', description: 'Can see the opportunities list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit opportunities', description: 'Can modify opportunity information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete opportunities', description: 'Can delete opportunities', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', label: 'Assign opportunities', description: 'Can assign opportunities to team members', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // ACTIVITIES
    // ------------------------------------------
    activities: [
      { action: 'create', label: 'Create activities', description: 'Can schedule activities', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View activities', description: 'Can view activity details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List activities', description: 'Can see the activities list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit activities', description: 'Can modify activity information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete activities', description: 'Can delete activities', roles: ['owner', 'admin', 'member'], dangerous: true },
    ],

    // ------------------------------------------
    // NOTES
    // ------------------------------------------
    notes: [
      { action: 'create', label: 'Create notes', description: 'Can create notes', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View notes', description: 'Can view notes', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List notes', description: 'Can see notes list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit notes', description: 'Can modify notes', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete notes', description: 'Can delete notes', roles: ['owner', 'admin', 'member'], dangerous: true },
    ],

    // ------------------------------------------
    // CAMPAIGNS
    // ------------------------------------------
    campaigns: [
      { action: 'create', label: 'Create campaigns', description: 'Can create marketing campaigns', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View campaigns', description: 'Can view campaign details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List campaigns', description: 'Can see the campaigns list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit campaigns', description: 'Can modify campaign information', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete campaigns', description: 'Can delete campaigns', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // PRODUCTS
    // ------------------------------------------
    products: [
      { action: 'create', label: 'Create products', description: 'Can add products to catalog', roles: ['owner'] },
      { action: 'read', label: 'View products', description: 'Can view product details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List products', description: 'Can see the products catalog', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit products', description: 'Can modify product information', roles: ['owner'] },
      { action: 'delete', label: 'Delete products', description: 'Can delete products', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // PIPELINES
    // ------------------------------------------
    pipelines: [
      { action: 'create', label: 'Create pipelines', description: 'Can create sales pipelines', roles: ['owner'] },
      { action: 'read', label: 'View pipelines', description: 'Can view pipeline details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List pipelines', description: 'Can see the pipelines list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit pipelines', description: 'Can modify pipeline stages', roles: ['owner'] },
      { action: 'delete', label: 'Delete pipelines', description: 'Can delete pipelines', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // PATTERNS
    // ------------------------------------------
    patterns: [
      { action: 'create', label: 'Create Patterns', description: 'Can create reusable patterns', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View Patterns', description: 'Can view pattern details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List Patterns', description: 'Can see the patterns list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit Patterns', description: 'Can modify patterns', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete Patterns', description: 'Can delete patterns', roles: ['owner', 'admin'], dangerous: true },
    ],
  },

  // ==========================================
  // FEATURE PERMISSIONS
  // ==========================================
  // Unified format: uses 'action' instead of 'id'
  features: [
    // ===========================================
    // REPORTS & ANALYTICS
    // ===========================================
    {
      action: 'reports.sales',
      label: 'Sales Reports',
      description: 'Access to sales performance reports and analytics',
      category: 'Reports',
      roles: ['owner', 'admin'],
    },
    {
      action: 'reports.marketing',
      label: 'Marketing Reports',
      description: 'Access to marketing campaign reports and ROI analysis',
      category: 'Reports',
      roles: ['owner', 'admin'],
    },
    {
      action: 'reports.pipeline',
      label: 'Pipeline Reports',
      description: 'Access to pipeline analysis and forecasting reports',
      category: 'Reports',
      roles: ['owner', 'admin'],
    },
    {
      action: 'reports.export',
      label: 'Export Reports',
      description: 'Can export reports to PDF, Excel, or CSV',
      category: 'Reports',
      roles: ['owner', 'admin'],
    },

    // ===========================================
    // DASHBOARD FEATURES
    // ===========================================
    {
      action: 'dashboard.forecasting',
      label: 'Sales Forecasting',
      description: 'Access to sales forecasting and projections',
      category: 'Dashboard',
      roles: ['owner', 'admin'],
    },
    {
      action: 'dashboard.team_metrics',
      label: 'Team Metrics',
      description: 'View team performance metrics and KPIs',
      category: 'Dashboard',
      roles: ['owner', 'admin'],
    },

    // ===========================================
    // BULK OPERATIONS
    // ===========================================
    {
      action: 'bulk.import',
      label: 'Bulk Import',
      description: 'Can import data from CSV/Excel files',
      category: 'Bulk Operations',
      roles: ['owner', 'admin'],
    },
    {
      action: 'bulk.export',
      label: 'Bulk Export',
      description: 'Can export data to CSV/Excel files',
      category: 'Bulk Operations',
      roles: ['owner', 'admin'],
    },

    // ===========================================
    // LEAD MANAGEMENT
    // ===========================================
    {
      action: 'leads.convert',
      label: 'Convert Leads',
      description: 'Can convert leads to contacts and companies',
      category: 'Leads',
      roles: ['owner', 'admin', 'member'],
    },

    // ===========================================
    // CONFIGURATION
    // ===========================================
    {
      action: 'settings.pipelines',
      label: 'Pipeline Configuration',
      description: 'Can create and modify sales pipelines',
      category: 'Configuration',
      roles: ['owner'],
    },
    {
      action: 'settings.products',
      label: 'Product Catalog',
      description: 'Can manage the product catalog',
      category: 'Configuration',
      roles: ['owner'],
    },
  ],

  // ==========================================
  // DISABLED FEATURES
  // ==========================================
  disabled: [
    'teams.delete', // Cannot delete organization in single-tenant
  ],

  // ==========================================
  // UI SECTIONS
  // ==========================================
  uiSections: [
    {
      id: 'reports',
      label: 'Reports & Analytics',
      description: 'Permissions for accessing reports and analytics',
      categories: ['Reports', 'Dashboard'],
    },
    {
      id: 'bulk-operations',
      label: 'Bulk Operations',
      description: 'Permissions for bulk data operations',
      categories: ['Bulk Operations'],
    },
    {
      id: 'lead-management',
      label: 'Lead Management',
      description: 'Permissions specific to lead handling',
      categories: ['Leads'],
    },
    {
      id: 'configuration',
      label: 'System Configuration',
      description: 'Permissions for system configuration',
      categories: ['Configuration'],
    },
  ],
}

export default PERMISSIONS_CONFIG_OVERRIDES
