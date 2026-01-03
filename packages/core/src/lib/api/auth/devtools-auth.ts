/**
 * DevTools API Authentication
 *
 * Permission helpers for devtools-only API endpoints.
 * Only superadmin and developer user roles can access these APIs.
 */

import { NextResponse } from 'next/server'
import type { DualAuthResult } from './dual-auth'

/**
 * User roles allowed to access DevTools APIs
 * - superadmin: Full system access
 * - developer: Development and debugging access
 */
const DEVTOOLS_ALLOWED_ROLES = ['superadmin', 'developer'] as const

/**
 * Check if the authenticated user can access DevTools APIs
 *
 * @param authResult - Result from authenticateRequest()
 * @returns true if user has superadmin or developer role
 */
export function canAccessDevtoolsApi(authResult: DualAuthResult): boolean {
  if (!authResult.success || !authResult.user) {
    return false
  }

  return DEVTOOLS_ALLOWED_ROLES.includes(
    authResult.user.role as (typeof DEVTOOLS_ALLOWED_ROLES)[number]
  )
}

/**
 * Create a standardized 403 Forbidden response for DevTools API access denial
 */
export function createDevtoolsAccessDeniedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'Access denied: DevTools APIs require superadmin or developer role',
        code: 'DEVTOOLS_ACCESS_DENIED',
        details: {
          requiredRoles: DEVTOOLS_ALLOWED_ROLES,
          hint: 'User role "member" cannot access DevTools APIs regardless of team role',
        },
      },
    },
    { status: 403 }
  )
}

/**
 * Create a standardized 401 Unauthorized response
 */
export function createDevtoolsUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
        details: {
          hint: 'Provide a valid API key via Authorization header or x-api-key header',
        },
      },
    },
    { status: 401 }
  )
}
