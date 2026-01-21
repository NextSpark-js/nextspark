'use client'

/**
 * Prefetch hooks for improving navigation performance
 *
 * These hooks prefetch data when the user hovers over links,
 * so the data is already in cache when they navigate.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { TEAMS_QUERY_KEY, fetchUserTeams } from '../contexts/TeamContext'

// Query keys (matching the hooks)
const USER_PROFILE_QUERY_KEY = ['user-profile'] as const

// Fetch functions for prefetching
async function fetchUserProfile() {
  const response = await fetch('/api/user/profile')
  if (!response.ok) {
    throw new Error('Failed to fetch profile')
  }
  return response.json()
}

/**
 * Hook to prefetch settings page data on hover
 *
 * @example
 * ```tsx
 * function SettingsSidebar() {
 *   const { prefetchProfile, prefetchTeams } = usePrefetchSettings()
 *
 *   return (
 *     <nav>
 *       <Link href="/dashboard/settings/profile" onMouseEnter={prefetchProfile}>
 *         Profile
 *       </Link>
 *       <Link href="/dashboard/settings/teams" onMouseEnter={prefetchTeams}>
 *         Teams
 *       </Link>
 *     </nav>
 *   )
 * }
 * ```
 */
export function usePrefetchSettings() {
  const queryClient = useQueryClient()

  const prefetchProfile = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: USER_PROFILE_QUERY_KEY,
      queryFn: fetchUserProfile,
      staleTime: 1000 * 60 * 5, // 5 minutes
    })
  }, [queryClient])

  const prefetchTeams = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: TEAMS_QUERY_KEY,
      queryFn: fetchUserTeams,
      staleTime: 1000 * 60 * 5, // 5 minutes
    })
  }, [queryClient])

  return {
    prefetchProfile,
    prefetchTeams,
  }
}

/**
 * Generic prefetch hook for any entity list
 *
 * @example
 * ```tsx
 * function EntityNav() {
 *   const prefetchProducts = usePrefetchEntity('products')
 *
 *   return (
 *     <Link href="/dashboard/products" onMouseEnter={prefetchProducts}>
 *       Products
 *     </Link>
 *   )
 * }
 * ```
 */
export function usePrefetchEntity(entitySlug: string) {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['entity', entitySlug, 'list'],
      queryFn: async () => {
        const response = await fetch(`/api/v1/${entitySlug}?limit=20`)
        if (!response.ok) {
          throw new Error(`Failed to fetch ${entitySlug}`)
        }
        return response.json()
      },
      staleTime: 1000 * 60 * 2, // 2 minutes for entity lists
    })
  }, [queryClient, entitySlug])
}
