/**
 * CRM Theme - Features Configuration
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
  // LEAD MANAGEMENT FEATURES
  // Lead capture and qualification
  // ===========================================================================

  leads: {
    name: 'Leads',
    description: 'Lead capture, qualification, and assignment management',
    category: 'entities',
    icon: 'user-search',
    entities: ['leads'],
    permissions: ['leads.*'],
    docs: [],
  },

  'lead-conversion': {
    name: 'Lead Conversion',
    description: 'Convert qualified leads to contacts and companies',
    category: 'leads',
    icon: 'user-check',
    entities: ['leads', 'contacts', 'companies'],
    permissions: ['leads.convert'],
    docs: [],
  },

  // ===========================================================================
  // CONTACT MANAGEMENT FEATURES
  // Contact and relationship management
  // ===========================================================================

  contacts: {
    name: 'Contacts',
    description: 'Contact management with company associations and communication history',
    category: 'entities',
    icon: 'users',
    entities: ['contacts'],
    permissions: ['contacts.*'],
    docs: [],
  },

  companies: {
    name: 'Companies',
    description: 'Company/organization management with contact associations',
    category: 'entities',
    icon: 'building',
    entities: ['companies'],
    permissions: ['companies.*'],
    docs: [],
  },

  // ===========================================================================
  // SALES PIPELINE FEATURES
  // Opportunity and pipeline management
  // ===========================================================================

  opportunities: {
    name: 'Opportunities',
    description: 'Sales opportunity tracking with pipeline stages and deal values',
    category: 'entities',
    icon: 'trending-up',
    entities: ['opportunities'],
    permissions: ['opportunities.*'],
    docs: [],
  },

  pipelines: {
    name: 'Pipelines',
    description: 'Sales pipeline configuration with customizable stages',
    category: 'entities',
    icon: 'git-branch',
    entities: ['pipelines'],
    permissions: ['pipelines.*', 'settings.pipelines'],
    docs: [],
  },

  'pipeline-kanban': {
    name: 'Pipeline Kanban',
    description: 'Visual kanban board for managing opportunities across pipeline stages',
    category: 'sales',
    icon: 'layout',
    entities: ['opportunities', 'pipelines'],
    permissions: ['opportunities.*', 'pipelines.read'],
    docs: [],
  },

  // ===========================================================================
  // ACTIVITY MANAGEMENT FEATURES
  // Tasks, calls, meetings, and notes
  // ===========================================================================

  activities: {
    name: 'Activities',
    description: 'Schedule and track calls, meetings, emails, and tasks',
    category: 'entities',
    icon: 'calendar',
    entities: ['activities'],
    permissions: ['activities.*'],
    docs: [],
  },

  notes: {
    name: 'Notes',
    description: 'Add notes and comments to leads, contacts, and opportunities',
    category: 'entities',
    icon: 'file-text',
    entities: ['notes'],
    permissions: ['notes.*'],
    docs: [],
  },

  // ===========================================================================
  // MARKETING FEATURES
  // Campaign and product management
  // ===========================================================================

  campaigns: {
    name: 'Campaigns',
    description: 'Marketing campaign management and tracking',
    category: 'entities',
    icon: 'megaphone',
    entities: ['campaigns'],
    permissions: ['campaigns.*'],
    docs: [],
  },

  products: {
    name: 'Products',
    description: 'Product catalog management for quotes and opportunities',
    category: 'entities',
    icon: 'package',
    entities: ['products'],
    permissions: ['products.*', 'settings.products'],
    docs: [],
  },

  // ===========================================================================
  // REPORTING FEATURES
  // Analytics and reports
  // ===========================================================================

  'sales-reports': {
    name: 'Sales Reports',
    description: 'Sales performance analytics and forecasting',
    category: 'reports',
    icon: 'bar-chart',
    entities: ['opportunities', 'leads'],
    permissions: ['reports.sales', 'reports.export'],
    docs: [],
  },

  'marketing-reports': {
    name: 'Marketing Reports',
    description: 'Marketing campaign performance and ROI analysis',
    category: 'reports',
    icon: 'pie-chart',
    entities: ['campaigns', 'leads'],
    permissions: ['reports.marketing', 'reports.export'],
    docs: [],
  },

  'pipeline-reports': {
    name: 'Pipeline Reports',
    description: 'Pipeline analysis, conversion rates, and forecasting',
    category: 'reports',
    icon: 'activity',
    entities: ['opportunities', 'pipelines'],
    permissions: ['reports.pipeline', 'reports.export'],
    docs: [],
  },

  // ===========================================================================
  // DASHBOARD FEATURES
  // Dashboard widgets and metrics
  // ===========================================================================

  'sales-forecasting': {
    name: 'Sales Forecasting',
    description: 'Revenue forecasting based on pipeline data',
    category: 'dashboard',
    icon: 'trending-up',
    entities: ['opportunities'],
    permissions: ['dashboard.forecasting'],
    docs: [],
  },

  'team-metrics': {
    name: 'Team Metrics',
    description: 'Team performance metrics and KPIs dashboard',
    category: 'dashboard',
    icon: 'users',
    entities: ['leads', 'opportunities', 'activities'],
    permissions: ['dashboard.team_metrics'],
    docs: [],
  },

  // ===========================================================================
  // BULK OPERATIONS FEATURES
  // Data import/export
  // ===========================================================================

  'bulk-import': {
    name: 'Bulk Import',
    description: 'Import data from CSV/Excel files',
    category: 'settings',
    icon: 'upload',
    entities: ['leads', 'contacts', 'companies'],
    permissions: ['bulk.import'],
    docs: [],
  },

  'bulk-export': {
    name: 'Bulk Export',
    description: 'Export data to CSV/Excel files',
    category: 'settings',
    icon: 'download',
    entities: ['leads', 'contacts', 'companies', 'opportunities'],
    permissions: ['bulk.export'],
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
    description: 'Single-tenant team management with role-based access',
    category: 'core',
    icon: 'users',
    entities: [],
    permissions: ['teams.*', 'members.*', 'invitations.*'],
    docs: [],
  },

  // ===========================================================================
  // SETTINGS FEATURES
  // User and system settings
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
    description: 'API key generation for integrations',
    category: 'settings',
    icon: 'key',
    entities: [],
    permissions: ['api-keys.*'],
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
