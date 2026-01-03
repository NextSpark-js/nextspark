/**
 * boilerplate Theme- Application Configuration Overrides
 *
 * This file allows the theme to override core application configuration values.
 * Only include properties you want to override - missing properties will use core defaults.
 */

// Partial configuration type - all properties are optional
export const APP_CONFIG_OVERRIDES = {
  // =============================================================================
  // APPLICATION METADATA OVERRIDES
  // =============================================================================
  app: {
    name: 'Boilerplate',
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
  // INTERNATIONALIZATION OVERRIDES
  // =============================================================================
  i18n: {
    /**
     * Supported locales for your project
     * Add/remove locales as needed
     */
    supportedLocales: ['en', 'es'],

    /**
     * Default locale for your project
     * Override to change the primary language
     */
    defaultLocale: 'es' as const,

    /**
     * Additional namespaces specific to Boilerplate
     */
    namespaces: [
      'common',
      'dashboard',
      'settings',
      'auth',
      'public',
      'validation',

      // Project specific
      'tasks',
      'clients',
    ],
  },

  // =============================================================================
  // API CONFIGURATION OVERRIDES
  // =============================================================================
  api: {
    cors: {
      allowedOrigins: {
        development: [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
          // Project specific development origins
        ],
        production: [
          // Add Project production domains
          // 'https://boilerplate-themoneyteam.xyz',
        ],
      },
    },
  },

  // =============================================================================
  // DOCUMENTATION CONFIGURATION
  // =============================================================================
  docs: {
    /**
     * Enable/disable documentation system
     */
    enabled: true,

    /**
     * Public access to documentation
     * - true: Documentation accessible without authentication
     * - false: Requires user to be logged in
     */
    public: true,

    /**
     * Enable search functionality in documentation
     */
    searchEnabled: true,

    /**
     * Show breadcrumbs in documentation pages
     */
    breadcrumbs: true,

    /**
     * Theme Documentation Configuration
     * Controls how theme-level documentation appears in the sidebar
     */
    theme: {
      /** Show/hide theme documentation category */
      enabled: true,
      /** Expand theme category by default on page load */
      open: true,
      /** Custom label displayed in sidebar for theme category */
      label: "Default Theme",
    },

    /**
     * Plugins Documentation Configuration
     * Controls how plugin documentation appears in the sidebar
     */
    plugins: {
      /** Show/hide plugin documentation category */
      enabled: true,
      /** Expand plugins category by default on page load */
      open: false,
      /** Custom label displayed in sidebar for plugins category */
      label: "Plugins",
    },

    /**
     * Core Documentation Configuration
     * Controls how core framework documentation appears in the sidebar
     */
    core: {
      /** Show/hide core documentation category */
      enabled: true,
      /** Expand core category by default on page load */
      open: true,
      /** Custom label displayed in sidebar for core category */
      label: "Core",
    },

    /**
     * Additional environment-based check for plugin docs in production
     * Plugin docs will only show if BOTH conditions are met:
     * 1. plugins.enabled is true
     * 2. Either in development OR showPluginsDocsInProd is true
     *
     * @deprecated Prefer using plugins.enabled for simpler control
     * By default plugins documentation is not available in prod environments
     */
    showPluginsDocsInProd: false,
  },

  // =============================================================================
  // TEAM ROLES - NOW IN permissions.config.ts
  // =============================================================================
  // Team roles (additionalRoles, hierarchy, displayNames, descriptions) are now
  // defined in permissions.config.ts under the `roles` section.
  // This is the SINGLE SOURCE OF TRUTH for all permissions and roles.
  //
  // See: contents/themes/default/config/permissions.config.ts
  //
  // To add custom roles, edit permissions.config.ts:
  // ```
  // roles: {
  //   additionalRoles: ['editor'],
  //   hierarchy: { editor: 5 },
  //   displayNames: { editor: 'common.teamRoles.editor' },
  //   descriptions: { editor: 'Can view team content...' },
  // },
  // ```

  // =============================================================================
  // USER ROLES EXTENSION
  // =============================================================================
  // User roles (member, superadmin, developer) are system-level roles.
  // For team roles configuration, see permissions.config.ts
  //
  // Uncomment to extend user roles:
  // userRoles: {
  //   additionalRoles: ['moderator'] as const,
  //   hierarchy: { moderator: 50 },
  //   displayNames: { moderator: 'common.userRoles.moderator' },
  //   descriptions: { moderator: 'Can moderate content' },
  // },

  // =============================================================================
  // MOBILE NAVIGATION OVERRIDES
  // =============================================================================
  // Uncomment and modify to customize mobile navigation items
  // You can add/remove/reorder items, change icons, or disable items
  //
  mobileNav: {
    /**
     * Mobile bottom navigation items
     * Configure which items appear in the mobile navigation bar
     *
     * Icon names use lucide-react icons (https://lucide.dev)
     * Set isCentral: true for the highlighted center button (only one should have this)
     */
    items: [
      {
        id: 'home',
        labelKey: 'common.mobileNav.home',
        href: '/dashboard',
        icon: 'Home',
        enabled: true,
      },
      {
        id: 'tasks',
        labelKey: 'common.mobileNav.tasks',
        href: '/dashboard/tasks',
        icon: 'CheckSquare',
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
        id: 'more',
        labelKey: 'common.mobileNav.more',
        icon: 'Menu',
        action: 'moreSheet',
        enabled: true,
      },
    ],

    /**
     * More Sheet items
     * Configure which items appear in the "More" sheet
     *
     * These are secondary navigation items that appear when the user taps "More"
     * Typical use: Settings subpages, help, support, profile, etc.
     */
    moreSheetItems: [
      {
        id: 'profile',
        labelKey: 'common.navigation.profile',
        href: '/dashboard/settings/profile',
        icon: 'User',
        enabled: true,
      },
      {
        id: 'billing',
        labelKey: 'common.navigation.billing',
        href: '/dashboard/settings/billing',
        icon: 'CreditCard',
        enabled: true,
      },
      {
        id: 'api-keys',
        labelKey: 'common.navigation.apiKeys',
        href: '/dashboard/settings/api-keys',
        icon: 'Key',
        enabled: true,
      },
      {
        id: 'help',
        labelKey: 'common.navigation.help',
        href: '/support',
        icon: 'HelpCircle',
        enabled: false,
        external: true,
      },
    ],
  },

  // =============================================================================
  // SCHEDULED ACTIONS CONFIGURATION
  // =============================================================================
  /**
   * Scheduled Actions System
   * Background task processing via external cron
   */
  scheduledActions: {
    /** Enable/disable scheduled actions system */
    enabled: true,

    /** Retention period for completed/failed actions (days) */
    retentionDays: 7,

    /** Maximum number of actions to process per cron run */
    batchSize: 10,

    /** Default timeout per action (milliseconds) */
    defaultTimeout: 30000,

    /**
     * Multi-endpoint Webhook Configuration
     *
     * Each webhook endpoint is identified by a key and reads its URL from an env variable.
     * Webhooks can auto-match by event pattern or be explicitly called by key.
     */
    webhooks: {
      endpoints: {
        // Default catch-all webhook (disabled by default)
        default: {
          envVar: 'WEBHOOK_URL_DEFAULT',
          description: 'Default webhook for general notifications',
          patterns: ['*:*'],
          enabled: false,
        },
        // Task lifecycle webhook
        tasks: {
          envVar: 'WEBHOOK_URL_TASKS',
          description: 'Task create/update/delete notifications',
          patterns: ['task:created', 'task:updated', 'task:deleted'],
          enabled: true,
        },
        // Subscription lifecycle webhook
        subscriptions: {
          envVar: 'WEBHOOK_URL_SUBSCRIPTIONS',
          description: 'Subscription lifecycle notifications (create, update, cancel, renewal, expiring)',
          patterns: ['subscription:created', 'subscription:updated', 'subscription:renewed', 'subscription:cancelled', 'subscription:expiring_soon'],
          enabled: true,
        },
      },
      defaultEndpoint: 'default',
    },

    /**
     * Deduplication Settings
     *
     * Prevents duplicate scheduled actions within a time window.
     * Behavior:
     * - windowSeconds > 0: Updates existing action's payload (always keeps latest)
     * - windowSeconds = 0: Disables deduplication (track all changes)
     */
    deduplication: {
      /** Time window in seconds (same entityId within window = duplicate). Set to 0 to disable. */
      windowSeconds: 30,
    },
  },

  // =============================================================================
  // DEV KEYRING - MOVED TO dev.config.ts
  // =============================================================================
  // DevKeyring configuration has been moved to dev.config.ts
  // This separates development-only settings from production configuration.
  // See: contents/themes/default/config/dev.config.ts
}