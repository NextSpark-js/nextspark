/**
 * User Service
 *
 * Provides core user management functions including CRUD operations
 * and metadata management for users.
 *
 * @module UserService
 */
import type { User, UserRole } from '../../types/user.types';
import type { MetaDataType } from '../../types/meta.types';
export interface UpdateUserPayload {
    firstName?: string;
    lastName?: string;
    name?: string;
    image?: string;
    country?: string;
    timezone?: string;
    language?: string;
    role?: UserRole;
}
export declare class UserService {
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
    static getUser(identifier: string, currentUserId: string): Promise<User | null>;
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
    static getUserByEmail(email: string, currentUserId: string): Promise<User | null>;
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
    static getUserById(userId: string, currentUserId: string): Promise<User | null>;
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
    static getUsersByIds(userIds: string[], currentUserId: string): Promise<User[]>;
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
    static updateUser(userId: string, updates: UpdateUserPayload, currentUserId: string): Promise<User>;
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
    static getUserMetas(userId: string, currentUserId: string, includePrivate?: boolean): Promise<Record<string, unknown>>;
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
    static getUserMeta(userId: string, metaKey: string, currentUserId: string): Promise<unknown>;
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
    static getSpecificUserMetas(userId: string, metaKeys: string[], currentUserId: string): Promise<Record<string, unknown>>;
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
    static updateUserMeta(userId: string, metaKey: string, metaValue: unknown, currentUserId: string, options?: {
        isPublic?: boolean;
        isSearchable?: boolean;
        dataType?: MetaDataType;
    }): Promise<void>;
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
    static updateUserMetas(userId: string, metas: Record<string, unknown>, currentUserId: string, options?: {
        isPublic?: boolean;
        isSearchable?: boolean;
        dataType?: MetaDataType;
    }): Promise<void>;
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
    static deleteUserMeta(userId: string, metaKey: string, currentUserId: string): Promise<void>;
    /**
     * Delete all metadata for a user
     *
     * @param userId - ID of the user
     * @param currentUserId - ID of the user making the request (for RLS)
     *
     * @example
     * await UserService.deleteAllUserMetas('user-id-123', 'current-user-id')
     */
    static deleteAllUserMetas(userId: string, currentUserId: string): Promise<void>;
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
    static getBulkUserMetas(userIds: string[], currentUserId: string, includePrivate?: boolean): Promise<Record<string, Record<string, unknown>>>;
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
    static searchUsersByMeta(metaKey: string, metaValue: unknown, currentUserId: string, limit?: number, offset?: number): Promise<{
        entities: string[];
        total: number;
    }>;
}
//# sourceMappingURL=user.service.d.ts.map