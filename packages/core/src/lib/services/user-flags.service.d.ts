/**
 * User Flags Service
 *
 * Service for retrieving and managing user flags from metadata system.
 * Flags are stored in user metadata and control feature access.
 */
import type { UserFlag } from '../entities/types';
/**
 * UserFlagsService - Main service for user flags management
 */
export declare class UserFlagsService {
    /**
     * Get user flags from metadata
     */
    static getUserFlags(userId: string): Promise<UserFlag[]>;
    /**
     * Set user flags in metadata
     */
    static setUserFlags(userId: string, flags: UserFlag[]): Promise<void>;
    /**
     * Add a flag to user
     */
    static addUserFlag(userId: string, flag: UserFlag): Promise<void>;
    /**
     * Remove a flag from user
     */
    static removeUserFlag(userId: string, flag: UserFlag): Promise<void>;
    /**
     * Check if user has a specific flag
     */
    static hasFlag(userId: string, flag: UserFlag): Promise<boolean>;
    /**
     * Check if user has any of the specified flags
     */
    static hasAnyFlag(userId: string, flags: UserFlag[]): Promise<boolean>;
    /**
     * Check if user has all of the specified flags
     */
    static hasAllFlags(userId: string, flags: UserFlag[]): Promise<boolean>;
    /**
     * Validate flags array
     */
    private static validateFlags;
    /**
     * Clear cache for a user (useful when flags are updated externally)
     */
    static clearUserCache(userId: string): void;
    /**
     * Clear all cache (useful for testing)
     */
    static clearAllCache(): void;
    /**
     * Get bulk user flags for multiple users (optimized for performance)
     */
    static getBulkUserFlags(userIds: string[]): Promise<Record<string, UserFlag[]>>;
}
export declare const getUserFlags: any;
export declare const setUserFlags: any;
export declare const addUserFlag: any;
export declare const removeUserFlag: any;
export declare const hasFlag: any;
export declare const hasAnyFlag: any;
export declare const hasAllFlags: any;
export declare const getBulkUserFlags: any;
//# sourceMappingURL=user-flags.service.d.ts.map