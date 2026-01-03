/**
 * Client-side User Data Utilities
 * 
 * Client-side utilities for managing user flags data.
 * Plan is hardcoded until plan/team system is implemented.
 */

'use client'

import * as React from 'react'
import type { PlanType, UserFlag } from './entities/types'
import type { SessionUser } from './auth'

// Default values for client-side fallbacks
const DEFAULT_PLAN: PlanType = 'free' // Hardcoded until plan/team system
const DEFAULT_FLAGS: UserFlag[] = []

/**
 * Client-side interface for user flags data
 */
export interface ClientUserFlagsData {
  flags: UserFlag[]
  fromStorage: boolean
}

/**
 * Legacy interface for backward compatibility
 */
export interface ClientUserPlanData {
  plan: PlanType
  flags: UserFlag[]
  fromStorage: boolean
}

/**
 * Get user flags from localStorage (client-side cache)
 */
export function getCachedUserFlags(userId: string): ClientUserFlagsData | null {
  try {
    const cached = localStorage.getItem(`user_flags_${userId}`)
    if (!cached) return null

    const data = JSON.parse(cached)
    const now = Date.now()
    
    // Check if cache is still valid (5 minutes TTL)
    if (now - data.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(`user_flags_${userId}`)
      return null
    }

    return {
      flags: Array.isArray(data.flags) ? data.flags : DEFAULT_FLAGS,
      fromStorage: true
    }
  } catch (error) {
    console.error('Failed to get cached user flags:', error)
    return null
  }
}

/**
 * Get user plan and flags from localStorage (client-side cache)
 * @deprecated Use getCachedUserFlags() for flags, plan is hardcoded
 */
export function getCachedUserPlanData(userId: string): ClientUserPlanData | null {
  const flagsData = getCachedUserFlags(userId)
  
  if (!flagsData) return null
  
  return {
    plan: DEFAULT_PLAN, // Always hardcoded
    flags: flagsData.flags,
    fromStorage: flagsData.fromStorage
  }
}

/**
 * Cache user flags to localStorage
 */
export function cacheUserFlags(userId: string, flags: UserFlag[]): void {
  try {
    const data = {
      flags,
      timestamp: Date.now()
    }
    localStorage.setItem(`user_flags_${userId}`, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to cache user flags:', error)
  }
}

/**
 * Clear cached user flags
 */
export function clearCachedUserFlags(userId: string): void {
  try {
    localStorage.removeItem(`user_flags_${userId}`)
  } catch (error) {
    console.error('Failed to clear cached user flags:', error)
  }
}

/**
 * Cache user plan data to localStorage
 * @deprecated Use cacheUserFlags() instead, plan is hardcoded
 */
export function cacheUserPlanData(userId: string, plan: PlanType, flags: UserFlag[]): void {
  // Only cache flags, ignore plan
  cacheUserFlags(userId, flags)
}

/**
 * Fetch user flags from API
 */
export async function fetchUserFlags(userId: string): Promise<ClientUserFlagsData> {
  try {
    const response = await fetch(`/api/user/flags?userId=${userId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user flags: ${response.statusText}`)
    }

    const data = await response.json()
    const flags: UserFlag[] = Array.isArray(data.flags) ? data.flags : DEFAULT_FLAGS

    // Cache the result
    cacheUserFlags(userId, flags)

    return {
      flags,
      fromStorage: false
    }
  } catch (error) {
    console.error('Failed to fetch user flags:', error)
    
    // Try to get from cache as fallback
    const cached = getCachedUserFlags(userId)
    if (cached) {
      return cached
    }
    
    // Return defaults if all fails
    return {
      flags: DEFAULT_FLAGS,
      fromStorage: false
    }
  }
}

/**
 * Fetch user plan and flags from API
 * @deprecated Use fetchUserFlags() for flags, plan is hardcoded
 */
export async function fetchUserPlanData(userId: string): Promise<ClientUserPlanData> {
  const flagsData = await fetchUserFlags(userId)
  
  return {
    plan: DEFAULT_PLAN, // Always hardcoded
    flags: flagsData.flags,
    fromStorage: flagsData.fromStorage
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
 * @deprecated Plans are hardcoded, this is a no-op
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function updateUserPlanClient(userId: string, plan: PlanType): Promise<boolean> {
  console.warn('updateUserPlanClient is deprecated - plans are hardcoded')
  // No-op - plans are not stored as user metadata
  return true
}

/**
 * Update user flags via API
 */
export async function updateUserFlagsClient(userId: string, flags: UserFlag[]): Promise<boolean> {
  try {
    const response = await fetch('/api/user/flags', {
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
    cacheUserFlags(userId, flags)

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
 * @deprecated Use clearCachedUserFlags() instead
 */
export function clearCachedUserPlanData(userId?: string): void {
  if (userId) {
    clearCachedUserFlags(userId)
  } else {
    // Clear all user flags data from localStorage
    const keys = Object.keys(localStorage).filter(key => key.startsWith('user_flags_'))
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

/**
 * Provider component that automatically loads and caches user plan data
 * This should be wrapped around the app to ensure user plan data is always available
 */
export function UserPlanDataProvider({ 
  children, 
  user 
}: { 
  children: React.ReactNode
  user: SessionUser | null 
}) {
  // Use the hook to automatically load data
  useUserPlanData(user)
  
  return <>{children}</>
}
