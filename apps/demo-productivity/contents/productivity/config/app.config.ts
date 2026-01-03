/**
 * Productivity Theme - Application Configuration
 *
 * Multi-tenant mode: Multiple workspaces with team switching.
 * Perfect for teams managing multiple projects or clients.
 */

export const APP_CONFIG_OVERRIDES = {
  // =============================================================================
  // APPLICATION METADATA
  // =============================================================================
  app: {
    name: 'Productivity',
    version: '1.0.0',
  },

  // =============================================================================
  // TEAMS CONFIGURATION - MULTI-TENANT MODE
  // =============================================================================
  /**
   * Multi-tenant mode:
   * - Multiple work teams (workspaces)
   * - Team switching enabled
   * - Invitations enabled
   * - Can create new teams
   */
  teams: {
    mode: 'multi-tenant' as const,
    options: {
      maxMembersPerTeam: 50,
      allowLeaveTeam: true,
      allowCreateTeams: true,
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
      // Theme specific
      'boards',
      'lists',
      'cards',
      'productivity',
    ],
  },

  // =============================================================================
  // API CONFIGURATION
  // =============================================================================
  api: {
    cors: {
      allowedOrigins: {
        development: [
          'http://localhost:3000',
          'http://localhost:5173',
        ],
        production: [],
      },
    },
  },

  // =============================================================================
  // DOCUMENTATION
  // =============================================================================
  docs: {
    enabled: true,
    public: false, // Private app documentation
    searchEnabled: true,
    breadcrumbs: true,
    theme: {
      enabled: true,
      open: true,
      label: "Productivity Theme",
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
  // SCHEDULED ACTIONS
  // =============================================================================
  scheduledActions: {
    enabled: true,
    retentionDays: 7,
    batchSize: 10,
    defaultTimeout: 30000,
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
        id: 'boards',
        labelKey: 'boards.title',
        href: '/dashboard/boards',
        icon: 'LayoutDashboard',
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
        id: 'cards',
        labelKey: 'cards.myCards',
        href: '/dashboard/cards',
        icon: 'CreditCard',
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
        id: 'profile',
        labelKey: 'common.navigation.profile',
        href: '/dashboard/settings/profile',
        icon: 'User',
        enabled: true,
      },
      {
        id: 'team',
        labelKey: 'common.navigation.team',
        href: '/dashboard/settings/teams',
        icon: 'Users',
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
