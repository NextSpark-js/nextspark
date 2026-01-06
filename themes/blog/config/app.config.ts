/**
 * Blog Theme - Application Configuration
 *
 * Multi-author blog platform with single-user mode.
 * Each author has their own isolated team but content is aggregated publicly.
 */

export const APP_CONFIG_OVERRIDES = {
  // =============================================================================
  // APPLICATION METADATA
  // =============================================================================
  app: {
    name: 'Blog Platform',
    version: '2.0.0',
  },

  // =============================================================================
  // TEAMS CONFIGURATION - SINGLE USER MODE
  // =============================================================================
  /**
   * Single-user mode:
   * - No team switching
   * - No invitations
   * - No team creation
   * - Each author has their personal team
   * - Content aggregates publicly across all authors
   */
  teams: {
    mode: 'single-user' as const,
    options: {
      maxTeamsPerUser: 1,
      maxMembersPerTeam: 1,
      allowLeaveAllTeams: false,
    },
  },

  // =============================================================================
  // INTERNATIONALIZATION
  // =============================================================================
  // Note: topbar and settings configuration is defined in dashboard.config.ts
  i18n: {
    supportedLocales: ['en', 'es'],
    defaultLocale: 'en' as const,
    namespaces: [
      'common',
      'dashboard',
      'settings',
      'auth',
      'public',
      'validation',
      // Theme specific
      'posts',
      'blog',
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
    public: true,
    searchEnabled: true,
    breadcrumbs: true,
    theme: {
      enabled: true,
      open: true,
      label: "Blog Theme",
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
        id: 'posts',
        labelKey: 'posts.title',
        href: '/dashboard/posts',
        icon: 'FileText',
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
        id: 'settings',
        labelKey: 'common.mobileNav.settings',
        href: '/dashboard/settings',
        icon: 'Settings',
        enabled: true,
      },
      {
        id: 'view-blog',
        labelKey: 'blog.viewBlog',
        href: '/',
        icon: 'ExternalLink',
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
        id: 'export',
        labelKey: 'blog.export',
        href: '/dashboard/settings/export',
        icon: 'Download',
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
