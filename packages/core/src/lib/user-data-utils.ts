/**
 * User Data Utilities (Client-Safe)
 * 
 * Client-side utilities for handling user plan and flag data.
 * These functions don't require database access and are safe for client-side usage.
 */

import type { PlanType, UserFlag } from './entities/types'
import type { SessionUser } from './auth'

// Default values for fallbacks
const DEFAULT_PLAN: PlanType = 'free'
const DEFAULT_FLAGS: UserFlag[] = []

// Cache for user data to avoid repeated database queries
const userDataCache = new Map<string, {
  plan: PlanType
  flags: UserFlag[]
  timestamp: number
}>()

/**
 * Get user plan and flags from session user (for client-side usage)
 * This is a convenience function that extracts plan data from user session
 * 
 * Note: This returns defaults for client-side usage. For actual data,
 * use getUserPlanAndFlags() on the server side.
 */
export function extractUserPlanData(user: SessionUser | null): {
  plan: PlanType
  flags: UserFlag[]
} {
  if (!user) {
    return {
      plan: DEFAULT_PLAN,
      flags: DEFAULT_FLAGS
    }
  }

  // Return defaults for client-side - actual data should be fetched separately
  // This function is mainly used as a fallback until real data is loaded
  return {
    plan: DEFAULT_PLAN,
    flags: DEFAULT_FLAGS
  }
}

/**
 * Clear user data cache (useful for testing or forced refresh)
 */
export function clearUserDataCache(userId?: string): void {
  if (userId) {
    userDataCache.delete(userId)
  } else {
    userDataCache.clear()
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export function getUserDataCacheStats(): {
  size: number
  keys: string[]
  oldestEntry: number | null
  newestEntry: number | null
} {
  const entries = Array.from(userDataCache.entries())
  
  return {
    size: userDataCache.size,
    keys: entries.map(([key]) => key),
    oldestEntry: entries.length > 0 ? Math.min(...entries.map(([, data]) => data.timestamp)) : null,
    newestEntry: entries.length > 0 ? Math.max(...entries.map(([, data]) => data.timestamp)) : null
  }
}