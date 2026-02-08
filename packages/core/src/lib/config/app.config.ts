/**
 * Default Application Configuration (Core)
 *
 * This file contains the default configuration values for the application.
 * These values can be overridden by theme-specific app.config.ts files.
 *
 * The merge system will combine this default config with theme-specific configs,
 * allowing themes to override only the values they need to change.
 */

import type { AppConfig } from './types'

// =============================================================================
// DEFAULT APPLICATION CONFIGURATION
// =============================================================================

export const DEFAULT_APP_CONFIG: AppConfig = {

  // =============================================================================
  // APPLICATION METADATA
  // =============================================================================
  app: {
    /**
     * Your application information
     * UPDATE THESE VALUES FOR YOUR PROJECT
     */
    name: 'NextSpark',
    version: '1.0.0',
  },


  // =============================================================================
  // INTERNATIONALIZATION SETTINGS
  // =============================================================================

  i18n: {
    /**
     * Supported locales for your project
     * Add/remove locales as needed
     */
    supportedLocales: ['en', 'es', 'fr', 'de', 'it', 'pt'],

    /**
     * Default fallback locale
     */
    defaultLocale: 'en',

    /**
     * Cookie settings for locale persistence
     */
    cookie: {
      name: 'locale',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      secure: 'auto',
      sameSite: 'lax',
      path: '/',
    },

    /**
     * Translation namespaces for your project
     * Add/remove namespaces based on your app structure
     */
    namespaces: [
      'common',      // Shared UI elements, buttons, navigation
      'dashboard',   // Dashboard-specific content (includes topbar, sidebar, etc.)
      'settings',    // Settings pages (configuration managed in dashboard.config.ts)
      'tasks',       // Task management
      'teams',       // Team management (Phase 2)
      'auth',        // Authentication flows
      'public',      // Public pages (home, pricing, etc.)
      'validation'   // Form validation messages
    ],

    /**
     * Performance optimizations
     */
    performance: {
      preloadCriticalNamespaces: ['common', 'dashboard'],
    }
  },

  // =============================================================================
  // USER ROLES CONFIGURATION
  // Phase 2 Simplification: Only 2 roles (member, superadmin)
  // Team-based permissions are handled via team_members.role
  // Phase 3 Extension: Added developer role (hierarchy: 100) for platform developers
  // Phase 4 Extension: Extensible roles system - themes can add custom roles
  // =============================================================================
  userRoles: {
    /**
     * Protected core roles - CANNOT be removed by themes
     *
     * These roles have special behavior hardcoded in guards/middleware:
     * - member: Default role for new users, basic permissions
     * - superadmin: Bypass all restrictions, full system access
     * - developer: Ultimate access for platform developers (always hierarchy 100)
     *
     * Themes can add additional roles via `additionalRoles` but cannot remove
     * or modify these core roles. The developer role always maintains maximum
     * hierarchy level (100) regardless of theme configuration.
     */
    coreRoles: ['member', 'superadmin', 'developer'] as const,

    /**
     * Default role for new users
     */
    defaultRole: 'member',

    /**
     * All available roles in your system
     * - member: Regular user with team-based permissions
     * - superadmin: Full system access (product owners only)
     * - developer: Ultimate access (platform developers only)
     *
     * Note: This is derived from coreRoles + theme additionalRoles during config merge
     */
    availableRoles: ['member', 'superadmin', 'developer'] as const,

    /**
     * Role hierarchy (higher number = higher permissions)
     * developer (100) > superadmin (99) > member (1)
     */
    hierarchy: {
      member: 1,      // Uses team roles for permissions
      superadmin: 99, // Bypass all restrictions
      developer: 100, // Ultimate access (platform developers only)
    },

    /**
     * Role display names (translation keys)
     * The actual translations are in contents/messages/[locale]/common.json
     */
    displayNames: {
      member: 'common.userRoles.member',
      superadmin: 'common.userRoles.superadmin',
      developer: 'common.userRoles.developer',
    },

    /**
     * Role descriptions
     */
    descriptions: {
      member: 'Regular user with team-based permissions',
      superadmin: 'Full system access (product owners only)',
      developer: 'Ultimate access (platform developers only)',
    },
  },

  // =============================================================================
  // TEAM ROLES CONFIGURATION
  // Team-specific roles (per team_members table)
  // These are separate from global user roles (users.role)
  // =============================================================================
  teamRoles: {
    /**
     * Protected core team role - CANNOT be removed by themes
     *
     * The 'owner' role is critical for team creation logic:
     * - When a user creates a team, they automatically become 'owner'
     * - The owner has full control over the team
     * - This role cannot be removed, renamed, or modified by themes
     */
    coreTeamRoles: ['owner'] as const,

    /**
     * Default team role for new members
     */
    defaultTeamRole: 'member',

    /**
     * Default available team roles
     * - owner: Team owner (PROTECTED - cannot be removed)
     * - admin: Team administrator
     * - member: Regular team member
     * - viewer: Read-only access
     *
     * Themes can:
     * - Add new roles via `additionalTeamRoles`
     * - Remove or rename 'admin', 'member', 'viewer'
     * - CANNOT remove 'owner'
     */
    availableTeamRoles: ['owner', 'admin', 'member', 'viewer'] as const,

    /**
     * Team role hierarchy (higher number = higher permissions within the team)
     * owner (100) > admin (50) > member (10) > viewer (1)
     */
    hierarchy: {
      owner: 100,   // Full team control (PROTECTED)
      admin: 50,    // Team management
      member: 10,   // Standard access
      viewer: 1,    // Read-only
    },

    /**
     * Team role display names (translation keys)
     */
    displayNames: {
      owner: 'common.teamRoles.owner',
      admin: 'common.teamRoles.admin',
      member: 'common.teamRoles.member',
      viewer: 'common.teamRoles.viewer',
    },

    /**
     * Team role descriptions
     */
    descriptions: {
      owner: 'Full team control, cannot be removed',
      admin: 'Manage team members and settings',
      member: 'Standard team access',
      viewer: 'Read-only access to team resources',
    },

    // =========================================================================
    // NOTE: Team permissions are now defined in permissions.config.ts
    // =========================================================================
    // The `permissions` property has been removed from here.
    // Team permissions are now in permissions.config.ts under the `teams` section.
    // This is the SINGLE SOURCE OF TRUTH for all permissions.
    //
    // Use PermissionService.canDoAction(role, action) to check any permission.
    // Use TEAM_PERMISSIONS_BY_ROLE from permissions-registry for direct access.
    // =========================================================================
  },

  // =============================================================================
  // API CONFIGURATION
  // =============================================================================
  api: {
    cors: {
      /**
       * Allowed origins for CORS
       * UPDATE THESE VALUES FOR YOUR DOMAINS
       */
      allowedOrigins: {
        development: [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173'
        ],
        production: [
          // Add your production domains here
          // 'https://yourdomain.com',
          // 'https://app.yourdomain.com'
        ],
      },
      /**
       * Allow all origins (useful for development)
       */
      allowAllOrigins: {
        development: true,
        production: false,
      },
    },
  },

  // =============================================================================
  // TOPBAR CONFIGURATION
  // =============================================================================
  topbar: {
    /**
     * Desktop topbar feature flags
     * Control which features are enabled in the desktop topbar
     */
    features: {
      quickCreate: true,
      search: true,
      notifications: true,
      help: true,
      theme: true,
      admin: false,
      userMenu: true,
    },
  },

  // =============================================================================
  // SETTINGS PAGE CONFIGURATION
  // =============================================================================
  settings: {
    /**
     * Configure which settings pages are enabled and their order
     */
    pages: {
      profile: {
        enabled: true,
        order: 1,
      },
      billing: {
        enabled: true,
        order: 2,
      },
      apiKeys: {
        enabled: true,
        order: 3,
      },
      password: {
        enabled: true,
        order: 4,
      },
    },
  },

  // =============================================================================
  // SCHEDULED ACTIONS CONFIGURATION
  // =============================================================================
  scheduledActions: {
    /**
     * Enable/disable the scheduled actions system
     * When false, no actions will be scheduled or processed
     */
    enabled: true,

    /**
     * Retention period for completed/failed actions in days
     * Actions older than this will be cleaned up by the cleanup job
     */
    retentionDays: 7,

    /**
     * Maximum actions to process per cron run
     * Prevents overloading the server during processing
     */
    batchSize: 10,

    /**
     * Default timeout per action in milliseconds
     * Individual actions can override this in their definition
     */
    defaultTimeout: 30000,
  },

  // =============================================================================
  // MEDIA LIBRARY CONFIGURATION
  // =============================================================================
  media: {
    /**
     * Maximum upload file size in MB (general fallback for all file types)
     */
    maxSizeMB: 10,

    /**
     * Maximum image file size in MB
     * Overrides maxSizeMB for image/* files. Falls back to maxSizeMB if not set.
     */
    // maxSizeImageMB: 10,

    /**
     * Maximum video file size in MB
     * Overrides maxSizeMB for video/* files. Falls back to maxSizeMB if not set.
     */
    // maxSizeVideoMB: 50,

    /**
     * Accepted MIME type patterns for the client-side file input
     */
    acceptedTypes: ['image/*', 'video/*'],

    /**
     * Specific MIME types allowed by the server-side upload endpoint
     */
    allowedMimeTypes: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
    ],
  },

  // =============================================================================
  // MOBILE NAVIGATION CONFIGURATION
  // =============================================================================
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
        enabled: true,
        external: true,
      },
    ],
  },
}

