/**
 * API Error Class
 *
 * Custom error class that preserves API response metadata like error codes.
 * Used for proper error handling in TanStack Query mutations.
 */

export class ApiError extends Error {
  code?: string
  status?: number
  details?: unknown

  constructor(message: string, options?: { code?: string; status?: number; details?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.code = options?.code
    this.status = options?.status
    this.details = options?.details

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }

  /**
   * Check if this is a permission denied error
   */
  isPermissionDenied(): boolean {
    return this.code === 'PERMISSION_DENIED' && this.status === 403
  }

  /**
   * Parse API error from fetch response
   * Handles both flat and nested error structures:
   * - Flat: { error: "msg", code: "CODE" }
   * - Nested: { error: { message: "msg", code: "CODE" } }
   */
  static async fromResponse(response: Response, fallbackMessage: string): Promise<ApiError> {
    let errorData: {
      error?: string | { message?: string; code?: string; details?: unknown }
      code?: string
      details?: unknown
      message?: string
    } = {}

    try {
      errorData = await response.json()
    } catch {
      // If JSON parsing fails, use fallback
    }

    // Handle nested error structure (from permission middleware)
    let message: string
    let code: string | undefined
    let details: unknown

    if (errorData.error && typeof errorData.error === 'object') {
      // Nested structure: { error: { message, code, details } }
      message = errorData.error.message || fallbackMessage
      code = errorData.error.code || errorData.code
      details = errorData.error.details || errorData.details
    } else {
      // Flat structure: { error: "message", code: "CODE" }
      message = (errorData.error as string) || errorData.message || fallbackMessage
      code = errorData.code
      details = errorData.details
    }

    return new ApiError(message, {
      code,
      status: response.status,
      details,
    })
  }
}
