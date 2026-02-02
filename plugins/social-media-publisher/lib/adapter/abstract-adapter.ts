/**
 * Social Media Publisher Plugin - Abstract Adapter
 *
 * This abstract class defines the contract that themes must implement
 * to integrate with the social-media-publisher plugin.
 *
 * The adapter handles all theme-specific operations:
 * - Entity access verification (e.g., team membership checks)
 * - Assignment storage (e.g., clients_social_platforms table)
 * - Assignment retrieval and deletion
 *
 * The plugin handles generic operations:
 * - OAuth flow (Facebook/Instagram)
 * - Token encryption/storage (social_accounts table)
 * - Audit logging
 * - Publishing to social media APIs
 */

import type {
  SocialPlatformAdapterConfig,
  AssignmentData,
  SocialPlatformAssignment,
  EntityAccessResult,
  SaveAssignmentResult,
  AccountLookupResult
} from '../../types/adapter.types'

/**
 * Abstract adapter that themes must extend to integrate
 * with the social-media-publisher plugin.
 *
 * @example
 * ```typescript
 * // In theme: lib/social-media/clients-adapter.ts
 * import { SocialPlatformAdapter } from '@/plugins/social-media-publisher/lib/adapter'
 *
 * class ClientsSocialPlatformAdapter extends SocialPlatformAdapter {
 *   constructor() {
 *     super({
 *       entitySlug: 'clients',
 *       tableName: 'clients_social_platforms',
 *       parentIdColumn: 'parentId',
 *       permissionCheck: 'team'
 *     })
 *   }
 *
 *   async checkEntityAccess(userId, entityId) {
 *     // Implement team membership check
 *   }
 *
 *   // ... other methods
 * }
 * ```
 */
export abstract class SocialPlatformAdapter {
  constructor(protected config: SocialPlatformAdapterConfig) {}

  /**
   * Check if a user has access to the specified entity.
   *
   * Implementation should verify based on permissionCheck type:
   * - 'team': Check via team_members table
   * - 'owner': Check via userId/ownerId column
   * - 'custom': Custom logic
   *
   * @param userId - The authenticated user's ID
   * @param entityId - The entity ID to check access for
   * @returns Access result with hasAccess flag and optional teamId
   */
  abstract checkEntityAccess(
    userId: string,
    entityId: string
  ): Promise<EntityAccessResult>

  /**
   * Get all social platform assignments for an entity.
   *
   * @param entityId - The parent entity ID
   * @param userId - The authenticated user's ID (for RLS)
   * @returns Array of platform assignments
   */
  abstract getAssignments(
    entityId: string,
    userId: string
  ): Promise<SocialPlatformAssignment[]>

  /**
   * Get platform account IDs already assigned to an entity.
   * Used to check for duplicates during new assignment.
   *
   * @param entityId - The parent entity ID
   * @param userId - The authenticated user's ID (for RLS)
   * @returns Set of platformAccountId values
   */
  abstract getAssignedPlatformIds(
    entityId: string,
    userId: string
  ): Promise<Set<string>>

  /**
   * Save a new social platform assignment or update existing.
   *
   * If an assignment with the same entityId + platformAccountId exists,
   * update it. Otherwise, create a new one.
   *
   * @param data - Assignment data including tokens and metadata
   * @param userId - The authenticated user's ID (for RLS)
   * @returns Result with ID and whether it was new or updated
   */
  abstract saveAssignment(
    data: AssignmentData,
    userId: string
  ): Promise<SaveAssignmentResult>

  /**
   * Remove (soft-delete) a social platform assignment.
   *
   * Typically sets isActive = false rather than hard delete.
   *
   * @param assignmentId - The assignment record ID
   * @param userId - The authenticated user's ID (for RLS)
   */
  abstract removeAssignment(
    assignmentId: string,
    userId: string
  ): Promise<void>

  /**
   * Look up an account by its ID and platform.
   *
   * This is a lightweight lookup that returns basic account info
   * including the parent entity ID (for access verification).
   * Does NOT include tokens - use getAssignments() for full data.
   *
   * Used by publish endpoint to:
   * 1. Find the account by accountId
   * 2. Derive the parent entity ID for access checks
   * 3. Avoid requiring callers to know the parent entity ID
   *
   * @param accountId - The assignment record ID
   * @param platform - The platform type for additional verification
   * @param userId - The authenticated user's ID (for RLS)
   * @returns Account info or null if not found
   */
  abstract getAccountById(
    accountId: string,
    platform: string,
    userId: string
  ): Promise<AccountLookupResult | null>

  /**
   * Get the configuration for this adapter.
   * Used by plugin to understand entity structure.
   */
  getConfig(): SocialPlatformAdapterConfig {
    return this.config
  }

  /**
   * Get the entity slug (shorthand for config.entitySlug).
   */
  getEntitySlug(): string {
    return this.config.entitySlug
  }

  /**
   * Get the table name (shorthand for config.tableName).
   */
  getTableName(): string {
    return this.config.tableName
  }
}
