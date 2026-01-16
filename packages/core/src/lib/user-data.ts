/**
 * User Plan & Flag Data Integration
 *
 * Provides dynamic retrieval of user plan and flags from the database
 * via users_metas table. Replaces hardcoded values throughout the system.
 */

import type { PoolClient } from 'pg'
import { getPool, isPoolHealthy } from './db'
import type { PlanType, UserFlag } from './entities/types'
import type { SessionUser } from './auth'

// Default values for fallbacks
const DEFAULT_PLAN: PlanType = 'free'
const DEFAULT_FLAGS: UserFlag[] = []

// Error handling configuration
const isDevelopment = process.env.NODE_ENV !== 'production'

// Cache for user data to avoid repeated database queries
const userDataCache = new Map<string, {
  plan: PlanType
  flags: UserFlag[]
  timestamp: number
}>()

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000

// Maximum cache size to prevent unbounded growth
const MAX_CACHE_SIZE = 10000

/**
 * Evict oldest entries from cache when size limit is exceeded
 * Uses LRU-like eviction based on timestamp
 * @internal
 */
function evictOldestCacheEntries(): void {
  if (userDataCache.size <= MAX_CACHE_SIZE) {
    return
  }

  // Get entries sorted by timestamp (oldest first)
  const entries = Array.from(userDataCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)

  // Remove oldest 10% of entries to avoid frequent eviction
  const entriesToRemove = Math.max(1, Math.floor(entries.length * 0.1))
  for (let i = 0; i < entriesToRemove; i++) {
    userDataCache.delete(entries[i][0])
  }

  console.log(`[UserData] Cache eviction: removed ${entriesToRemove} oldest entries, size now ${userDataCache.size}`)
}

/**
 * Interface for user plan and flag data
 * @property plan - User's subscription plan type (free, starter, premium)
 * @property flags - Array of feature flags assigned to the user
 * @property cached - Whether this data was retrieved from cache vs database
 */
export interface UserPlanData {
  plan: PlanType
  flags: UserFlag[]
  cached: boolean
}


/**
 * Custom error class for user data operations
 */
export class UserDataError extends Error {
  constructor(
    message: string,
    public readonly userId: string,
    public readonly operation: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'UserDataError'
  }
}

/**
 * Get user plan and flags from database
 * Uses user_metas table to store plan and flags data
 *
 * @throws UserDataError in production when database operations fail
 */
export async function getUserPlanAndFlags(userId: string): Promise<UserPlanData> {
  // Check cache first
  const cached = userDataCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      plan: cached.plan,
      flags: cached.flags,
      cached: true
    }
  }

  // Check pool health before attempting connection
  if (!isPoolHealthy()) {
    const error = new UserDataError(
      'Database pool is not healthy',
      userId,
      'getUserPlanAndFlags'
    )
    console.error('[UserData] Pool unhealthy:', error.message)

    if (!isDevelopment) {
      throw error
    }
    // FIX: Log warning in development so issues don't go unnoticed
    console.warn('[UserData] Using defaults due to pool health check failure in development')
    return { plan: DEFAULT_PLAN, flags: DEFAULT_FLAGS, cached: false }
  }

  let client: PoolClient | null = null

  try {
    client = await getPool().connect()

    // Query users_metas for plan and flags
    const query = `
      SELECT
        "metaKey",
        "metaValue"
      FROM "users_metas"
      WHERE "userId" = $1
      AND "metaKey" IN ('user_plan', 'user_flags')
    `

    const result = await client.query(query, [userId])

    let plan: PlanType = DEFAULT_PLAN
    let flags: UserFlag[] = DEFAULT_FLAGS

    // Process results
    for (const row of result.rows) {
      if (row.metaKey === 'user_plan') {
        const planValue = row.metaValue
        if (typeof planValue === 'string' && ['free', 'starter', 'premium'].includes(planValue)) {
          plan = planValue as PlanType
        }
      } else if (row.metaKey === 'user_flags') {
        const flagsValue = row.metaValue
        if (Array.isArray(flagsValue)) {
          // Validate flags array
          const validFlags = flagsValue.filter(flag =>
            typeof flag === 'string' &&
            ['beta_tester', 'early_adopter', 'limited_access', 'vip', 'restricted', 'experimental'].includes(flag)
          )
          flags = validFlags as UserFlag[]
        }
      }
    }

    // Cache the result
    userDataCache.set(userId, {
      plan,
      flags,
      timestamp: Date.now()
    })

    // Evict oldest entries if cache is too large
    evictOldestCacheEntries()

    return {
      plan,
      flags,
      cached: false
    }

  } catch (error) {
    const wrappedError = new UserDataError(
      `Failed to get user plan and flags: ${error instanceof Error ? error.message : 'Unknown error'}`,
      userId,
      'getUserPlanAndFlags',
      error
    )

    console.error('[UserData] Error:', wrappedError.message, {
      userId,
      operation: 'getUserPlanAndFlags',
      originalError: error
    })

    // In production, throw the error to surface issues
    // In development, return defaults for easier testing
    if (!isDevelopment) {
      throw wrappedError
    }

    return {
      plan: DEFAULT_PLAN,
      flags: DEFAULT_FLAGS,
      cached: false
    }
  } finally {
    // Release client back to pool (NEVER call pool.end())
    if (client) {
      client.release()
    }
  }
}

/**
 * Update user plan in database
 *
 * @throws UserDataError in production when database operations fail
 */
export async function updateUserPlan(userId: string, plan: PlanType): Promise<boolean> {
  // Check pool health before attempting connection
  if (!isPoolHealthy()) {
    const error = new UserDataError(
      'Database pool is not healthy',
      userId,
      'updateUserPlan'
    )
    console.error('[UserData] Pool unhealthy:', error.message)

    if (!isDevelopment) {
      throw error
    }
    // FIX: Log warning in development so issues don't go unnoticed
    console.warn('[UserData] Using defaults due to pool health check failure in development')
    return false
  }

  let client: PoolClient | null = null

  try {
    client = await getPool().connect()

    const query = `
      INSERT INTO "users_metas" ("userId", "metaKey", "metaValue", "dataType", "updatedAt")
      VALUES ($1, 'user_plan', $2, 'string', CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "metaKey")
      DO UPDATE SET
        "metaValue" = EXCLUDED."metaValue",
        "updatedAt" = CURRENT_TIMESTAMP
    `

    await client.query(query, [userId, plan])

    // Clear cache for this user
    userDataCache.delete(userId)

    return true

  } catch (error) {
    const wrappedError = new UserDataError(
      `Failed to update user plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      userId,
      'updateUserPlan',
      error
    )

    console.error('[UserData] Error:', wrappedError.message, {
      userId,
      operation: 'updateUserPlan',
      plan,
      originalError: error
    })

    if (!isDevelopment) {
      throw wrappedError
    }
    return false
  } finally {
    if (client) {
      client.release()
    }
  }
}

/**
 * Update user flags in database
 *
 * @throws UserDataError in production when database operations fail
 */
export async function updateUserFlags(userId: string, flags: UserFlag[]): Promise<boolean> {
  // Check pool health before attempting connection
  if (!isPoolHealthy()) {
    const error = new UserDataError(
      'Database pool is not healthy',
      userId,
      'updateUserFlags'
    )
    console.error('[UserData] Pool unhealthy:', error.message)

    if (!isDevelopment) {
      throw error
    }
    // FIX: Log warning in development so issues don't go unnoticed
    console.warn('[UserData] Using defaults due to pool health check failure in development')
    return false
  }

  let client: PoolClient | null = null

  try {
    client = await getPool().connect()

    const query = `
      INSERT INTO "users_metas" ("userId", "metaKey", "metaValue", "dataType", "updatedAt")
      VALUES ($1, 'user_flags', $2, 'json', CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "metaKey")
      DO UPDATE SET
        "metaValue" = EXCLUDED."metaValue",
        "updatedAt" = CURRENT_TIMESTAMP
    `

    await client.query(query, [userId, JSON.stringify(flags)])

    // Clear cache for this user
    userDataCache.delete(userId)

    return true

  } catch (error) {
    const wrappedError = new UserDataError(
      `Failed to update user flags: ${error instanceof Error ? error.message : 'Unknown error'}`,
      userId,
      'updateUserFlags',
      error
    )

    console.error('[UserData] Error:', wrappedError.message, {
      userId,
      operation: 'updateUserFlags',
      flags,
      originalError: error
    })

    if (!isDevelopment) {
      throw wrappedError
    }
    return false
  } finally {
    if (client) {
      client.release()
    }
  }
}

/**
 * Add user plan and flags to user object (server-side helper)
 */
export async function enrichUserWithPlanData(user: SessionUser): Promise<SessionUser & {
  plan: PlanType
  flags: UserFlag[]
}> {
  const planData = await getUserPlanAndFlags(user.id)
  
  return {
    ...user,
    plan: planData.plan,
    flags: planData.flags
  }
}