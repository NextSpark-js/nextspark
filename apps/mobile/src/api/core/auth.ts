/**
 * Auth API Service
 *
 * Authentication operations: login, logout, session management.
 */

import { apiClient } from '../client'
import { ApiError } from '../client.types'
import type { LoginResponse, SessionResponse } from './types'

export const authApi = {
  /**
   * Login with email and password
   * Better Auth returns user and session info
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/sign-in/email', {
      email,
      password,
    })

    // Store user info for session restoration
    await apiClient.setUser(response.user)

    // Store token if provided (Better Auth may return it for mobile clients)
    if (response.session?.token) {
      await apiClient.setToken(response.session.token)
    }

    return response
  },

  /**
   * Logout - clear local auth and call server signout
   */
  async logout(): Promise<void> {
    try {
      // Call server signout endpoint to invalidate session
      await apiClient.post('/api/auth/sign-out')
    } catch {
      // Ignore errors - we'll clear local state anyway
    }
    await apiClient.clearAuth()
  },

  /**
   * Get current session from server
   * Used to validate stored credentials and get fresh user data
   */
  async getSession(): Promise<SessionResponse | null> {
    try {
      const response = await apiClient.get<SessionResponse>('/api/auth/get-session')

      // Update stored user with fresh data
      if (response.user) {
        await apiClient.setUser(response.user)
      }

      return response
    } catch (error) {
      // Session invalid or expired
      if (error instanceof ApiError && error.status === 401) {
        return null
      }
      throw error
    }
  },
}
