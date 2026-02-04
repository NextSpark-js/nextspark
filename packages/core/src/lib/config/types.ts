/**
 * Configuration Type Definitions
 *
 * TypeScript interfaces and types for application configuration.
 * These provide type safety and auto-completion for config files.
 */

// Import icon names type (will be created in next step)
import type { IconName } from './icon-map'

/**
 * Teams Mode
 *
 * Defines how teams work in the application.
 */
export type TeamsMode =
  | 'single-user'     // Usuario individual, sin colaboracion (ej: blog personal)
  | 'single-tenant'   // Una organizacion con invitaciones (ej: CRM empresarial)
  | 'multi-tenant'    // Multiples equipos por usuario (ej: agencia con clientes)

/**
 * Teams Configuration Options
 */
export interface TeamsConfigOptions {
  /** Maximum number of teams a user can create */
  maxTeamsPerUser?: number | null
  /** Maximum members per team */
  maxMembersPerTeam?: number | null
  /** Allow users to leave all teams */
  allowLeaveAllTeams?: boolean
  /**
   * Allow users to create additional teams in multi-tenant mode
   * - true (default): Users can create multiple teams without limit
   * - false: Users can only be owner of maximum 1 team
   * Note: Only applies to multi-tenant mode. Signup team is always created.
   */
  allowCreateTeams?: boolean
}

/**
 * Teams Configuration
 */
export interface TeamsConfig {
  /** Teams mode */
  mode: TeamsMode
  /** Additional options */
  options?: TeamsConfigOptions
}

/**
 * Mobile Navigation Item
 *
 * Represents a single item in the mobile bottom navigation bar.
 */
export interface MobileNavItem {
  /** Unique identifier for the nav item */
  id: string

  /** Translation key for the label (e.g., 'common.mobileNav.home') */
  labelKey: string

  /** Navigation href (optional if item triggers an action) */
  href?: string

  /** Icon name from Lucide icons */
  icon: IconName

  /** Whether this item is enabled and should be displayed */
  enabled: boolean

  /** Whether this is the central elevated button (e.g., Quick Create) */
  isCentral?: boolean

  /** Action to trigger instead of navigation */
  action?: 'quickCreate' | 'moreSheet'
}

/**
 * Mobile "More" Sheet Item
 *
 * Represents a single item in the mobile "More" options sheet.
 */
export interface MobileNavMoreItem {
  /** Unique identifier for the more sheet item */
  id: string

  /** Translation key for the label */
  labelKey: string

  /** Navigation href */
  href: string

  /** Icon name from Lucide icons */
  icon: IconName

  /** Whether this item is enabled and should be displayed */
  enabled: boolean

  /** Whether this link opens in a new tab */
  external?: boolean
}

/**
 * Mobile Navigation Configuration
 *
 * Complete configuration for mobile navigation system.
 */
export interface MobileNavConfig {
  /** Bottom navigation bar items */
  items: MobileNavItem[]

  /** "More" sheet secondary navigation items */
  moreSheetItems: MobileNavMoreItem[]
}

/**
 * Topbar Feature Flags
 *
 * Controls which features are enabled in the desktop topbar.
 */
export interface TopbarConfig {
  features: {
    quickCreate: boolean
    search: boolean
    notifications: boolean
    help: boolean
    theme: boolean
    admin: boolean
    userMenu: boolean
  }
}

/**
 * Settings Page Configuration
 */
export interface SettingsPageConfig {
  enabled: boolean
  order?: number
}

export interface SettingsConfig {
  pages: {
    profile: SettingsPageConfig
    billing: SettingsPageConfig
    apiKeys: SettingsPageConfig
    password: SettingsPageConfig
  }
}

/**
 * Documentation Category Configuration
 *
 * Configuration for a single documentation category (public or superadmin).
 */
export interface DocsCategoryConfig {
  /** Enable/disable this documentation level in the sidebar */
  enabled: boolean

  /** Whether this category should be expanded by default on page load */
  open?: boolean

  /** Custom label displayed in the sidebar for this category */
  label: string
}

/**
 * Documentation System Configuration
 *
 * Controls documentation system behavior including visibility,
 * search functionality, and category-specific settings.
 *
 * Structure:
 * - public: User-facing documentation at /docs
 * - superadmin: Admin documentation at /superadmin/docs
 *
 * NOTE: Plugin docs are NOT in the registry - they are for developer reference only (IDE/LLM).
 */
export interface DocsConfig {
  /** Enable/disable the entire documentation system */
  enabled: boolean

  /** Make public documentation accessible without authentication */
  publicAccess?: boolean

  /** Enable search functionality in the sidebar */
  searchEnabled: boolean

  /** Show breadcrumbs navigation in documentation pages */
  breadcrumbs: boolean

  /** Public documentation configuration (for /docs routes) */
  public?: DocsCategoryConfig

  /** Superadmin documentation configuration (for /superadmin/docs routes) */
  superadmin?: DocsCategoryConfig
}

/**
 * DevKeyring User Configuration
 *
 * Represents a test user for quick login during development.
 */
export interface DevKeyringUser {
  /** Unique identifier for the user */
  id: string

  /** User's email address */
  email: string

  /** User's display name */
  name: string

  /** User's password (for auto-fill) */
  password: string

  /** Team roles description (e.g., "TeamA (admin), TeamB (member)") */
  teamRoles?: string
}

/**
 * DevKeyring Configuration
 *
 * Configuration for development/QA quick login feature.
 * Only rendered in non-production environments.
 */
export interface DevKeyringConfig {
  /** Enable/disable the DevKeyring feature */
  enabled: boolean

  /** List of test users available for quick login */
  users: DevKeyringUser[]
}

/**
 * Team Roles Configuration
 *
 * Defines roles within teams (team_members.role).
 * Separate from global user roles (users.role).
 *
 * NOTE: Team PERMISSIONS are now defined in permissions.config.ts
 * under the `teams` section. This is the SINGLE SOURCE OF TRUTH
 * for all permissions. Use PermissionService.canDoAction() to check.
 */
export interface TeamRolesConfig {
  /** Protected core team roles - CANNOT be removed by themes */
  coreTeamRoles: readonly string[]

  /** Default role for new team members */
  defaultTeamRole: string

  /** All available team roles */
  availableTeamRoles: readonly string[]

  /** Role hierarchy (higher = more permissions within team) */
  hierarchy: Record<string, number>

  /** Role display names (translation keys) */
  displayNames: Record<string, string>

  /** Role descriptions */
  descriptions: Record<string, string>
}

/**
 * Webhook Endpoint Configuration
 *
 * Represents a single webhook endpoint with its URL source and event patterns.
 */
export interface WebhookEndpointConfig {
  /** Environment variable name containing the URL (security best practice) */
  envVar: string

  /** Description of this webhook's purpose */
  description?: string

  /**
   * Event patterns this webhook matches (for auto-routing)
   * Examples: 'task:*', 'subscription:created', '*:created'
   * Uses glob-like matching: * matches any segment
   */
  patterns?: string[]

  /** Whether this endpoint is enabled */
  enabled?: boolean
}

/**
 * Webhooks Configuration
 *
 * Defines multiple webhook endpoints, each identified by a unique key.
 * URLs are read from environment variables for security.
 */
export interface WebhooksConfig {
  /** Named webhook endpoints */
  endpoints: Record<string, WebhookEndpointConfig>

  /** Default endpoint key for fallback when no pattern matches */
  defaultEndpoint?: string
}

/**
 * Scheduled Actions Configuration
 *
 * Controls the scheduled actions system behavior.
 * Core provides defaults, themes can override.
 */
export interface ScheduledActionsConfig {
  /** Enable/disable scheduled actions system */
  enabled: boolean

  /** Retention period for completed/failed actions in days */
  retentionDays: number

  /** Maximum actions to process per cron run */
  batchSize: number

  /** Default timeout per action in milliseconds */
  defaultTimeout: number

  /**
   * Maximum number of actions to execute in parallel.
   * Actions are executed concurrently up to this limit.
   * Default: 1 (sequential execution for backward compatibility)
   *
   * @example
   * concurrencyLimit: 5 -> Up to 5 actions run simultaneously
   */
  concurrencyLimit?: number

  /**
   * @deprecated Use webhooks.endpoints instead for multi-endpoint support
   * Legacy single webhook URL for backward compatibility
   */
  webhookUrl?: string

  /** Multi-endpoint webhook configuration */
  webhooks?: WebhooksConfig

  /**
   * Deduplication settings to prevent duplicate actions
   * Uses time-window approach: same entityId within window = duplicate
   *
   * Behavior:
   * - windowSeconds > 0: Updates existing action's payload (override)
   * - windowSeconds = 0: Disables deduplication (track all changes)
   */
  deduplication?: {
    /** Time window in seconds to detect duplicates (default: 5). Set to 0 to disable. */
    windowSeconds: number
  }
}

/**
 * Complete Application Configuration
 *
 * Root configuration object structure.
 *
 * Note: This interface defines the core required types for type safety.
 * Additional properties can be added in app.config.ts and will be validated at runtime.
 */
export interface AppConfig {
  app: {
    name: string
    version: string
  }

  i18n: {
    supportedLocales: string[]
    defaultLocale: string
    cookie: {
      name: string
      maxAge: number
      httpOnly: boolean
      secure: string | boolean
      sameSite: 'lax' | 'strict' | 'none'
      path: string
    }
    namespaces: string[]
    performance: {
      preloadCriticalNamespaces: string[]
    }
  }

  topbar: TopbarConfig

  settings: SettingsConfig

  mobileNav: MobileNavConfig

  /** Documentation system configuration */
  docs?: DocsConfig

  /**
   * DevKeyring configuration for development/QA quick login
   *
   * @deprecated DevKeyring configuration has moved to dev.config.ts
   * This property is kept for backwards compatibility but should not be used.
   * Use DEV_CONFIG from config-sync.ts instead.
   */
  devKeyring?: DevKeyringConfig

  /** Team roles configuration (for team_members.role) */
  teamRoles?: TeamRolesConfig

  /** Scheduled actions system configuration */
  scheduledActions?: ScheduledActionsConfig

  // Allow additional properties
  [key: string]: any
}

/**
 * Development Configuration
 *
 * Contains development-only settings that should never affect production.
 * This configuration is loaded from dev.config.ts in each theme.
 *
 * @example
 * ```typescript
 * // contents/themes/my-theme/config/dev.config.ts
 * export const DEV_CONFIG_OVERRIDES: DevConfig = {
 *   devKeyring: {
 *     enabled: true,
 *     users: [
 *       { id: 'dev', email: 'dev@test.com', name: 'Developer', password: 'test123' },
 *     ],
 *   },
 * }
 * ```
 */
export interface DevConfig {
  /** DevKeyring configuration for quick login in development */
  devKeyring?: DevKeyringConfig

  // Future extensions:
  // debugMode?: boolean
  // mockData?: boolean
  // logLevel?: 'debug' | 'info' | 'warn' | 'error'
}
