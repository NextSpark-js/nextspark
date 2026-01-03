import { useState, useEffect, useCallback } from 'react'
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

export function useUserSettings(options: UseUserSettingsOptions = {}) {
  const { user } = useAuth()
  const [data, setData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { includeMeta = false } = options

  const fetchUserData = useCallback(async () => {
    if (!user?.id) return

    setIsLoading(true)
    setError(null)

    try {
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

      const userData = await response.json()
      setData(userData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching user data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, includeMeta])

  const updateUserSettings = useCallback(async (updates: { meta?: Record<string, unknown> }) => {
    if (!user?.id) return

    setIsUpdating(true)
    setError(null)

    try {
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

      // Refresh data after successful update
      await fetchUserData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error updating user settings:', err)
      throw err
    } finally {
      setIsUpdating(false)
    }
  }, [user?.id, fetchUserData])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  return {
    data,
    isLoading,
    isUpdating,
    error,
    refetch: fetchUserData,
    updateEntity: updateUserSettings,
  }
}

// Wrapper específico para settings con metadata
export function useUserWithMetaSettings() {
  return useUserSettings({ includeMeta: true })
}
