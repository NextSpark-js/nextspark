/**
 * DevTools Scheduled Actions API
 *
 * GET /api/v1/devtools/scheduled-actions
 *
 * Returns scheduled actions with filtering and pagination.
 * Requires superadmin or developer user role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  canAccessDevtoolsApi,
  createDevtoolsAccessDeniedResponse,
  createDevtoolsUnauthorizedResponse,
} from '@nextsparkjs/core/lib/api/auth/devtools-auth'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import type { ScheduledAction, ScheduledActionStatus } from '@nextsparkjs/core/lib/scheduled-actions/types'
import { getAllRegisteredActions } from '@nextsparkjs/core/lib/scheduled-actions/registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request
  const authResult = await authenticateRequest(request)

  if (!authResult.success) {
    return createDevtoolsUnauthorizedResponse()
  }

  // Check DevTools access permission
  if (!canAccessDevtoolsApi(authResult)) {
    return createDevtoolsAccessDeniedResponse()
  }

  // Extract query parameters
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') as ScheduledActionStatus | null
  const actionType = searchParams.get('action_type')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  // Build query
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (status) {
    conditions.push(`status = $${paramIndex++}`)
    params.push(status)
  }

  if (actionType) {
    conditions.push(`"actionType" = $${paramIndex++}`)
    params.push(actionType)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Query total count
  const countQuery = `
    SELECT COUNT(*) as count
    FROM "scheduled_actions"
    ${whereClause}
  `
  const countResult = await queryWithRLS<{ count: string }>(countQuery, params, null)
  const total = parseInt(countResult[0]?.count || '0', 10)

  // Query actions with pagination
  const offset = (page - 1) * limit
  const actionsQuery = `
    SELECT
      id,
      "actionType",
      status,
      payload,
      "teamId",
      "scheduledAt",
      "startedAt",
      "completedAt",
      "errorMessage",
      attempts,
      "recurringInterval",
      "createdAt",
      "updatedAt"
    FROM "scheduled_actions"
    ${whereClause}
    ORDER BY "createdAt" DESC
    LIMIT $${paramIndex++}
    OFFSET $${paramIndex}
  `
  const actionsResult = await queryWithRLS<ScheduledAction>(actionsQuery, [...params, limit, offset], null)

  // Get all registered action types
  const registeredActions = getAllRegisteredActions()

  return NextResponse.json({
    success: true,
    data: {
      actions: actionsResult,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        registeredActionTypes: registeredActions,
      },
    },
  })
}, 'read');

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}
