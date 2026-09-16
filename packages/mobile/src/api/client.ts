/**
 * API Client for NextSpark Backend
 *
 * Configurable HTTP client with authentication and team context.
 * API_URL is resolved from (in order):
 * 1. app.config.ts extra.apiUrl
 * 2. EXPO_PUBLIC_API_URL environment variable
 * 3. Auto-detect from Expo dev server
 * 4. Fallback to localhost:3000 (10.0.2.2 on the Android emulator, which
 *    routes that address to the host machine's localhost; a physical
 *    Android device keeps localhost, matching an `adb reverse` tunnel)
 */

import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import * as Storage from '../lib/storage'
import { clearNativeCookies } from '../lib/cookies'
import { ApiError, type RequestConfig } from './client.types'
import type { Team, User } from './core/types'

/**
 * Host part of an Expo `hostUri` ("host:port"), brackets kept around an
 * IPv6 host (e.g. "[::1]:8081") so the result stays a valid URL host.
 */
function hostFromHostUri(hostUri: string): string {
  if (hostUri.startsWith('[')) {
    const closingBracket = hostUri.indexOf(']')
    if (closingBracket !== -1) return hostUri.slice(0, closingBracket + 1)
  }
  return hostUri.split(':')[0]
}

/**
 * Whether a hostUri host names the loopback interface, which is what Metro
 * reports when Expo binds the dev server to the machine it runs on (an
 * `adb reverse` tunnel on a physical device, or the iOS simulator/web
 * sharing the host's network). The Android emulator is a separate machine
 * from that loopback's point of view, so it alone needs a translated host.
 */
function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

/**
 * Resolve API URL from configuration
 *
 * Priority order:
 * 1. app.config.ts > extra > apiUrl (explicit configuration)
 * 2. EXPO_PUBLIC_API_URL environment variable
 * 3. Auto-detect from Expo dev server hostUri (development)
 * 4. Fallback to http://localhost:3000 (http://10.0.2.2:3000 on the Android
 *    emulator only; a physical Android device keeps localhost)
 *
 * @returns The resolved API URL
 * @example
 * ```ts
 * // In app.config.ts:
 * export default {
 *   extra: {
 *     apiUrl: 'https://api.myapp.com'
 *   }
 * }
 * ```
 */
export function getApiUrl(): string {
  // 1. From Expo config (app.config.ts > extra > apiUrl)
  const configUrl = Constants.expoConfig?.extra?.apiUrl
  if (configUrl) return configUrl

  // 2. From environment variable (EXPO_PUBLIC_API_URL)
  const envUrl = process.env.EXPO_PUBLIC_API_URL
  if (envUrl) return envUrl

  // 3. Auto-detect from Expo dev server (development mode). hostUri's host
  // is the dev machine's own network address as Metro sees it. A physical
  // device on the same network reaches that address directly, and so does
  // the iOS simulator or web, which share the host's network; only the
  // Android emulator is a separate machine from that address's point of
  // view. A loopback host there (Metro bound to `localhost`, which is what a
  // physical device tunnels with `adb reverse` on Metro's own port) is
  // translated to the emulator's 10.0.2.2 alias for the host machine; every
  // other host, loopback or not, is used as-is.
  //
  // This only recognizes an `adb reverse` tunnel when it also covers Metro's
  // port (hostUri itself reports loopback): a physical device that reaches
  // Metro over LAN normally, with a separate `adb reverse tcp:3000 tcp:3000`
  // forwarding only the backend port, still gets the LAN host here, because
  // nothing observable from hostUri distinguishes that device from one with
  // no tunnel at all. There is no reliable client-side signal for a
  // port-specific tunnel, so that combination needs an explicit
  // EXPO_PUBLIC_API_URL=http://localhost:3000 (see apps/mobile/README.md).
  if (Constants.expoConfig?.hostUri) {
    const host = hostFromHostUri(Constants.expoConfig.hostUri)
    if (Platform.OS === 'android' && !Device.isDevice && isLoopbackHost(host)) {
      return 'http://10.0.2.2:3000'
    }
    return `http://${host}:3000`
  }

  // 4. Fallback for local development. The Android emulator's own
  // 'localhost' is the emulator itself, not the host machine: 10.0.2.2 is
  // the alias the emulator maps to the host's loopback interface. A
  // physical device has no such alias, so it keeps 'localhost', which
  // works when the port is forwarded from the host with `adb reverse`.
  const isAndroidEmulator = Platform.OS === 'android' && !Device.isDevice
  return `http://${isAndroidEmulator ? '10.0.2.2' : 'localhost'}:3000`
}

const API_URL = getApiUrl()

// Storage keys (namespaced to avoid conflicts)
// SecureStore only allows alphanumeric, ".", "-", and "_"
const TOKEN_KEY = 'nextspark.auth.token'
const TEAM_ID_KEY = 'nextspark.auth.teamId'
const USER_KEY = 'nextspark.auth.user'
const TEAM_KEY = 'nextspark.auth.team'

export class ApiClient {
  private token: string | null = null
  private teamId: string | null = null
  private storedUser: User | null = null
  private storedTeam: Team | null = null

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
    const teamJson = await Storage.getItemAsync(TEAM_KEY)
    if (teamJson) {
      try {
        this.storedTeam = JSON.parse(teamJson)
      } catch {
        this.storedTeam = null
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
   * Get the stored active team (the full record, for offline session restore)
   */
  getStoredTeam(): Team | null {
    return this.storedTeam
  }

  /**
   * Set the active team: persists the id (sent as x-team-id) and the full
   * record, so a session can be restored without reaching the server.
   */
  async setTeam(team: Team): Promise<void> {
    this.storedTeam = team
    await this.setTeamId(team.id)
    await Storage.setItemAsync(TEAM_KEY, JSON.stringify(team))
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
   * Clear authentication: the stored credentials and the native cookie store,
   * where fetch keeps the server's session cookie.
   *
   * Best effort, never rejects: every step runs even when another one fails,
   * so a SecureStore error (offline, keychain locked) cannot leave the session
   * cookie behind. Failures are logged.
   */
  async clearAuth(): Promise<void> {
    this.token = null
    this.teamId = null
    this.storedUser = null
    this.storedTeam = null
    const steps: Array<() => Promise<void>> = [
      () => Storage.deleteItemAsync(TOKEN_KEY),
      () => Storage.deleteItemAsync(TEAM_ID_KEY),
      () => Storage.deleteItemAsync(USER_KEY),
      () => Storage.deleteItemAsync(TEAM_KEY),
      clearNativeCookies,
    ]
    const results = await Promise.allSettled(steps.map(async (step) => step()))
    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('[@nextsparkjs/mobile] Failed to clear part of the stored session:', result.reason)
      }
    }
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
      // Only declare a JSON payload when there is one (fetch sends no payload for
      // a null body): a server that parses the body by its Content-Type rejects
      // an application/json request with an empty body as invalid JSON.
      ...(fetchOptions.body != null ? { 'Content-Type': 'application/json' } : {}),
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
      body: data !== undefined ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PATCH request with JSON body
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
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
