/**
 * DevTools Scheduled Actions API
 *
 * GET /api/v1/devtools/scheduled-actions
 *
 * Returns scheduled actions with filtering and pagination.
 * Requires the developer role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { parsePaginationParams } from '@nextsparkjs/core/lib/api/pagination'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  canAccessDevtoolsApi,
  createDevtoolsAccessDeniedResponse,
  createDevtoolsUnauthorizedResponse,
} from '@nextsparkjs/core/lib/api/auth/devtools-auth'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import type { ScheduledAction, ScheduledActionStatus } from '@nextsparkjs/core/lib/scheduled-actions/types'
import type { ScheduledActionRow } from '@nextsparkjs/core/components/devtools/scheduled-actions/types'
import { getAllRegisteredActions } from '@nextsparkjs/core/lib/scheduled-actions/registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { scheduleAction } from '@nextsparkjs/core/lib/scheduled-actions/scheduler'
import { ALREADY_RETRIED_SQL, RETRY_LINK_COLUMNS } from '@nextsparkjs/core/lib/scheduled-actions/retry-links'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request; the API-key scope is declared at the entry point,
  // which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'admin:devtools' })

  if (!authResult.success) {
    return authResult.type === 'api-key' ? createAuthFailureResponse(authResult) : createDevtoolsUnauthorizedResponse()
  }

  // Check DevTools access permission
  if (!canAccessDevtoolsApi(authResult)) {
    return createDevtoolsAccessDeniedResponse()
  }

  // Extract query parameters
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') as ScheduledActionStatus | null
  const actionType = searchParams.get('action_type')
  const { page, limit, offset } = parsePaginationParams(request, 20)

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
  const actionsQuery = `
    SELECT
      id,
      "actionType",
      status,
      payload,
      "teamId",
      (SELECT t.name FROM "teams" t WHERE t.id = "scheduled_actions"."teamId") AS "teamName",
      "scheduledAt",
      "startedAt",
      "completedAt",
      "errorMessage",
      attempts,
      "maxRetries",
      "recurringInterval",
      "createdAt",
      "updatedAt",
      ${RETRY_LINK_COLUMNS}
    FROM "scheduled_actions"
    ${whereClause}
    ORDER BY "createdAt" DESC
    LIMIT $${paramIndex++}
    OFFSET $${paramIndex}
  `
  const actionsResult = await queryWithRLS<ScheduledActionRow>(actionsQuery, [...params, limit, offset], null)

  // Get all registered action types
  const registeredActions = getAllRegisteredActions()

  // How many actions each status has under the action type filter (not the status one, so the filter can show them all)
  const countsResult = await queryWithRLS<{ status: ScheduledActionStatus; count: string }>(
    `SELECT status, COUNT(*) AS count FROM "scheduled_actions" ${actionType ? 'WHERE "actionType" = $1' : ''} GROUP BY status`,
    actionType ? [actionType] : [],
    null
  )
  const statusCounts: Record<string, number> = { pending: 0, running: 0, completed: 0, failed: 0 }
  for (const { status: rowStatus, count } of countsResult) statusCounts[rowStatus] = parseInt(count, 10)

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
        statusCounts,
      },
    },
  })
}, 'read');

/**
 * POST /api/v1/devtools/scheduled-actions
 *
 * Retry a failed action by creating a new action with the same payload.
 * Requires the developer role.
 *
 * Body:
 * {
 *   "actionId": "uuid-of-failed-action"
 * }
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request; the API-key scope is declared at the entry point,
  // which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'admin:devtools' })

  if (!authResult.success) {
    return authResult.type === 'api-key' ? createAuthFailureResponse(authResult) : createDevtoolsUnauthorizedResponse()
  }

  // Check DevTools access permission
  if (!canAccessDevtoolsApi(authResult)) {
    return createDevtoolsAccessDeniedResponse()
  }

  try {
    // Parse request body
    const parsedBody = await readJsonObject(request)
    if (parsedBody.error) return parsedBody.error
    const body = parsedBody.data
    const { actionId } = body

    if (typeof actionId !== 'string' || !actionId) {
      return createApiError('actionId must be a string', 400, undefined, 'VALIDATION_ERROR')
    }

    // Fetch the failed action
    const actions = await queryWithRLS<ScheduledAction>(
      `SELECT
        id,
        "actionType",
        status,
        payload,
        "teamId",
        "lockGroup",
        "recurringInterval"
      FROM "scheduled_actions"
      WHERE id = $1`,
      [actionId],
      null
    )

    if (actions.length === 0) {
      return createApiError('Action not found', 404, undefined, 'NOT_FOUND')
    }

    const failedAction = actions[0]

    // Only allow retrying failed actions
    if (failedAction.status !== 'failed') {
      return createApiError('Only failed actions can be retried', 400, undefined, 'VALIDATION_ERROR')
    }

    // A failed action is retried once: a later action of the same type and payload is its retry (see retry-links.ts),
    // whatever state that one is in now. If it failed too, it is the one to retry.
    if (failedAction.recurringInterval == null) {
      const retried = await queryWithRLS<{ id: string }>(
        ALREADY_RETRIED_SQL,
        [failedAction.actionType, JSON.stringify(failedAction.payload), failedAction.id],
        null
      )
      if (retried.length > 0) {
        return createApiError('This action was already retried', 409, undefined, 'ACTION_ALREADY_RETRIED', { retryActionId: retried[0].id })
      }
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
      return createApiError('A pending action with the same payload already exists', 409, undefined, 'ACTION_ALREADY_PENDING', { existingActionId: existingPending[0].id })
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
  } catch (error) {
    console.error('[DevTools] Failed to retry scheduled action:', error)
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

export const OPTIONS = corsPreflight
