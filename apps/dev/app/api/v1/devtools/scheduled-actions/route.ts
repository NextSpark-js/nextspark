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
import { scheduleAction } from '@nextsparkjs/core/lib/scheduled-actions/scheduler'

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
      "maxRetries",
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

  // Count failed actions (last 24 hours)
  const failedCountQuery = `
    SELECT COUNT(*) as count
    FROM "scheduled_actions"
    WHERE status = 'failed'
      AND "completedAt" > NOW() - INTERVAL '24 hours'
  `
  const failedCountResult = await queryWithRLS<{ count: string }>(failedCountQuery, [], null)
  const failedCount = parseInt(failedCountResult[0]?.count || '0', 10)

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
        failedCount,
      },
    },
  })
}, 'read');

/**
 * POST /api/v1/devtools/scheduled-actions
 *
 * Retry a failed action by creating a new action with the same payload.
 * Requires superadmin or developer user role.
 *
 * Body:
 * {
 *   "actionId": "uuid-of-failed-action"
 * }
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request
  const authResult = await authenticateRequest(request)

  if (!authResult.success) {
    return createDevtoolsUnauthorizedResponse()
  }

  // Check DevTools access permission
  if (!canAccessDevtoolsApi(authResult)) {
    return createDevtoolsAccessDeniedResponse()
  }

  // Parse request body
  const body = await request.json()
  const { actionId } = body

  if (!actionId) {
    return NextResponse.json({
      success: false,
      error: 'actionId is required'
    }, { status: 400 })
  }

  // Fetch the failed action
  const actions = await queryWithRLS<ScheduledAction>(
    `SELECT
      id,
      "actionType",
      status,
      payload,
      "teamId",
      "lockGroup"
    FROM "scheduled_actions"
    WHERE id = $1`,
    [actionId],
    null
  )

  if (actions.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Action not found'
    }, { status: 404 })
  }

  const failedAction = actions[0]

  // Only allow retrying failed actions
  if (failedAction.status !== 'failed') {
    return NextResponse.json({
      success: false,
      error: 'Only failed actions can be retried'
    }, { status: 400 })
  }

  // Check if there's already a pending action with the same actionType and payload
  // Use JSONB containment operator for reliable comparison
  const existingPending = await queryWithRLS<{ id: string }>(
    `SELECT id
     FROM "scheduled_actions"
     WHERE "actionType" = $1
       AND payload @> $2::jsonb
       AND $2::jsonb @> payload
       AND status = 'pending'
     LIMIT 1`,
    [failedAction.actionType, JSON.stringify(failedAction.payload)],
    null
  )

  if (existingPending.length > 0) {
    return NextResponse.json({
      success: false,
      error: 'A pending action with the same payload already exists',
      existingActionId: existingPending[0].id
    }, { status: 409 })
  }

  // Create a new action with the same payload
  const newActionId = await scheduleAction(
    failedAction.actionType,
    failedAction.payload,
    {
      scheduledAt: new Date(), // Schedule immediately
      teamId: failedAction.teamId ?? undefined,
      lockGroup: failedAction.lockGroup ?? undefined
    }
  )

  return NextResponse.json({
    success: true,
    data: {
      newActionId
    }
  })
}, 'write');

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}
