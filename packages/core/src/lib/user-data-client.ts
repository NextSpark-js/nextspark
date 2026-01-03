/**
 * Client-side User Data Utilities
 * 
 * Client-side utilities for managing user plan and flags data.
 * Works with the server-side user-data.ts module.
 */

'use client'

import * as React from 'react'
import type { PlanType, UserFlag } from './entities/types'
import type { SessionUser } from './auth'

// Default values for client-side fallbacks
const DEFAULT_PLAN: PlanType = 'free'
const DEFAULT_FLAGS: UserFlag[] = []

/**
 * Client-side interface for user plan data
 */
export interface ClientUserPlanData {
  plan: PlanType
  flags: UserFlag[]
  fromStorage: boolean
}

/**
 * Get user plan and flags from localStorage (client-side cache)
 */
export function getCachedUserPlanData(userId: string): ClientUserPlanData | null {
  try {
    const cached = localStorage.getItem(`user_plan_${userId}`)
    if (!cached) return null

    const data = JSON.parse(cached)
    const now = Date.now()
    
    // Check if cache is still valid (5 minutes TTL)
    if (now - data.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(`user_plan_${userId}`)
      return null
    }

    return {
      plan: data.plan || DEFAULT_PLAN,
      flags: Array.isArray(data.flags) ? data.flags : DEFAULT_FLAGS,
      fromStorage: true
    }
  } catch (error) {
    console.error('Failed to get cached user plan data:', error)
    return null
  }
}

/**
 * Cache user plan data to localStorage
 */
export function cacheUserPlanData(userId: string, plan: PlanType, flags: UserFlag[]): void {
  try {
    const data = {
      plan,
      flags,
      timestamp: Date.now()
    }
    localStorage.setItem(`user_plan_${userId}`, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to cache user plan data:', error)
  }

}

/**
 * Fetch user plan and flags from API
 */
export async function fetchUserPlanData(userId: string): Promise<ClientUserPlanData> {
  try {
    const response = await fetch(`/api/user/plan-flags?userId=${userId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user plan data: ${response.statusText}`)
    }

    const data = await response.json()
    
    const plan: PlanType = data.plan || DEFAULT_PLAN
    const flags: UserFlag[] = Array.isArray(data.flags) ? data.flags : DEFAULT_FLAGS

    // Cache the result
    cacheUserPlanData(userId, plan, flags)

    return {
      plan,
      flags,
      fromStorage: false
    }
  } catch (error) {
    console.error('Failed to fetch user plan data:', error)
    
    // Try to get from cache as fallback
    const cached = getCachedUserPlanData(userId)
    if (cached) {
      return cached
    }

    // Return defaults as last resort
    return {
      plan: DEFAULT_PLAN,
      flags: DEFAULT_FLAGS,
      fromStorage: false
    }
  }
}

/**
 * Get user plan and flags with caching strategy
 */
export async function getUserPlanDataWithCache(userId: string): Promise<ClientUserPlanData> {
  // Try cache first
  const cached = getCachedUserPlanData(userId)
  if (cached) {
    return cached
  }

  // Fetch from API if not cached
  return await fetchUserPlanData(userId)
}

/**
 * Update user plan via API
 */
export async function updateUserPlanClient(userId: string, plan: PlanType): Promise<boolean> {
  try {
    const response = await fetch('/api/user/plan-flags', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        plan
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to update user plan: ${response.statusText}`)
    }

    // Update cache
    const currentData = getCachedUserPlanData(userId)
    if (currentData) {
      cacheUserPlanData(userId, plan, currentData.flags)
    }

    return true
  } catch (error) {
    console.error('Failed to update user plan:', error)
    return false
  }
}

/**
 * Update user flags via API
 */
export async function updateUserFlagsClient(userId: string, flags: UserFlag[]): Promise<boolean> {
  try {
    const response = await fetch('/api/user/plan-flags', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        flags
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to update user flags: ${response.statusText}`)
    }

    // Update cache
    const currentData = getCachedUserPlanData(userId)
    if (currentData) {
      cacheUserPlanData(userId, currentData.plan, flags)
    }

    return true
  } catch (error) {
    console.error('Failed to update user flags:', error)
    return false
  }
}

/**
 * Extract plan data from session user (enhanced version)
 */
export function extractUserPlanDataWithCache(user: SessionUser | null): ClientUserPlanData {
  if (!user) {
    return {
      plan: DEFAULT_PLAN,
      flags: DEFAULT_FLAGS,
      fromStorage: false
    }
  }

  // Try to get from localStorage first
  const cached = getCachedUserPlanData(user.id)
  if (cached) {
    return cached
  }

  // Return defaults if no cache available
  return {
    plan: DEFAULT_PLAN,
    flags: DEFAULT_FLAGS,
    fromStorage: false
  }
}

/**
 * Clear cached user data (useful for logout or data refresh)
 */
export function clearCachedUserPlanData(userId?: string): void {
  if (userId) {
    localStorage.removeItem(`user_plan_${userId}`)
  } else {
    // Clear all user plan data from localStorage
    const keys = Object.keys(localStorage).filter(key => key.startsWith('user_plan_'))
    keys.forEach(key => localStorage.removeItem(key))
  }
}

/**
 * React hook for user plan data
 */
export function useUserPlanData(user: SessionUser | null) {
  const [planData, setPlanData] = React.useState<ClientUserPlanData>({
    plan: DEFAULT_PLAN,
    flags: DEFAULT_FLAGS,
    fromStorage: false
  })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!user) {
      setPlanData({
        plan: DEFAULT_PLAN,
        flags: DEFAULT_FLAGS,
        fromStorage: false
      })
      return
    }

    const loadPlanData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const data = await getUserPlanDataWithCache(user.id)
        setPlanData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user plan data')
        setPlanData({
          plan: DEFAULT_PLAN,
          flags: DEFAULT_FLAGS,
          fromStorage: false
        })
      } finally {
        setLoading(false)
      }
    }

    loadPlanData()
  }, [user])

  const updatePlan = React.useCallback(async (plan: PlanType) => {
    if (!user) return false

    const success = await updateUserPlanClient(user.id, plan)
    if (success) {
      setPlanData(prev => ({ ...prev, plan }))
    }
    return success
  }, [user])

  const updateFlags = React.useCallback(async (flags: UserFlag[]) => {
    if (!user) return false

    const success = await updateUserFlagsClient(user.id, flags)
    if (success) {
      setPlanData(prev => ({ ...prev, flags }))
    }
    return success
  }, [user])

  return {
    ...planData,
    loading,
    error,
    updatePlan,
    updateFlags,
    refetch: () => {
      if (user) {
        clearCachedUserPlanData(user.id)
        // Re-trigger useEffect
        setPlanData(prev => ({ ...prev }))
      }
    }
  }
}

