/**
 * Users API Service
 *
 * User profile and preferences operations.
 */

import { apiClient } from '../client'
import type { SingleResponse } from '../client.types'
import type { User } from './types'

/**
 * Profile update input
 */
export interface UpdateProfileInput {
  firstName?: string
  lastName?: string
  language?: string
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  notifications?: boolean
  language?: string
}

const PREFERENCES_KEY = 'preferences'

/** The tail of the preference updates in flight: each one starts when the previous settled. */
let pendingPreferences: Promise<void> = Promise.resolve()

/** The signed-in user's id: the stored one, else the one `/users/me` answers with. */
async function currentUserId(): Promise<string> {
  return apiClient.getStoredUser()?.id ?? (await usersApi.getCurrentUser()).id
}

export const usersApi = {
  /**
   * Get current authenticated user (`GET /api/v1/users/me`)
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<SingleResponse<User>>('/api/v1/users/me')
    return response.data
  },

  /**
   * Update user profile (`PATCH /api/v1/users/me`; the fields /users/:id accepts)
   */
  async updateProfile(data: UpdateProfileInput): Promise<User> {
    const response = await apiClient.patch<SingleResponse<User>>('/api/v1/users/me', data)

    // Update stored user with new data
    await apiClient.setUser(response.data)

    return response.data
  },

  /**
   * Update user preferences: merged into what is stored under the user's `preferences` metadata
   * (`PATCH /api/v1/users/:id/meta/preferences`; there is no /users/me/preferences route).
   * Calls from this client run one after another, so quick successive updates all land; across
   * devices (read, merge, write) the last write wins.
   */
  updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    const run = pendingPreferences.then(async () => {
      const id = await currentUserId()
      const merged = { ...(await usersApi.getPreferences()), ...preferences }
      await apiClient.patch(`/api/v1/users/${encodeURIComponent(id)}/meta/${PREFERENCES_KEY}`, { value: merged })
      return merged
    })
    pendingPreferences = run.then(() => undefined, () => undefined)
    return run
  },

  /**
   * Get user preferences (`{}` when none are stored yet)
   */
  async getPreferences(): Promise<UserPreferences> {
    const id = await currentUserId()
    const response = await apiClient.get<SingleResponse<{ value: UserPreferences | null }>>(
      `/api/v1/users/${encodeURIComponent(id)}/meta/${PREFERENCES_KEY}`
    )
    return response.data.value ?? {}
  },
}
