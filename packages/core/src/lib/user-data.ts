/**
 * User Plan & Flag Data Integration
 *
 * Provides dynamic retrieval of user plan and flags from the database
 * via users_metas table. Replaces hardcoded values throughout the system.
 */

import type { PoolClient } from 'pg'
import { getPool } from './db'
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

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000

/**
 * Interface for user plan and flag data
 */
export interface UserPlanData {
  plan: PlanType
  flags: UserFlag[]
  cached: boolean
}


/**
 * Get user plan and flags from database
 * Uses user_metas table to store plan and flags data
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

    return {
      plan,
      flags,
      cached: false
    }

  } catch (error) {
    console.error('Failed to get user plan and flags:', error)

    // Return defaults on error
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
 */
export async function updateUserPlan(userId: string, plan: PlanType): Promise<boolean> {
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
    console.error('Failed to update user plan:', error)
    return false
  } finally {
    if (client) {
      client.release()
    }
  }
}

/**
 * Update user flags in database
 */
export async function updateUserFlags(userId: string, flags: UserFlag[]): Promise<boolean> {
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
    console.error('Failed to update user flags:', error)
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