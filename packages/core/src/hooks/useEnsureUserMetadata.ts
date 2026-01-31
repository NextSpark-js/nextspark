'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authClient } from '../lib/auth-client'
import { USER_PROFILE_WITH_META_QUERY_KEY } from './useUserSettings'

interface UserMetadata {
  uiPreferences?: {
    theme?: string
    sidebarCollapsed?: boolean
  }
  securityPreferences?: {
    loginAlertsEnabled?: boolean
  }
  notificationsPreferences?: Record<string, boolean>
}

interface UserProfileWithMeta {
  id: string
  meta?: UserMetadata
}

const DEFAULT_METADATA: UserMetadata = {
  uiPreferences: {
    theme: "light",
    sidebarCollapsed: false
  },
  securityPreferences: {
    loginAlertsEnabled: true
  },
  notificationsPreferences: {
    pushEnabled: true,
    loginAlertsEmail: true,
    loginAlertsPush: true,
    passwordChangesEmail: true,
    passwordChangesPush: true,
    suspiciousActivityEmail: true,
    suspiciousActivityPush: true,
    mentionsEmail: true,
    mentionsPush: true,
    projectUpdatesEmail: true,
    projectUpdatesPush: false,
    teamInvitesEmail: true,
    teamInvitesPush: true,
    newsletterEmail: false,
    newsletterPush: false,
    promotionsEmail: false,
    promotionsPush: false,
    featureAnnouncementsEmail: true,
    featureAnnouncementsPush: false
  }
}

/**
 * Hook to ensure user has default metadata
 * Uses TanStack Query for proper caching and deduplication
 */
export function useEnsureUserMetadata() {
  const session = authClient.useSession()
  const userId = session.data?.user?.id
  const queryClient = useQueryClient()
  const hasCreatedMetadata = useRef(false)

  // Fetch user profile with metadata - uses TanStack Query for deduplication
  // Uses shared query key from useUserSettings for proper cache sharing
  const { data: userData, isFetched } = useQuery<UserProfileWithMeta>({
    queryKey: USER_PROFILE_WITH_META_QUERY_KEY(userId),
    queryFn: async () => {
      const response = await fetch('/api/user/profile?includeMeta=true', {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch user profile')
      }
      return response.json()
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - metadata doesn't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  })

  // Mutation to create default metadata
  const createMetadataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/internal/user-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          metadata: DEFAULT_METADATA
        })
      })
      if (!response.ok) {
        throw new Error('Failed to create metadata')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate the profile query to refetch with new metadata
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_WITH_META_QUERY_KEY(userId) })
    },
    onError: (error) => {
      console.error('Error creating user metadata:', error)
    }
  })

  // Use effect to create metadata when needed (proper side effect handling)
  useEffect(() => {
    if (!isFetched || !userData || hasCreatedMetadata.current) return

    const needsMetadata = !userData.meta || Object.keys(userData.meta).length === 0

    if (needsMetadata && !createMetadataMutation.isPending) {
      hasCreatedMetadata.current = true
      console.log('Creating default metadata for user:', userId)
      createMetadataMutation.mutate()
    }
  }, [isFetched, userData, userId, createMetadataMutation])
}
