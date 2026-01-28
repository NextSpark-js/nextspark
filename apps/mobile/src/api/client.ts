/**
 * API Client for NextSpark Backend
 *
 * Base HTTP client with authentication and team context management.
 * Uses Better Auth session-based authentication with cookie support.
 */

import * as Storage from '../lib/storage'
import Constants from 'expo-constants'
import { ApiError, type RequestConfig } from './client.types'
import type { User } from './core/types'

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  (Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri.split(':')[0]}:5173`
    : 'http://localhost:5173')

// Storage keys (namespaced to avoid conflicts)
// SecureStore only allows alphanumeric, ".", "-", and "_"
const TOKEN_KEY = 'nextspark.auth.token'
const TEAM_ID_KEY = 'nextspark.auth.teamId'
const USER_KEY = 'nextspark.auth.user'

class ApiClient {
  private token: string | null = null
  private teamId: string | null = null
  private storedUser: User | null = null

  /**
   * Initialize client by loading stored credentials
   */
  async init(): Promise<void> {
    this.token = await Storage.getItemAsync(TOKEN_KEY)
    this.teamId = await Storage.getItemAsync(TEAM_ID_KEY)
    const userJson = await Storage.getItemAsync(USER_KEY)
    if (userJson) {
      try {
        this.storedUser = JSON.parse(userJson)
      } catch {
        this.storedUser = null
      }
    }
  }

  // ==========================================
  // Token & Team Management
  // ==========================================

  /**
   * Get stored token
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * Set authentication token
   */
  async setToken(token: string): Promise<void> {
    this.token = token
    await Storage.setItemAsync(TOKEN_KEY, token)
  }

  /**
   * Get stored team ID
   */
  getTeamId(): string | null {
    return this.teamId
  }

  /**
   * Set team ID
   */
  async setTeamId(teamId: string): Promise<void> {
    this.teamId = teamId
    await Storage.setItemAsync(TEAM_ID_KEY, teamId)
  }

  /**
   * Get stored user info
   */
  getStoredUser(): User | null {
    return this.storedUser
  }

  /**
   * Set user info
   */
  async setUser(user: User): Promise<void> {
    this.storedUser = user
    await Storage.setItemAsync(USER_KEY, JSON.stringify(user))
  }

  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    this.token = null
    this.teamId = null
    this.storedUser = null
    await Storage.deleteItemAsync(TOKEN_KEY)
    await Storage.deleteItemAsync(TEAM_ID_KEY)
    await Storage.deleteItemAsync(USER_KEY)
  }

  // ==========================================
  // HTTP Methods
  // ==========================================

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = `${API_URL}${endpoint}`
    if (!params) return url

    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value))
      }
    })

    const queryString = searchParams.toString()
    return queryString ? `${url}?${queryString}` : url
  }

  /**
   * Make authenticated request
   * Uses credentials: 'include' to support cookie-based auth alongside Bearer token
   */
  async request<T>(endpoint: string, options: RequestConfig = {}): Promise<T> {
    const { params, ...fetchOptions } = options
    const url = this.buildUrl(endpoint, params)

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    }

    // Add Bearer token if available (Better Auth mobile flow)
    if (this.token) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`
    }

    // Add team context header
    if (this.teamId) {
      ;(headers as Record<string, string>)['x-team-id'] = this.teamId
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include', // Support cookie-based sessions
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        errorData.message || `Request failed with status ${response.status}`,
        response.status,
        errorData
      )
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T
    }

    // Defensive JSON parsing - handle malformed responses
    return response.json().catch(() => ({} as T))
  }

  /**
   * GET request with optional query parameters
   */
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params })
  }

  /**
   * POST request with JSON body
   */
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PATCH request with JSON body
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE request
   * Returns void for delete operations (most common case)
   */
  async delete<T = void>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Re-export ApiError for convenience
export { ApiError } from './client.types'
