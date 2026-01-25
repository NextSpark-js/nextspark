/**
 * API Client for NextSpark Backend
 *
 * Uses Better Auth session-based authentication with cookie support.
 * For mobile, we store user info separately to handle session restoration.
 */

import * as Storage from '../lib/storage'
import Constants from 'expo-constants'
import type {
  Task,
  User,
  CreateTaskInput,
  UpdateTaskInput,
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  PaginatedResponse,
  SingleResponse,
  LoginResponse,
  TeamsResponse,
  SessionResponse,
} from '../types'

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  (Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri.split(':')[0]}:5173`
    : 'http://localhost:5173')

// Storage keys
const TOKEN_KEY = 'auth_token'
const TEAM_ID_KEY = 'team_id'
const USER_KEY = 'user_data'

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

  /**
   * Get stored token
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * Get stored team ID
   */
  getTeamId(): string | null {
    return this.teamId
  }

  /**
   * Get stored user info
   */
  getStoredUser(): User | null {
    return this.storedUser
  }

  /**
   * Set authentication token
   */
  async setToken(token: string): Promise<void> {
    this.token = token
    await Storage.setItemAsync(TOKEN_KEY, token)
  }

  /**
   * Set user info
   */
  async setUser(user: User): Promise<void> {
    this.storedUser = user
    await Storage.setItemAsync(USER_KEY, JSON.stringify(user))
  }

  /**
   * Set team ID
   */
  async setTeamId(teamId: string): Promise<void> {
    this.teamId = teamId
    await Storage.setItemAsync(TEAM_ID_KEY, teamId)
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

  /**
   * Make authenticated request
   * Uses credentials: 'include' to support cookie-based auth alongside Bearer token
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
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
      ...options,
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

    return response.json()
  }

  // ==========================================
  // Auth Methods
  // ==========================================

  /**
   * Login with email and password
   * Better Auth returns user and session info
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    // Store user info for session restoration
    await this.setUser(response.user)

    // Store token if provided (Better Auth may return it for mobile clients)
    if (response.session?.token) {
      await this.setToken(response.session.token)
    }

    return response
  }

  /**
   * Get current session from server
   * Used to validate stored credentials and get fresh user data
   */
  async getSession(): Promise<SessionResponse | null> {
    try {
      const response = await this.request<SessionResponse>('/api/auth/get-session')

      // Update stored user with fresh data
      if (response.user) {
        await this.setUser(response.user)
      }

      return response
    } catch (error) {
      // Session invalid or expired
      if (error instanceof ApiError && error.status === 401) {
        return null
      }
      throw error
    }
  }

  /**
   * Get user's teams
   */
  async getTeams(): Promise<TeamsResponse> {
    return this.request<TeamsResponse>('/api/v1/teams')
  }

  /**
   * Logout - clear local auth and call server signout
   */
  async logout(): Promise<void> {
    try {
      // Call server signout endpoint to invalidate session
      await this.request('/api/auth/sign-out', { method: 'POST' })
    } catch {
      // Ignore errors - we'll clear local state anyway
    }
    await this.clearAuth()
  }

  // ==========================================
  // Tasks CRUD
  // ==========================================

  /**
   * List tasks with pagination
   */
  async listTasks(params?: {
    page?: number
    limit?: number
    status?: string
    priority?: string
    search?: string
  }): Promise<PaginatedResponse<Task>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.status) searchParams.set('status', params.status)
    if (params?.priority) searchParams.set('priority', params.priority)
    if (params?.search) searchParams.set('search', params.search)

    const queryString = searchParams.toString()
    const endpoint = `/api/v1/tasks${queryString ? `?${queryString}` : ''}`

    return this.request<PaginatedResponse<Task>>(endpoint)
  }

  /**
   * Get single task by ID
   */
  async getTask(id: string): Promise<SingleResponse<Task>> {
    return this.request<SingleResponse<Task>>(`/api/v1/tasks/${id}`)
  }

  /**
   * Create a new task
   */
  async createTask(data: CreateTaskInput): Promise<SingleResponse<Task>> {
    return this.request<SingleResponse<Task>>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Update an existing task
   */
  async updateTask(id: string, data: UpdateTaskInput): Promise<SingleResponse<Task>> {
    return this.request<SingleResponse<Task>>(`/api/v1/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    await this.request<void>(`/api/v1/tasks/${id}`, {
      method: 'DELETE',
    })
  }

  // ==========================================
  // Customers CRUD
  // ==========================================

  /**
   * List customers with pagination
   */
  async listCustomers(params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<PaginatedResponse<Customer>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.search) searchParams.set('search', params.search)

    const queryString = searchParams.toString()
    const endpoint = `/api/v1/customers${queryString ? `?${queryString}` : ''}`

    return this.request<PaginatedResponse<Customer>>(endpoint)
  }

  /**
   * Get single customer by ID
   */
  async getCustomer(id: string): Promise<SingleResponse<Customer>> {
    return this.request<SingleResponse<Customer>>(`/api/v1/customers/${id}`)
  }

  /**
   * Create a new customer
   */
  async createCustomer(data: CreateCustomerInput): Promise<SingleResponse<Customer>> {
    return this.request<SingleResponse<Customer>>('/api/v1/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Update an existing customer
   */
  async updateCustomer(id: string, data: UpdateCustomerInput): Promise<SingleResponse<Customer>> {
    return this.request<SingleResponse<Customer>>(`/api/v1/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(id: string): Promise<void> {
    await this.request<void>(`/api/v1/customers/${id}`, {
      method: 'DELETE',
    })
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
