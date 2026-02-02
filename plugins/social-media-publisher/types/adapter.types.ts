/**
 * Social Media Publisher Plugin - Adapter Types
 *
 * These types define the interface that themes must implement
 * to integrate with the social-media-publisher plugin.
 *
 * The adapter pattern allows the plugin to be agnostic of the
 * specific entity structure used by each theme.
 */

/**
 * Configuration for registering a social platform adapter.
 * Themes provide this to tell the plugin how their entity structure works.
 */
export interface SocialPlatformAdapterConfig {
  /**
   * The entity slug that social accounts are assigned to.
   * @example 'clients' in content-buddy, 'projects' in another theme
   */
  entitySlug: string

  /**
   * The database table name for storing platform assignments.
   * @example 'clients_social_platforms'
   */
  tableName: string

  /**
   * The column name that references the parent entity ID.
   * @example 'parentId' or 'clientId'
   */
  parentIdColumn: string

  /**
   * How permissions are verified for this entity.
   * - 'team': Check via team_members table (most common)
   * - 'owner': Check via userId/ownerId column
   * - 'custom': Adapter implements custom logic
   */
  permissionCheck: 'team' | 'owner' | 'custom'
}

/**
 * Data required to save a social platform assignment.
 * Passed to adapter.saveAssignment() after OAuth or manual assignment.
 */
export interface AssignmentData {
  /** The parent entity ID (e.g., clientId) */
  entityId: string

  /** Platform type: 'instagram_business' | 'facebook_page' | etc */
  platform: string

  /** External platform account ID (from Meta API) */
  platformAccountId: string

  /** Display username for the account */
  username: string

  /** Access token (will be encrypted by adapter) */
  accessToken: string

  /** When the token expires */
  tokenExpiresAt: Date

  /** Granted permissions/scopes */
  permissions: string[]

  /** Additional platform-specific metadata */
  accountMetadata: Record<string, unknown>

  /** Reference to social_accounts table (user-level token storage) */
  socialAccountId: string
}

/**
 * A social platform assignment record.
 * Returned by adapter.getAssignments().
 */
export interface SocialPlatformAssignment {
  /** Assignment record ID */
  id: string

  /** Parent entity ID */
  entityId: string

  /** Platform type */
  platform: string

  /** External platform account ID */
  platformAccountId: string

  /** Display username */
  username: string

  /** Encrypted access token */
  accessToken: string

  /** Token expiration date */
  tokenExpiresAt: Date

  /** Whether assignment is active */
  isActive: boolean

  /** Platform-specific metadata */
  accountMetadata: Record<string, unknown>
}

/**
 * Result of an entity access check.
 * Returned by adapter.checkEntityAccess().
 */
export interface EntityAccessResult {
  /** Whether the user has access to the entity */
  hasAccess: boolean

  /** Team ID if applicable (for team-based permissions) */
  teamId?: string

  /** Reason for denial if hasAccess is false */
  reason?: string
}

/**
 * Result of a save assignment operation.
 * Returned by adapter.saveAssignment().
 */
export interface SaveAssignmentResult {
  /** The assignment record ID (new or existing) */
  id: string

  /** Whether this was a new assignment or an update */
  isNew: boolean
}

/**
 * Lightweight account lookup result.
 * Returned by adapter.getAccountById() for quick lookups without full token data.
 * Used by publish endpoint to find account and derive parent entity for access checks.
 */
export interface AccountLookupResult {
  /** Assignment record ID */
  id: string

  /** Parent entity ID (e.g., clientId) - used for access verification */
  parentEntityId: string

  /** Platform type */
  platform: string

  /** External platform account ID */
  platformAccountId: string

  /** Display username */
  username: string

  /** Whether assignment is active */
  isActive: boolean
}
