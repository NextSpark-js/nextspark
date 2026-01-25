/**
 * CRM Theme - Application Configuration
 *
 * Single-tenant mode: One organization with multiple teams/departments.
 * Perfect for enterprise sales and marketing operations.
 */

export const APP_CONFIG_OVERRIDES = {
  // =============================================================================
  // APPLICATION METADATA
  // =============================================================================
  app: {
    name: 'CRM Enterprise',
    version: '2.0.0',
  },

  // =============================================================================
  // TEAMS CONFIGURATION - SINGLE-TENANT MODE
  // =============================================================================
  /**
   * Single-tenant mode:
   * - One work team created at signup (no personal team)
   * - Owner can invite members with different roles
   * - No team switching (only one organization)
   * - Multi-department structure via roles
   */
  teams: {
    mode: 'single-tenant' as const,
    options: {
      maxMembersPerTeam: 50,
      allowLeaveTeam: false, // Controlled by admin
    },
  },

  // =============================================================================
  // INTERNATIONALIZATION
  // =============================================================================
  i18n: {
    supportedLocales: ['en', 'es'],
    defaultLocale: 'en' as const,
    namespaces: [
      'common',
      'dashboard',
      'settings',
      'auth',
      'validation',
      // CRM entities
      'leads',
      'contacts',
      'companies',
      'opportunities',
      'activities',
      'campaigns',
      'notes',
      'products',
      'pipelines',
      // Theme specific
      'crm',
    ],
  },

  // =============================================================================
  // API CONFIGURATION
  // =============================================================================
  api: {
    cors: {
      // Theme-specific CORS origins (extends core defaults, does not replace)
      // No additional origins needed for CRM theme - uses core defaults
      additionalOrigins: {
        development: [],
        production: [],
      },
    },
  },

  // =============================================================================
  // DOCUMENTATION
  // =============================================================================
  docs: {
    enabled: true,
    public: false,
    searchEnabled: true,
    breadcrumbs: true,
    theme: {
      enabled: true,
      open: true,
      label: "CRM Theme",
    },
    plugins: {
      enabled: false,
      open: false,
      label: "Plugins",
    },
    core: {
      enabled: true,
      open: false,
      label: "Core",
    },
    showPluginsDocsInProd: false,
  },

  // =============================================================================
  // SCHEDULED ACTIONS (CRM needs more history and higher throughput)
  // =============================================================================
  scheduledActions: {
    enabled: true,
    retentionDays: 14,    // CRM needs more history for auditing
    batchSize: 20,        // CRM has more scheduled actions
    defaultTimeout: 45000, // Longer timeout for CRM integrations
  },

  // =============================================================================
  // MOBILE NAVIGATION
  // =============================================================================
  mobileNav: {
    items: [
      {
        id: 'home',
        labelKey: 'common.mobileNav.home',
        href: '/dashboard',
        icon: 'Home',
        enabled: true,
      },
      {
        id: 'leads',
        labelKey: 'crm.navigation.leads',
        href: '/dashboard/leads',
        icon: 'UserSearch',
        enabled: true,
      },
      {
        id: 'create',
        labelKey: 'common.mobileNav.create',
        icon: 'Plus',
        isCentral: true,
        action: 'quickCreate',
        enabled: true,
      },
      {
        id: 'opportunities',
        labelKey: 'crm.navigation.opportunities',
        href: '/dashboard/opportunities',
        icon: 'TrendingUp',
        enabled: true,
      },
      {
        id: 'settings',
        labelKey: 'common.mobileNav.settings',
        href: '/dashboard/settings',
        icon: 'Settings',
        enabled: true,
      },
    ],
    moreSheetItems: [
      {
        id: 'contacts',
        labelKey: 'crm.navigation.contacts',
        href: '/dashboard/contacts',
        icon: 'Users',
        enabled: true,
      },
      {
        id: 'companies',
        labelKey: 'crm.navigation.companies',
        href: '/dashboard/companies',
        icon: 'Building2',
        enabled: true,
      },
      {
        id: 'activities',
        labelKey: 'crm.navigation.activities',
        href: '/dashboard/activities',
        icon: 'Calendar',
        enabled: true,
      },
    ],
  },

  // =============================================================================
  // DEV KEYRING - MOVED TO dev.config.ts
  // =============================================================================
  // DevKeyring configuration has been moved to config/dev.config.ts
  // This separates development-only settings from production configuration.
}
