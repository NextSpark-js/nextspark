/**
 * User Flags Service
 * 
 * Service for retrieving and managing user flags from metadata system.
 * Flags are stored in user metadata and control feature access.
 */

import type { UserFlag } from '../entities/types';
import { MetaService } from './meta.service';

// Simple in-memory cache for user flags
interface FlagCache {
  [userId: string]: {
    flags: UserFlag[];
    timestamp: number;
  };
}

const flagCache: FlagCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * UserFlagsService - Main service for user flags management
 */
export class UserFlagsService {
  /**
   * Get user flags from metadata
   */
  static async getUserFlags(userId: string): Promise<UserFlag[]> {
    try {
      // Check cache first
      const cached = flagCache[userId];
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.flags;
      }

      
      // Get user flags from metadata
      const flagsMetadata = await MetaService.getEntityMetas('user', userId, userId, false);
      
      // Extract flags from metadata - flags are stored in 'access' meta key
      const accessMeta = flagsMetadata['access'] as { flags?: UserFlag[] } | undefined;
      const flags: UserFlag[] = accessMeta?.flags || [];
      
      // Validate flags
      const validFlags = this.validateFlags(flags);
      
      // Cache the result
      flagCache[userId] = {
        flags: validFlags,
        timestamp: Date.now()
      };
      
      return validFlags;
    } catch (error) {
      console.error('Error retrieving user flags:', error);
      return [];
    }
  }

  /**
   * Set user flags in metadata
   */
  static async setUserFlags(userId: string, flags: UserFlag[]): Promise<void> {
    try {
      const validFlags = this.validateFlags(flags);
      
      
      // Get existing access metadata
      const existingAccessMeta = await MetaService.getSpecificEntityMetas('user', userId, ['access'], userId);
      const currentAccess = existingAccessMeta['access'] as Record<string, unknown> || {};
      
      // Update only the flags part
      const updatedAccess = {
        ...currentAccess,
        flags: validFlags
      };
      
      // Save back to metadata
      await MetaService.setEntityMeta('user', userId, 'access', updatedAccess, userId);
      
      // Update cache
      flagCache[userId] = {
        flags: validFlags,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error setting user flags:', error);
      throw new Error('Failed to set user flags');
    }
  }

  /**
   * Add a flag to user
   */
  static async addUserFlag(userId: string, flag: UserFlag): Promise<void> {
    const currentFlags = await this.getUserFlags(userId);
    if (!currentFlags.includes(flag)) {
      await this.setUserFlags(userId, [...currentFlags, flag]);
    }
  }

  /**
   * Remove a flag from user
   */
  static async removeUserFlag(userId: string, flag: UserFlag): Promise<void> {
    const currentFlags = await this.getUserFlags(userId);
    const updatedFlags = currentFlags.filter(f => f !== flag);
    await this.setUserFlags(userId, updatedFlags);
  }

  /**
   * Check if user has a specific flag
   */
  static async hasFlag(userId: string, flag: UserFlag): Promise<boolean> {
    const flags = await this.getUserFlags(userId);
    return flags.includes(flag);
  }

  /**
   * Check if user has any of the specified flags
   */
  static async hasAnyFlag(userId: string, flags: UserFlag[]): Promise<boolean> {
    const userFlags = await this.getUserFlags(userId);
    return flags.some(flag => userFlags.includes(flag));
  }

  /**
   * Check if user has all of the specified flags
   */
  static async hasAllFlags(userId: string, flags: UserFlag[]): Promise<boolean> {
    const userFlags = await this.getUserFlags(userId);
    return flags.every(flag => userFlags.includes(flag));
  }

  /**
   * Validate flags array
   */
  private static validateFlags(flags: unknown[]): UserFlag[] {
    const validFlagValues: UserFlag[] = [
      'beta_tester',
      'early_adopter', 
      'limited_access',
      'vip',
      'restricted',
      'experimental'
    ];

    return flags
      .filter((flag): flag is string => typeof flag === 'string')
      .filter((flag): flag is UserFlag => validFlagValues.includes(flag as UserFlag))
      .filter((flag, index, array) => array.indexOf(flag) === index); // Remove duplicates
  }

  /**
   * Clear cache for a user (useful when flags are updated externally)
   */
  static clearUserCache(userId: string): void {
    delete flagCache[userId];
  }

  /**
   * Clear all cache (useful for testing)
   */
  static clearAllCache(): void {
    Object.keys(flagCache).forEach(userId => {
      delete flagCache[userId];
    });
  }

  /**
   * Get bulk user flags for multiple users (optimized for performance)
   */
  static async getBulkUserFlags(userIds: string[]): Promise<Record<string, UserFlag[]>> {
    const result: Record<string, UserFlag[]> = {};
    
    // Check cache first for all users
    const uncachedUsers: string[] = [];
    for (const userId of userIds) {
      const cached = flagCache[userId];
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        result[userId] = cached.flags;
      } else {
        uncachedUsers.push(userId);
      }
    }

    // Fetch uncached users from database
    if (uncachedUsers.length > 0) {
      try {
        
        // Get bulk metadata for all uncached users
        const bulkMetadata = await MetaService.getBulkSpecificEntityMetas(
          'user', 
          uncachedUsers, 
          ['access'], 
          uncachedUsers[0] // Use first user as requester (all users should have access to their own data)
        );

        // Process each user's metadata
        for (const userId of uncachedUsers) {
          const userMetadata = bulkMetadata[userId] || {};
          const accessMeta = userMetadata['access'] as { flags?: UserFlag[] } | undefined;
          const flags = this.validateFlags(accessMeta?.flags || []);
          
          result[userId] = flags;
          
          // Cache the result
          flagCache[userId] = {
            flags,
            timestamp: Date.now()
          };
        }
      } catch (error) {
        console.error('Error in bulk user flags retrieval:', error);
        // Set empty arrays for failed users
        uncachedUsers.forEach(userId => {
          result[userId] = [];
        });
      }
    }

    return result;
  }
}

// Convenience functions for easier usage
export const getUserFlags = UserFlagsService.getUserFlags.bind(UserFlagsService);
export const setUserFlags = UserFlagsService.setUserFlags.bind(UserFlagsService);
export const addUserFlag = UserFlagsService.addUserFlag.bind(UserFlagsService);
export const removeUserFlag = UserFlagsService.removeUserFlag.bind(UserFlagsService);
export const hasFlag = UserFlagsService.hasFlag.bind(UserFlagsService);
export const hasAnyFlag = UserFlagsService.hasAnyFlag.bind(UserFlagsService);
export const hasAllFlags = UserFlagsService.hasAllFlags.bind(UserFlagsService);
export const getBulkUserFlags = UserFlagsService.getBulkUserFlags.bind(UserFlagsService);