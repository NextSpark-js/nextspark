/**
 * Permission Middleware for API Endpoints
 *
 * Helper functions to integrate permission checks into API routes.
 * Maps HTTP methods to entity actions and validates permissions.
 */

import { checkPermission } from '../permissions/check'
import type { Permission } from '../permissions/types'
import { NextResponse } from 'next/server'

/**
 * Map HTTP methods to entity actions
 */
const HTTP_TO_ACTION: Record<string, string> = {
  'GET': 'read',      // Single entity retrieval
  'POST': 'create',
  'PATCH': 'update',
  'PUT': 'update',
  'DELETE': 'delete',
}

/**
 * Special mapping for list operations (GET on collection)
 */
export const LIST_ACTION = 'list'

/**
 * Get the permission string for an entity action
 *
 * @param entitySlug - Entity slug (e.g., 'customers', 'tasks')
 * @param action - Action being performed (e.g., 'create', 'read', 'list')
 * @returns Permission string (e.g., 'customers.create')
 *
 * @example
 * ```typescript
 * const permission = getEntityPermission('customers', 'create')
 * // => 'customers.create'
 * ```
 */
export function getEntityPermission(entitySlug: string, action: string): Permission {
  return `${entitySlug}.${action}` as Permission
}

/**
 * Get entity action from HTTP method and context
 *
 * @param method - HTTP method (GET, POST, PATCH, DELETE)
 * @param isCollection - Whether this is a collection endpoint (true) or single entity (false)
 * @returns Action string (e.g., 'list', 'read', 'create', 'update', 'delete')
 *
 * @example
 * ```typescript
 * // GET /api/v1/customers (list)
 * const action = getActionFromMethod('GET', true)
 * // => 'list'
 *
 * // GET /api/v1/customers/123 (read single)
 * const action = getActionFromMethod('GET', false)
 * // => 'read'
 * ```
 */
export function getActionFromMethod(method: string, isCollection: boolean): string {
  // Special case: GET on collection is 'list', GET on single entity is 'read'
  if (method === 'GET') {
    return isCollection ? LIST_ACTION : 'read'
  }

  return HTTP_TO_ACTION[method] || 'read'
}

/**
 * Check if user has permission for entity action
 *
 * This is the main permission check function for API endpoints.
 * Returns either success indicator or error Response.
 *
 * @param userId - User ID
 * @param teamId - Team ID
 * @param entitySlug - Entity slug (e.g., 'customers')
 * @param action - Action being performed (e.g., 'create', 'read', 'list')
 * @returns Success indicator or error Response
 *
 * @example
 * ```typescript
 * // In API route handler
 * const permCheck = await checkEntityPermission(userId, teamId, 'customers', 'create')
 * if (!permCheck.allowed) {
 *   return permCheck.error
 * }
 * // Continue with operation...
 * ```
 */
export async function checkEntityPermission(
  userId: string,
  teamId: string,
  entitySlug: string,
  action: string
): Promise<{ allowed: true } | { allowed: false; error: NextResponse }> {
  const permission = getEntityPermission(entitySlug, action)

  console.log(`[PermMiddleware] Checking permission: ${permission} for user ${userId} in team ${teamId}`)

  const hasPermission = await checkPermission(userId, teamId, permission)

  console.log(`[PermMiddleware] Result: ${hasPermission}`)

  if (!hasPermission) {
    return {
      allowed: false,
      error: NextResponse.json(
        {
          success: false,
          error: {
            message: `Permission denied: You do not have permission to ${action} ${entitySlug}`,
            code: 'PERMISSION_DENIED',
            details: {
              requiredPermission: permission,
              entity: entitySlug,
              action: action,
            }
          }
        },
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  return { allowed: true }
}

/**
 * Helper for common API pattern: check permission and return early if denied
 *
 * @param userId - User ID
 * @param teamId - Team ID
 * @param entitySlug - Entity slug
 * @param method - HTTP method
 * @param isCollection - Whether this is a collection endpoint
 * @returns null if allowed, error Response if denied
 *
 * @example
 * ```typescript
 * // Simplified usage in API routes
 * const error = await checkEntityPermissionOrFail(userId, teamId, 'customers', 'POST', true)
 * if (error) return error
 *
 * // Continue with operation...
 * ```
 */
export async function checkEntityPermissionOrFail(
  userId: string,
  teamId: string,
  entitySlug: string,
  method: string,
  isCollection: boolean
): Promise<NextResponse | null> {
  const action = getActionFromMethod(method, isCollection)
  const result = await checkEntityPermission(userId, teamId, entitySlug, action)

  return result.allowed ? null : result.error
}
