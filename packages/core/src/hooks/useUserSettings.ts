'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

interface UserData {
  id: string
  email: string
  firstName?: string
  lastName?: string
  country?: string
  timezone?: string
  language?: string
  image?: string
  emailVerified?: boolean
  createdAt: string
  updatedAt: string
  authMethod?: string
  meta?: Record<string, unknown>
}

interface UseUserSettingsOptions {
  includeMeta?: boolean
}

// Shared query key for user profile with metadata
// This MUST match the key in useEnsureUserMetadata for proper deduplication
export const USER_PROFILE_WITH_META_QUERY_KEY = (userId: string | undefined) =>
  ['user-profile-with-meta', userId] as const

export function useUserSettings(options: UseUserSettingsOptions = {}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { includeMeta = false } = options

  // Use TanStack Query for proper caching and deduplication
  const {
    data,
    isLoading,
    error: queryError,
    refetch
  } = useQuery<UserData>({
    queryKey: includeMeta
      ? USER_PROFILE_WITH_META_QUERY_KEY(user?.id)
      : ['user-profile', user?.id],
    queryFn: async () => {
      const url = new URL('/api/user/profile', window.location.origin)
      if (includeMeta) {
        url.searchParams.set('includeMeta', 'true')
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch user data')
      }

      return response.json()
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - matches useEnsureUserMetadata
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  })

  // Mutation for updating user settings
  const updateMutation = useMutation({
    mutationFn: async (updates: { meta?: Record<string, unknown> }) => {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user settings')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate both query variants to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: USER_PROFILE_WITH_META_QUERY_KEY(user?.id)
      })
      queryClient.invalidateQueries({
        queryKey: ['user-profile', user?.id]
      })
    },
  })

  const updateUserSettings = useCallback(async (updates: { meta?: Record<string, unknown> }) => {
    return updateMutation.mutateAsync(updates)
  }, [updateMutation])

  const error = queryError?.message || updateMutation.error?.message || null

  return {
    data: data || null,
    isLoading,
    isUpdating: updateMutation.isPending,
    error,
    refetch,
    updateEntity: updateUserSettings,
  }
}

// Wrapper específico para settings con metadata
export function useUserWithMetaSettings() {
  return useUserSettings({ includeMeta: true })
}
