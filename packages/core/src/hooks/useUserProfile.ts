'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

export interface UserProfile {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  country: string | null
  timezone: string | null
  language: string | null
  image: string | null
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  authMethod: string
}

export function useUserProfile() {
  const { user: authUser, isLoading: authLoading, signOut } = useAuth()
  
  // Fetch complete user profile data
  const { data: profile, isLoading: profileLoading, error } = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/user/profile')
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }
      return response.json()
    },
    enabled: !!authUser,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
  })

  const queryClient = useQueryClient()
  const isLoading = authLoading || profileLoading

  // Return unified user data - prefer profile data when available, fallback to auth user
  const user = profile || authUser

  // Calculate hasPassword from authMethod instead of separate query
  const hasPassword = profile?.authMethod === 'Email'

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to update profile')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch profile data
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
    },
  })

  const updateProfile = updateProfileMutation.mutateAsync

  return {
    user,
    profile,
    hasPassword,
    isLoading,
    error,
    signOut,
    updateProfile,
    updateProfileMutation,
    // Keep auth loading separate for cases where we only need basic auth check
    isAuthLoading: authLoading,
    isProfileLoading: profileLoading,
  }
}