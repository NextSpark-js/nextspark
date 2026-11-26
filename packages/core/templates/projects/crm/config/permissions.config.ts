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
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // CONTACTS
    // ------------------------------------------
    contacts: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // COMPANIES
    // ------------------------------------------
    companies: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
    ],

    // ------------------------------------------
    // OPPORTUNITIES
    // ------------------------------------------
    opportunities: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', roles: ['owner', 'admin'] },
    ],

    // ------------------------------------------
    // ACTIVITIES
    // ------------------------------------------
    activities: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin', 'member'], dangerous: true },
    ],

    // ------------------------------------------
    // NOTES
    // ------------------------------------------
    notes: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin', 'member'], dangerous: true },
    ],

    // ------------------------------------------
    // CAMPAIGNS
    // ------------------------------------------
    campaigns: [
      { action: 'create', roles: ['owner', 'admin'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin'] },
      { action: 'delete', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // PRODUCTS
    // ------------------------------------------
    products: [
      { action: 'create', roles: ['owner'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner'] },
      { action: 'delete', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // PIPELINES
    // ------------------------------------------
    pipelines: [
      { action: 'create', roles: ['owner'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner'] },
      { action: 'delete', roles: ['owner'], dangerous: true },
    ],

    // ------------------------------------------
    // PATTERNS
    // ------------------------------------------
    patterns: [
      { action: 'create', roles: ['owner', 'admin'] },
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', roles: ['owner', 'admin'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
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
