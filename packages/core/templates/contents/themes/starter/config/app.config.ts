/**
 * Starter Theme - Application Configuration
 *
 * This file allows the theme to override core application configuration values.
 * Only include properties you want to override - missing properties will use core defaults.
 *
 * Related config files:
 * - permissions.config.ts: Roles, team/entity/feature permissions (Single Source of Truth)
 * - billing.config.ts: Plans, features, limits, subscriptions
 * - dashboard.config.ts: UI configuration (topbar, sidebar, settings)
 * - dev.config.ts: Development tools (devKeyring, debug settings)
 * - theme.config.ts: Visual styling (colors, fonts, spacing)
 */

export const APP_CONFIG_OVERRIDES = {
  // =============================================================================
  // APPLICATION METADATA
  // =============================================================================
  app: {
    name: 'Starter',
    version: '1.0.0',
  },

  // =============================================================================
  // TEAMS CONFIGURATION
  // =============================================================================
  /**
   * Team modes available:
   * - 'multi-tenant': Multiple teams, team switching enabled (e.g., CRM, Project Management)
   * - 'single-tenant': One organization, no team switching (e.g., Internal tools)
   * - 'single-user': Personal app, no teams (e.g., Blog, Personal dashboard)
   */
  teams: {
    mode: 'multi-tenant' as const,
    /**
     * Available team roles for this theme
     * Core roles: owner, admin, member, viewer
     * Custom roles can be added here and configured in permissions.config.ts
     */
    availableTeamRoles: ['owner', 'admin', 'member', 'viewer'],
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
    /**
     * Supported locales for your theme
     */
    supportedLocales: ['en', 'es', 'fr', 'it', 'de', 'pt'],

    /**
     * Default locale
     */
    defaultLocale: 'en' as const,

    /**
     * Translation namespaces used by this theme
     * Core namespaces are automatically included
     */
    namespaces: [
      'common',
      'dashboard',
      'settings',
      'auth',
      'public',
      'validation',
      // Theme-specific namespaces:
      'tasks',
    ],
  },

  // =============================================================================
  // API CONFIGURATION
  // =============================================================================
  api: {
    cors: {
      // Theme-specific CORS origins (extends core defaults, does not replace)
      // Core already includes: localhost:3000, localhost:5173, and their 127.0.0.1 variants
      additionalOrigins: {
        development: [
          // Add your development origins here
          // 'http://localhost:4200', // Angular dev server
          // 'http://localhost:8081', // Expo mobile web
        ],
        production: [
          // Add your production origins here
          // 'https://mobile.yourapp.com',
        ],
      },
    },
  },

  // =============================================================================
  // AUTHENTICATION
  // =============================================================================
  /**
   * Registration modes:
   * - 'open': Anyone can register (email+password and Google OAuth) - DEFAULT
   * - 'domain-restricted': Only Google OAuth for specific email domains
   * - 'closed': No public registration. Users created manually, login only.
   * - 'invitation-only': Registration only via invitation link
   */
  auth: {
    registration: {
      mode: 'open' as const,
      // allowedDomains: ['yourcompany.com'], // Only for 'domain-restricted' mode
    },
    providers: {
      google: {
        enabled: false,
      },
    },
  },

  // =============================================================================
  // DOCUMENTATION
  // =============================================================================
  /**
   * Documentation system configuration
   *
   * Structure:
   * - public: User-facing documentation at /docs
   * - superadmin: Admin documentation at /superadmin/docs
   *
   * NOTE: Plugin docs are NOT in the registry - they are for developer reference only (IDE/LLM).
   */
  docs: {
    enabled: true,
    publicAccess: true,
    searchEnabled: true,
    breadcrumbs: true,
    public: {
      enabled: true,
      open: true,
      label: 'Documentation',
    },
    superadmin: {
      enabled: true,
      label: 'Admin Docs',
    },
  },

  // =============================================================================
  // MOBILE NAVIGATION
  // =============================================================================
  mobileNav: {
    /**
     * Bottom navigation bar items
     * Icon names use lucide-react icons (https://lucide.dev)
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
     * "More" sheet secondary navigation items
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
        id: 'help',
        labelKey: 'common.navigation.help',
        href: '/support',
        icon: 'HelpCircle',
        enabled: false,
        external: true,
      },
    ],
  },
}

export default APP_CONFIG_OVERRIDES
