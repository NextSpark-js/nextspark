/**
 * User Metadata Individual Endpoint
 *
 * RESTful API for managing individual user metadata keys.
 * More efficient than bulk metadata operations when working with single values.
 *
 * Endpoints:
 * - GET    /api/v1/users/:id/meta/:key - Get specific metadata value
 * - PUT    /api/v1/users/:id/meta/:key - Create or update metadata value
 * - DELETE /api/v1/users/:id/meta/:key - Delete metadata value
 *
 * Features:
 * - Dual authentication (API Key + Session)
 * - RLS (Row Level Security)
 * - Efficient single-meta operations
 * - CORS support
 * - Rate limiting
 *
 * @module api/v1/users/[id]/meta/[key]
 */

import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@nextsparkjs/core/lib/services'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { z } from 'zod'

// Validation schema for metadata value
const metadataValueSchema = z.object({
  value: z.any(), // Accept any JSON value
  isPublic: z.boolean().optional().default(false),
  isSearchable: z.boolean().optional().default(false),
  dataType: z.enum(['string', 'number', 'boolean', 'json', 'array']).optional().default('json'),
})

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

/**
 * GET /api/v1/users/:id/meta/:key
 * Retrieve a specific user metadata value
 *
 * @param id - User ID or email
 * @param key - Metadata key to retrieve
 * @returns Metadata value or 404 if not found
 *
 * @example
 * GET /api/v1/users/user-123/meta/theme
 * Response: { success: true, data: { key: "theme", value: "dark" } }
 */
export const GET = withApiLogging(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        createApiError('Authentication required', 401, null, 'AUTHENTICATION_FAILED'),
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // Check required permissions
    const hasPermission =
      authResult.type === 'session' ||
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'users:read'))

    if (!hasPermission) {
      const response = createApiError(
        'Insufficient permissions. Admin access required for user metadata.',
        403
      )
      return addCorsHeaders(response)
    }

    const { id, key } = await params

    // Validate parameters
    if (!id || id.trim() === '') {
      const response = createApiError('User ID is required', 400, null, 'MISSING_USER_ID')
      return addCorsHeaders(response)
    }

    if (!key || key.trim() === '') {
      const response = createApiError('Metadata key is required', 400, null, 'MISSING_META_KEY')
      return addCorsHeaders(response)
    }

    // Validate key length
    if (key.length > 100) {
      const response = createApiError(
        'Metadata key too long (max 100 characters)',
        400,
        null,
        'INVALID_META_KEY'
      )
      return addCorsHeaders(response)
    }

    // Get user metadata value using UserService
    const metaValue = await UserService.getUserMeta(id, key, authResult.user.id)

    // Return 404 if metadata key doesn't exist
    if (metaValue === null || metaValue === undefined) {
      const response = createApiError(
        `Metadata key '${key}' not found for user`,
        404,
        null,
        'META_NOT_FOUND'
      )
      return addCorsHeaders(response)
    }

    // Return metadata value
    const response = createApiResponse({
      key,
      value: metaValue,
    })
    return addCorsHeaders(response)
  } catch (error) {
    const response = createApiError(
      'Failed to fetch user metadata',
      500,
      error instanceof Error ? error.message : undefined
    )
    return addCorsHeaders(response)
  }
})

/**
 * PUT /api/v1/users/:id/meta/:key
 * Create or update a specific user metadata value
 *
 * Body:
 * {
 *   value: any,           // Required - The metadata value (any JSON type)
 *   isPublic?: boolean,   // Optional - Whether metadata is public (default: false)
 *   isSearchable?: boolean, // Optional - Whether metadata is searchable (default: false)
 *   dataType?: string     // Optional - Data type hint (default: "json")
 * }
 *
 * @example
 * PUT /api/v1/users/user-123/meta/theme
 * Body: { value: "dark", isPublic: false }
 * Response: { success: true, data: { key: "theme", value: "dark", updated: true } }
 */
export const PUT = withApiLogging(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        createApiError('Authentication required', 401, null, 'AUTHENTICATION_FAILED'),
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // Check required permissions
    const hasPermission =
      authResult.type === 'session' ||
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'users:write'))

    if (!hasPermission) {
      const response = createApiError(
        'Insufficient permissions. Admin access required for user metadata.',
        403
      )
      return addCorsHeaders(response)
    }

    const { id, key } = await params

    // Validate parameters
    if (!id || id.trim() === '') {
      const response = createApiError('User ID is required', 400, null, 'MISSING_USER_ID')
      return addCorsHeaders(response)
    }

    if (!key || key.trim() === '') {
      const response = createApiError('Metadata key is required', 400, null, 'MISSING_META_KEY')
      return addCorsHeaders(response)
    }

    // Validate key length
    if (key.length > 100) {
      const response = createApiError(
        'Metadata key too long (max 100 characters)',
        400,
        null,
        'INVALID_META_KEY'
      )
      return addCorsHeaders(response)
    }

    // Parse and validate request body
    const body = await req.json()
    const validatedData = metadataValueSchema.parse(body)

    // Validate value size (max 1MB)
    const jsonString = JSON.stringify(validatedData.value)
    if (new TextEncoder().encode(jsonString).length > 1048576) {
      const response = createApiError(
        'Metadata value too large (max 1MB)',
        400,
        null,
        'VALUE_TOO_LARGE'
      )
      return addCorsHeaders(response)
    }

    // Update metadata using UserService
    await UserService.updateUserMeta(
      id,
      key,
      validatedData.value,
      authResult.user.id,
      {
        isPublic: validatedData.isPublic,
        isSearchable: validatedData.isSearchable,
        dataType: validatedData.dataType,
      }
    )

    // Return success response
    const response = createApiResponse({
      key,
      value: validatedData.value,
      updated: true,
    })
    return addCorsHeaders(response)
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      const response = createApiError(
        'Invalid request body',
        400,
        error.issues,
        'VALIDATION_ERROR'
      )
      return addCorsHeaders(response)
    }

    const response = createApiError(
      'Failed to update user metadata',
      500,
      error instanceof Error ? error.message : undefined
    )
    return addCorsHeaders(response)
  }
})

/**
 * PATCH /api/v1/users/:id/meta/:key
 * Alias for PUT - Create or update a specific user metadata value
 * Some clients prefer PATCH for partial updates
 */
export const PATCH = PUT

/**
 * DELETE /api/v1/users/:id/meta/:key
 * Delete a specific user metadata value
 *
 * @example
 * DELETE /api/v1/users/user-123/meta/theme
 * Response: { success: true, data: { key: "theme", deleted: true } }
 */
export const DELETE = withApiLogging(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        createApiError('Authentication required', 401, null, 'AUTHENTICATION_FAILED'),
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // Check required permissions
    const hasPermission =
      authResult.type === 'session' ||
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'users:write'))

    if (!hasPermission) {
      const response = createApiError(
        'Insufficient permissions. Admin access required for user metadata.',
        403
      )
      return addCorsHeaders(response)
    }

    const { id, key } = await params

    // Validate parameters
    if (!id || id.trim() === '') {
      const response = createApiError('User ID is required', 400, null, 'MISSING_USER_ID')
      return addCorsHeaders(response)
    }

    if (!key || key.trim() === '') {
      const response = createApiError('Metadata key is required', 400, null, 'MISSING_META_KEY')
      return addCorsHeaders(response)
    }

    // Validate key length
    if (key.length > 100) {
      const response = createApiError(
        'Metadata key too long (max 100 characters)',
        400,
        null,
        'INVALID_META_KEY'
      )
      return addCorsHeaders(response)
    }

    // Delete metadata using UserService
    await UserService.deleteUserMeta(id, key, authResult.user.id)

    // Return success response
    const response = createApiResponse({
      key,
      deleted: true,
    })
    return addCorsHeaders(response)
  } catch (error) {
    const response = createApiError(
      'Failed to delete user metadata',
      500,
      error instanceof Error ? error.message : undefined
    )
    return addCorsHeaders(response)
  }
})