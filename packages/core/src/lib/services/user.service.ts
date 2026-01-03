/**
 * User Service
 *
 * Provides core user management functions including CRUD operations
 * and metadata management for users.
 *
 * @module UserService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '../db'
import { MetaService } from './meta.service'
import type { User, UserRole } from '../../types/user.types'
import type { MetaDataType } from '../../types/meta.types'

// Update payload type
export interface UpdateUserPayload {
  firstName?: string
  lastName?: string
  name?: string
  image?: string
  country?: string
  timezone?: string
  language?: string
  role?: UserRole
}

// Database user type (matches database schema)
interface DbUser {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  role: UserRole
  image?: string
  emailVerified?: boolean
  createdAt?: Date
  updatedAt?: Date
  country?: string
  timezone?: string
  language?: string
}

export class UserService {
  /**
   * Get user by ID or email
   *
   * @param identifier - User ID or email address
   * @param currentUserId - ID of the user making the request (for RLS)
   * @returns User object or null if not found
   *
   * @example
   * const user = await UserService.getUser('user-id-123', 'current-user-id')
   * const userByEmail = await UserService.getUser('user@example.com', 'current-user-id')
   */
  static async getUser(
    identifier: string,
    currentUserId: string
  ): Promise<User | null> {
    try {
      if (!identifier || identifier.trim() === '') {
        throw new Error('User identifier (ID or email) is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      const user = await queryOneWithRLS<DbUser>(
        `SELECT
          id,
          email,
          name,
          "firstName",
          "lastName",
          image,
          country,
          timezone,
          language,
          role,
          "emailVerified",
          "createdAt",
          "updatedAt"
        FROM "user"
        WHERE id = $1 OR email = $1`,
        [identifier],
        currentUserId
      )

      return user
    } catch (error) {
      console.error('UserService.getUser error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch user'
      )
    }
  }

  /**
   * Get user by email only (convenience method)
   *
   * @param email - User email address
   * @param currentUserId - ID of the user making the request (for RLS)
   * @returns User object or null if not found
   *
   * @example
   * const user = await UserService.getUserByEmail('user@example.com', 'current-user-id')
   */
  static async getUserByEmail(
    email: string,
    currentUserId: string
  ): Promise<User | null> {
    try {
      if (!email || email.trim() === '') {
        throw new Error('Email is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      const user = await queryOneWithRLS<DbUser>(
        `SELECT
          id,
          email,
          name,
          "firstName",
          "lastName",
          image,
          country,
          timezone,
          language,
          role,
          "emailVerified",
          "createdAt",
          "updatedAt"
        FROM "user"
        WHERE email = $1`,
        [email],
        currentUserId
      )

      return user
    } catch (error) {
      console.error('UserService.getUserByEmail error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch user by email'
      )
    }
  }

  /**
   * Get user by ID only (convenience method)
   *
   * @param userId - User ID
   * @param currentUserId - ID of the user making the request (for RLS)
   * @returns User object or null if not found
   *
   * @example
   * const user = await UserService.getUserById('user-id-123', 'current-user-id')
   */
  static async getUserById(
    userId: string,
    currentUserId: string
  ): Promise<User | null> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      const user = await queryOneWithRLS<DbUser>(
        `SELECT
          id,
          email,
          name,
          "firstName",
          "lastName",
          image,
          country,
          timezone,
          language,
          role,
          "emailVerified",
          "createdAt",
          "updatedAt"
        FROM "user"
        WHERE id = $1`,
        [userId],
        currentUserId
      )

      return user
    } catch (error) {
      console.error('UserService.getUserById error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch user by ID'
      )
    }
  }

  /**
   * Get multiple users by IDs (bulk operation)
   *
   * @param userIds - Array of user IDs
   * @param currentUserId - ID of the user making the request (for RLS)
   * @returns Array of user objects
   *
   * @example
   * const users = await UserService.getUsersByIds(['id-1', 'id-2'], 'current-user-id')
   */
  static async getUsersByIds(
    userIds: string[],
    currentUserId: string
  ): Promise<User[]> {
    try {
      if (!userIds || userIds.length === 0) {
        return []
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      // Create placeholders for the IDs
      const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',')

      const users = await queryWithRLS<DbUser>(
        `SELECT
          id,
          email,
          name,
          "firstName",
          "lastName",
          image,
          country,
          timezone,
          language,
          role,
          "emailVerified",
          "createdAt",
          "updatedAt"
        FROM "user"
        WHERE id IN (${placeholders})`,
        userIds,
        currentUserId
      )

      return users
    } catch (error) {
      console.error('UserService.getUsersByIds error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch users by IDs'
      )
    }
  }

  /**
   * Update user information
   *
   * @param userId - ID of the user to update
   * @param updates - Partial user data to update
   * @param currentUserId - ID of the user making the request (for RLS)
   * @returns Updated user object
   *
   * @example
   * const updated = await UserService.updateUser(
   *   'user-id-123',
   *   { firstName: 'John', lastName: 'Doe' },
   *   'current-user-id'
   * )
   */
  static async updateUser(
    userId: string,
    updates: UpdateUserPayload,
    currentUserId: string
  ): Promise<User> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('At least one field must be provided for update')
      }

      // Build dynamic update query
      const updateFields: string[] = []
      const values: unknown[] = []
      let paramCount = 1

      // Map of allowed fields to database columns
      const fieldMap: Record<string, string> = {
        firstName: '"firstName"',
        lastName: '"lastName"',
        name: 'name',
        image: 'image',
        country: 'country',
        timezone: 'timezone',
        language: 'language',
        role: 'role',
      }

      // Build SET clause dynamically
      Object.entries(updates).forEach(([key, value]) => {
        if (key in fieldMap && value !== undefined) {
          updateFields.push(`${fieldMap[key]} = $${paramCount++}`)
          values.push(value)
        }
      })

      if (updateFields.length === 0) {
        throw new Error('No valid fields provided for update')
      }

      // Add updatedAt timestamp
      updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`)

      // Add userId as the last parameter
      values.push(userId)

      const query = `
        UPDATE "user"
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING
          id,
          email,
          name,
          "firstName",
          "lastName",
          image,
          country,
          timezone,
          language,
          role,
          "emailVerified",
          "createdAt",
          "updatedAt"
      `

      const result = await mutateWithRLS<DbUser>(
        query,
        values,
        currentUserId
      )

      if (!result.rows[0]) {
        throw new Error('User not found or update failed')
      }

      return result.rows[0]
    } catch (error) {
      console.error('UserService.updateUser error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to update user'
      )
    }
  }

  /**
   * Get all metadata for a user
   * Wrapper around MetaService for user-specific metadata
   *
   * @param userId - ID of the user
   * @param currentUserId - ID of the user making the request (for RLS)
   * @param includePrivate - Whether to include private metadata (default: false)
   * @returns Object with metadata key-value pairs
   *
   * @example
   * const metas = await UserService.getUserMetas('user-id-123', 'current-user-id')
   * // Returns: { theme: 'dark', notifications: true, ... }
   */
  static async getUserMetas(
    userId: string,
    currentUserId: string,
    includePrivate = false
  ): Promise<Record<string, unknown>> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      return await MetaService.getEntityMetas(
        'user',
        userId,
        currentUserId,
        includePrivate
      )
    } catch (error) {
      console.error('UserService.getUserMetas error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch user metadata'
      )
    }
  }

  /**
   * Get specific metadata value for a user
   *
   * @param userId - ID of the user
   * @param metaKey - The metadata key to fetch
   * @param currentUserId - ID of the user making the request (for RLS)
   * @returns Metadata value or null if not found
   *
   * @example
   * const theme = await UserService.getUserMeta('user-id-123', 'theme', 'current-user-id')
   * // Returns: 'dark'
   */
  static async getUserMeta(
    userId: string,
    metaKey: string,
    currentUserId: string
  ): Promise<unknown> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!metaKey || metaKey.trim() === '') {
        throw new Error('Meta key is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      return await MetaService.getEntityMeta(
        'user',
        userId,
        metaKey,
        currentUserId
      )
    } catch (error) {
      console.error('UserService.getUserMeta error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch user metadata'
      )
    }
  }

  /**
   * Get specific metadata keys for a user
   *
   * @param userId - ID of the user
   * @param metaKeys - Array of metadata keys to fetch
   * @param currentUserId - ID of the user making the request (for RLS)
   * @returns Object with requested metadata key-value pairs
   *
   * @example
   * const metas = await UserService.getSpecificUserMetas(
   *   'user-id-123',
   *   ['theme', 'language'],
   *   'current-user-id'
   * )
   * // Returns: { theme: 'dark', language: 'en' }
   */
  static async getSpecificUserMetas(
    userId: string,
    metaKeys: string[],
    currentUserId: string
  ): Promise<Record<string, unknown>> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!metaKeys || metaKeys.length === 0) {
        return {}
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      return await MetaService.getSpecificEntityMetas(
        'user',
        userId,
        metaKeys,
        currentUserId
      )
    } catch (error) {
      console.error('UserService.getSpecificUserMetas error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch specific user metadata'
      )
    }
  }

  /**
   * Set or update a single user metadata value
   *
   * @param userId - ID of the user
   * @param metaKey - The metadata key
   * @param metaValue - The metadata value (will be stored as JSON)
   * @param currentUserId - ID of the user making the request (for RLS)
   * @param options - Additional options (isPublic, isSearchable, dataType)
   *
   * @example
   * await UserService.updateUserMeta(
   *   'user-id-123',
   *   'theme',
   *   'dark',
   *   'current-user-id',
   *   { isPublic: false }
   * )
   */
  static async updateUserMeta(
    userId: string,
    metaKey: string,
    metaValue: unknown,
    currentUserId: string,
    options?: { isPublic?: boolean; isSearchable?: boolean; dataType?: MetaDataType }
  ): Promise<void> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!metaKey || metaKey.trim() === '') {
        throw new Error('Meta key is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      await MetaService.setEntityMeta(
        'user',
        userId,
        metaKey,
        metaValue,
        currentUserId,
        options
      )
    } catch (error) {
      console.error('UserService.updateUserMeta error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to update user metadata'
      )
    }
  }

  /**
   * Set or update multiple user metadata values in bulk
   * More efficient than calling updateUserMeta multiple times
   *
   * @param userId - ID of the user
   * @param metas - Object with metadata key-value pairs
   * @param currentUserId - ID of the user making the request (for RLS)
   * @param options - Additional options (isPublic, isSearchable, dataType)
   *
   * @example
   * await UserService.updateUserMetas(
   *   'user-id-123',
   *   { theme: 'dark', language: 'en', notifications: true },
   *   'current-user-id'
   * )
   */
  static async updateUserMetas(
    userId: string,
    metas: Record<string, unknown>,
    currentUserId: string,
    options?: { isPublic?: boolean; isSearchable?: boolean; dataType?: MetaDataType }
  ): Promise<void> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!metas || Object.keys(metas).length === 0) {
        throw new Error('At least one metadata key-value pair is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      await MetaService.setBulkEntityMetas(
        'user',
        userId,
        metas,
        currentUserId,
        options
      )
    } catch (error) {
      console.error('UserService.updateUserMetas error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to update user metadata'
      )
    }
  }

  /**
   * Delete a specific user metadata key
   *
   * @param userId - ID of the user
   * @param metaKey - The metadata key to delete
   * @param currentUserId - ID of the user making the request (for RLS)
   *
   * @example
   * await UserService.deleteUserMeta('user-id-123', 'theme', 'current-user-id')
   */
  static async deleteUserMeta(
    userId: string,
    metaKey: string,
    currentUserId: string
  ): Promise<void> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!metaKey || metaKey.trim() === '') {
        throw new Error('Meta key is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      await MetaService.deleteEntityMeta(
        'user',
        userId,
        metaKey,
        currentUserId
      )
    } catch (error) {
      console.error('UserService.deleteUserMeta error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to delete user metadata'
      )
    }
  }

  /**
   * Delete all metadata for a user
   *
   * @param userId - ID of the user
   * @param currentUserId - ID of the user making the request (for RLS)
   *
   * @example
   * await UserService.deleteAllUserMetas('user-id-123', 'current-user-id')
   */
  static async deleteAllUserMetas(
    userId: string,
    currentUserId: string
  ): Promise<void> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      await MetaService.deleteAllEntityMetas(
        'user',
        userId,
        currentUserId
      )
    } catch (error) {
      console.error('UserService.deleteAllUserMetas error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to delete all user metadata'
      )
    }
  }

  /**
   * Get metadata for multiple users in bulk (solves N+1 query problem)
   *
   * @param userIds - Array of user IDs
   * @param currentUserId - ID of the user making the request (for RLS)
   * @param includePrivate - Whether to include private metadata (default: false)
   * @returns Object mapping user IDs to their metadata
   *
   * @example
   * const metas = await UserService.getBulkUserMetas(
   *   ['user-1', 'user-2'],
   *   'current-user-id'
   * )
   * // Returns: { 'user-1': { theme: 'dark' }, 'user-2': { theme: 'light' } }
   */
  static async getBulkUserMetas(
    userIds: string[],
    currentUserId: string,
    includePrivate = false
  ): Promise<Record<string, Record<string, unknown>>> {
    try {
      if (!userIds || userIds.length === 0) {
        return {}
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      return await MetaService.getBulkEntityMetas(
        'user',
        userIds,
        currentUserId,
        includePrivate
      )
    } catch (error) {
      console.error('UserService.getBulkUserMetas error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch bulk user metadata'
      )
    }
  }

  /**
   * Search users by metadata
   *
   * @param metaKey - The metadata key to search
   * @param metaValue - The metadata value to match
   * @param currentUserId - ID of the user making the request (for RLS)
   * @param limit - Maximum number of results (default: 100)
   * @param offset - Offset for pagination (default: 0)
   * @returns Object with user IDs and total count
   *
   * @example
   * const result = await UserService.searchUsersByMeta(
   *   'theme',
   *   'dark',
   *   'current-user-id',
   *   50,
   *   0
   * )
   * // Returns: { entities: ['user-1', 'user-2'], total: 2 }
   */
  static async searchUsersByMeta(
    metaKey: string,
    metaValue: unknown,
    currentUserId: string,
    limit = 100,
    offset = 0
  ): Promise<{ entities: string[]; total: number }> {
    try {
      if (!metaKey || metaKey.trim() === '') {
        throw new Error('Meta key is required')
      }

      if (!currentUserId || currentUserId.trim() === '') {
        throw new Error('Current user ID is required for authentication')
      }

      return await MetaService.searchByMeta(
        'user',
        metaKey,
        metaValue,
        currentUserId,
        limit,
        offset
      )
    } catch (error) {
      console.error('UserService.searchUsersByMeta error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to search users by metadata'
      )
    }
  }
}