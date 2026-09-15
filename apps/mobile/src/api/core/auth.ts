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

    // Store the token for Bearer auth. Better Auth returns it at the top level
    // of sign-in responses (`token`); older shapes nested it under `session`.
    const token = response.token ?? response.session?.token
    if (token) {
      await apiClient.setToken(token)
    }

    return response
  },

  /**
   * Logout - clear local auth and call server signout
   */
  async logout(): Promise<void> {
    try {
      // Call server signout endpoint to invalidate session. Better Auth only
      // accepts this POST with a JSON body (an empty one is invalid JSON, and
      // no Content-Type at all is rejected), so an empty object is sent.
      await apiClient.post('/api/auth/sign-out', {})
    } catch (error) {
      // Log error for debugging but continue with local cleanup
      // Server session may remain active if this fails (network issues)
      console.warn('[AuthApi] Failed to sign out from server:', error)
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
