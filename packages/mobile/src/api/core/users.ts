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
  name?: string
  image?: string | null
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  notifications?: boolean
  language?: string
}

export const usersApi = {
  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<SingleResponse<User>>('/api/v1/users/me')
    return response.data
  },

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileInput): Promise<User> {
    const response = await apiClient.patch<SingleResponse<User>>('/api/v1/users/me', data)

    // Update stored user with new data
    await apiClient.setUser(response.data)

    return response.data
  },

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    const response = await apiClient.patch<SingleResponse<UserPreferences>>(
      '/api/v1/users/me/preferences',
      preferences
    )
    return response.data
  },

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    const response = await apiClient.get<SingleResponse<UserPreferences>>(
      '/api/v1/users/me/preferences'
    )
    return response.data
  },
}
