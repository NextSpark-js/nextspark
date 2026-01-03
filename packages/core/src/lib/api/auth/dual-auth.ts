/**
 * Dual Authentication System
 * 
 * Supports both API Key and Session authentication in a single endpoint.
 * Used by the unified /api/v1/ endpoints.
 */

import { NextRequest } from 'next/server'
import { auth } from '../../auth'
import { validateApiKey } from '../auth'
import { queryOne } from '../../db'

// ==========================================
// ADMIN BYPASS CONSTANTS
// ==========================================
/**
 * System Admin Team - Members can bypass team context validation
 * This team is created in core/migrations/090_sample_data.sql
 */
export const SYSTEM_ADMIN_TEAM_ID = 'team-nextspark-001'

/**
 * Header required to confirm cross-team access intention
 */
export const ADMIN_BYPASS_HEADER = 'x-admin-bypass'
export const ADMIN_BYPASS_VALUE = 'confirm-cross-team-access'

/**
 * Roles that can potentially bypass team context (if other conditions are met)
 */
const ELEVATED_ROLES = ['superadmin', 'developer'] as const

export interface DualAuthUser {
  id: string
  email: string
  role: string
  name?: string
  defaultTeamId?: string
}

export interface DualAuthResult {
  success: boolean
  type: 'api-key' | 'session' | 'none'
  user: DualAuthUser | null
  scopes?: string[]
  rateLimitResponse?: Response
}

/**
 * Get user's default team ID (first team they're a member of)
 */
async function getUserDefaultTeamId(userId: string): Promise<string | undefined> {
  try {
    const result = await queryOne<{ teamId: string }>(
      `SELECT "teamId" FROM "team_members"
       WHERE "userId" = $1
       ORDER BY "joinedAt" ASC
       LIMIT 1`,
      [userId]
    )
    return result?.teamId
  } catch (error) {
    console.error('[dual-auth] Failed to get default team:', error)
    return undefined
  }
}

/**
 * Try to authenticate request using either API Key or Session
 */
export async function authenticateRequest(request: NextRequest): Promise<DualAuthResult> {
  // First try API Key authentication
  const apiKeyResult = await tryApiKeyAuth(request)
  if (apiKeyResult.success) {
    return apiKeyResult
  }

  // Then try Session authentication
  const sessionResult = await trySessionAuth(request)
  if (sessionResult.success) {
    return sessionResult
  }

  return {
    success: false,
    type: 'none',
    user: null
  }
}

/**
 * Try API Key authentication
 */
async function tryApiKeyAuth(request: NextRequest): Promise<DualAuthResult> {
  try {
    // Check if request has API Key headers
    const authHeader = request.headers.get('authorization')
    const apiKeyHeader = request.headers.get('x-api-key')

    if (!authHeader?.startsWith('Bearer ') && !apiKeyHeader) {
      return { success: false, type: 'none', user: null }
    }

    // Use existing API Key validation
    const apiAuth = await validateApiKey(request)

    if (!apiAuth) {
      return { success: false, type: 'none', user: null }
    }

    // Get user information from database
    const userInfo = await queryOne<{ email: string; role: string; name: string }>(
      'SELECT email, role, name FROM "users" WHERE id = $1',
      [apiAuth.userId]
    )

    // Get user's default team
    const defaultTeamId = await getUserDefaultTeamId(apiAuth.userId)

    return {
      success: true,
      type: 'api-key',
      user: {
        id: apiAuth.userId,
        email: userInfo?.email || '',
        role: userInfo?.role || 'user',
        name: userInfo?.name,
        defaultTeamId
      },
      scopes: apiAuth.scopes || []
    }
  } catch (error) {
    console.error('API Key auth failed:', error)
    return { success: false, type: 'none', user: null }
  }
}

/**
 * Try Session authentication
 */
async function trySessionAuth(request: NextRequest): Promise<DualAuthResult> {
  try {
    console.log('[dual-auth] Attempting session authentication...')
    const session = await auth.api.getSession({ headers: request.headers })
    console.log('[dual-auth] Session result:', session ? 'found' : 'not found')

    if (!session?.user) {
      console.log('[dual-auth] No session.user found')
      return { success: false, type: 'none', user: null }
    }

    // Get user's default team
    const defaultTeamId = await getUserDefaultTeamId(session.user.id)

    console.log('[dual-auth] Session auth successful for user:', session.user.id)
    return {
      success: true,
      type: 'session',
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role || 'user',
        name: session.user.name,
        defaultTeamId
      },
      scopes: ['all'] // Sessions have full access
    }
  } catch (error) {
    console.error('[dual-auth] Session auth failed with error:', error)
    return { success: false, type: 'none', user: null }
  }
}

/**
 * Check if user has required scope (for API Key auth)
 */
export function hasRequiredScope(authResult: DualAuthResult, requiredScope: string): boolean {
  if (authResult.type === 'session') {
    return true // Sessions have full access
  }

  if (authResult.type === 'api-key' && authResult.scopes) {
    return authResult.scopes.includes(requiredScope) || 
           authResult.scopes.includes('admin:all') || 
           authResult.scopes.includes('*')
  }

  return false
}

// ==========================================
// ADMIN BYPASS FUNCTIONS
// ==========================================

/**
 * Check if user can bypass team context validation
 *
 * Three-layer security model:
 * 1. User must have elevated role (superadmin/developer)
 * 2. Request must include confirmation header (x-admin-bypass)
 * 3. User must be member of System Admin Team (NextSpark Team)
 *
 * @returns true if all conditions are met
 */
export async function canBypassTeamContext(
  authResult: DualAuthResult,
  request: NextRequest
): Promise<boolean> {
  // LAYER 1: Must have elevated role
  if (!authResult.success || !authResult.user) return false
  const hasElevatedRole = ELEVATED_ROLES.includes(
    authResult.user.role as typeof ELEVATED_ROLES[number]
  )
  if (!hasElevatedRole) return false

  // LAYER 2: Must include confirmation header
  const bypassHeader = request.headers.get(ADMIN_BYPASS_HEADER)
  if (bypassHeader !== ADMIN_BYPASS_VALUE) return false

  // LAYER 3: Must be member of System Admin Team
  const isMember = await checkSystemAdminMembership(authResult.user.id)
  if (!isMember) {
    console.log('[dual-auth] User has elevated role but is not member of System Admin Team')
  }
  return isMember
}

/**
 * Check if user is member of System Admin Team
 */
async function checkSystemAdminMembership(userId: string): Promise<boolean> {
  try {
    const member = await queryOne<{ id: string }>(
      'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
      [SYSTEM_ADMIN_TEAM_ID, userId]
    )
    return !!member
  } catch (error) {
    console.error('[dual-auth] Failed to check system admin membership:', error)
    return false
  }
}

/**
 * Create standardized auth error response
 */
export function createAuthError(message: string = 'Authentication required', status: number = 401) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code: 'AUTHENTICATION_FAILED'
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}
