/**
 * Permission System Types
 *
 * Defines the type system for granular permissions.
 * Based on WordPress capabilities + GitHub organization permissions.
 */

// ==========================================
// BASIC TYPES
// ==========================================

/**
 * Standard entity actions available
 */
export type EntityAction =
  | 'create'    // Create new record
  | 'read'      // View individual record
  | 'list'      // List records
  | 'update'    // Edit record
  | 'delete'    // Delete record
  | 'export'    // Export data
  | 'import'    // Import data
  | 'assign'    // Assign to another user
  | 'publish'   // Publish (if applicable)
  | 'archive'   // Archive (soft delete visual)

/**
 * Permission format: "[scope].[action]"
 * Examples:
 * - Entities: "customers.create", "tasks.assign"
 * - System: "teams.invite", "settings.billing"
 * - Features: "reports.export", "contracts.sign"
 */
export type Permission = `${string}.${string}`

/**
 * Core team roles (base roles defined in core)
 */
export type CoreTeamRole = 'owner' | 'admin' | 'member' | 'viewer'

/**
 * Team roles available - includes core roles + any custom roles from theme config.
 * Uses (string & {}) pattern to allow custom roles while preserving autocomplete for core roles.
 */
export type TeamRole = CoreTeamRole | (string & {})

// ==========================================
// CONFIGURATION TYPES
// ==========================================

/**
 * Individual permission configuration
 */
export interface PermissionConfig {
  /** Unique permission ID (e.g., "customers.create") */
  id: Permission

  /** Human-readable label for UI */
  label: string

  /** Description for tooltips/docs */
  description?: string

  /** Category for grouping in UI (e.g., "Customers", "Settings") */
  category: string

  /** Roles that have this permission */
  roles: TeamRole[]

  /** If this is a dangerous action (show warning in UI) */
  dangerous?: boolean

  /** Dependencies: other permissions required for this to work */
  requires?: Permission[]
}

/**
 * Partial override for permission (for theme config)
 */
export type PermissionOverride = Partial<Omit<PermissionConfig, 'id'>>

/**
 * UI section for grouping permissions
 */
export interface PermissionUISection {
  id: string
  label: string
  description?: string
  categories: string[]
}

// ==========================================
// CORE CONFIG TYPE
// ==========================================

/**
 * Core permissions configuration
 */
export interface CorePermissionsConfig {
  version: string
  systemPermissions: PermissionConfig[]
  roleDefaults: Record<TeamRole, Permission[] | ['*']>
  uiSections: PermissionUISection[]
}

// ==========================================
// THEME CONFIG TYPE
// ==========================================

/**
 * Custom roles configuration for themes
 * Allows themes to add roles beyond the core (owner, admin, member, viewer)
 */
export interface RolesConfig {
  /** Additional roles beyond core roles (e.g., ['editor', 'contributor']) */
  additionalRoles?: readonly string[]

  /** Hierarchy values for roles (higher = more permissions) */
  hierarchy?: Record<string, number>

  /** Translation keys for role display names */
  displayNames?: Record<string, string>

  /** Role descriptions for UI tooltips */
  descriptions?: Record<string, string>
}

/**
 * Unified permission action format
 * Used for teams, features - follows same pattern as entity permissions
 */
export interface PermissionAction {
  /** Action identifier (e.g., 'team.edit', 'page-builder.access') */
  action: string

  /** Human-readable label for the permission */
  label: string

  /** Detailed description of what this permission allows */
  description?: string

  /** Team roles that have this permission */
  roles: TeamRole[]

  /** Category for grouping in UI (optional, used by features) */
  category?: string

  /** Whether this is a dangerous/destructive action */
  dangerous?: boolean
}

/**
 * Entity permission action definition (for theme-level entity permissions)
 * @deprecated Use PermissionAction instead - kept for backward compatibility
 */
export interface EntityPermissionAction {
  /** Action identifier (e.g., 'create', 'read', 'publish', 'archive') */
  action: EntityAction | string

  /** Human-readable label for the permission */
  label: string

  /** Detailed description of what this permission allows */
  description?: string

  /** Team roles that have this permission */
  roles: TeamRole[]

  /** Whether this is a dangerous/destructive action */
  dangerous?: boolean
}

/**
 * Theme permissions configuration
 * SINGLE SOURCE OF TRUTH for all permissions and roles
 */
export interface ThemePermissionsConfig {
  /**
   * Custom roles definition
   * Defines additional roles beyond core (owner, admin, member, viewer)
   */
  roles?: RolesConfig

  /**
   * Team-level permissions
   * Actions like team.view, team.edit, team.members.invite
   */
  teams?: PermissionAction[]

  /**
   * Theme-specific feature permissions
   * Uses unified action format (action instead of id)
   */
  features?: PermissionAction[]

  /**
   * Entity permissions - centralized definition of all entity permissions
   * Key: entity slug (e.g., 'customers', 'tasks')
   * Value: array of permission actions for that entity
   */
  entities?: Record<string, EntityPermissionAction[]>

  /** Override core permissions */
  overrides?: Record<Permission, PermissionOverride>

  /** IDs of core permissions to disable */
  disabled?: Permission[]

  /** Additional UI sections */
  uiSections?: PermissionUISection[]
}

// ==========================================
// ENTITY PERMISSIONS TYPE
// ==========================================

/**
 * Permissions configuration in EntityConfig
 */
export interface EntityPermissionsConfig {
  actions: {
    action: EntityAction | string
    label: string
    description?: string
    roles: TeamRole[]
    dangerous?: boolean
  }[]

  customActions?: {
    action: string
    label: string
    description?: string
    roles: TeamRole[]
    dangerous?: boolean
  }[]
}

// ==========================================
// RUNTIME TYPES
// ==========================================

/**
 * Resolved permission at runtime
 */
export interface ResolvedPermission extends PermissionConfig {
  source: 'core' | 'theme' | 'entity'
  disabled: boolean
}

/**
 * Permission matrix by role
 */
export type PermissionMatrix = Record<TeamRole, Permission[]>

// ==========================================
// MEMBERSHIP & ACTION TYPES
// ==========================================

/**
 * Reasons why an action might be denied
 */
export type ActionDeniedReason =
  | 'not_member'
  | 'permission_denied'
  | 'feature_disabled'
  | 'quota_exceeded'
  | 'subscription_inactive'

/**
 * Result of checking if an action is allowed
 */
export type ActionResult =
  | { allowed: true }
  | {
      allowed: false
      reason: ActionDeniedReason
      message: string
      meta?: Record<string, unknown>
    }

/**
 * Subscription information in membership context
 */
export interface MembershipSubscription {
  id: string
  planSlug: string
  planName: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'expired'
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
}

/**
 * Quota state for a specific limit
 */
export interface QuotaState {
  used: number
  limit: number
  unlimited: boolean
  remaining: number
}

/**
 * Team membership data structure
 */
export interface TeamMembershipData {
  userId: string
  teamId: string
  role: string | null
  hierarchy: number
  permissions: Permission[]
  subscription: MembershipSubscription | null
  features: string[]
  quotas: Record<string, QuotaState>
}
