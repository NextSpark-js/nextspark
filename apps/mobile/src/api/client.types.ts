/**
 * API Client Types
 *
 * Base types for API responses and error handling.
 */

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * Single item API response
 */
export interface SingleResponse<T> {
  data: T
}

/**
 * Request configuration extending fetch options
 */
export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
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
