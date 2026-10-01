/**
 * DevTools API Authentication
 *
 * Permission helpers for devtools-only API endpoints.
 * Only the developer role can access these APIs, the same rule as the /devtools pages and /api/devtools/*.
 */

import { NextResponse } from 'next/server'
import type { DualAuthResult } from './dual-auth'

/** User roles allowed to access DevTools APIs: developer only (superadmin administers the app, not its internals). */
const DEVTOOLS_ALLOWED_ROLES = ['developer'] as const

/**
 * Check if the authenticated user can access DevTools APIs
 *
 * @param authResult - Result from authenticateRequest()
 * @returns true if the user has the developer role
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
        message: 'Access denied: DevTools APIs require the developer role',
        code: 'DEVTOOLS_ACCESS_DENIED',
        details: {
          requiredRoles: DEVTOOLS_ALLOWED_ROLES,
          hint: 'Only the developer role can access DevTools APIs, regardless of team role',
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
