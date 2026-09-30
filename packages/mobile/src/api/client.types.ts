/**
 * API Client Types
 *
 * Base types for API responses and error handling.
 */

/**
 * What every API response carries in `info`: the timestamp, plus whatever the endpoint adds
 * (pagination on a list, `created` on a create).
 */
export interface ApiInfo {
  timestamp: string
  [key: string]: unknown
}

/** What a list endpoint adds to `info`. */
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/** A successful response with one item (or any payload). */
export interface ApiSuccessResponse<T> {
  success: true
  data: T
  info: ApiInfo
}

/** A successful list response: the pagination is in `info` (there is no `meta`). */
export interface ApiListResponse<T> {
  success: true
  data: T[]
  info: ApiInfo & PaginationInfo
}

/** A failed response. */
export interface ApiErrorResponse {
  success: false
  error: string
  code: string
  details?: unknown
  info?: ApiInfo
}

/**
 * The response envelopes are what `createApiResponse` / `createApiError` send. They are the same shapes as the
 * ones of the generated API contracts (`@project/contracts`, from `nextspark prepare`), which a test in apps/mobile
 * keeps mutually assignable: this package cannot import a project's generated code.
 */

/** Paginated API response (a list endpoint) */
export type PaginatedResponse<T> = ApiListResponse<T>

/** Single item API response */
export type SingleResponse<T> = ApiSuccessResponse<T>

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
