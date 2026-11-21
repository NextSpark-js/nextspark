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
import { getAllRegisteredActions } from '@nextsparkjs/core/lib/scheduled-actions/registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { scheduleAction } from '@nextsparkjs/core/lib/scheduled-actions/scheduler'
import { listScheduledActions } from '@nextsparkjs/core/lib/scheduled-actions/devtools-list'

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

  const { actions: actionsResult, total } = await listScheduledActions({ status, actionType, limit, offset })

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
        "lockGroup"
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

    // Create a new action with the same payload. "retryOf" is unique: a failed action is retried once, and a second retry
    // (two clicks, two tabs) fails the insert, atomically. If the retry fails too, it is the one to retry.
    let newActionId: string
    try {
      newActionId = await scheduleAction(
        failedAction.actionType,
        failedAction.payload,
        {
          scheduledAt: new Date(), // Schedule immediately
          teamId: failedAction.teamId ?? undefined,
          lockGroup: failedAction.lockGroup ?? undefined,
          retryOf: failedAction.id,
        }
      )
    } catch (error) {
      // 23505 = unique_violation: another request already retried this action
      if ((error as { code?: string }).code === '23505') {
        return createApiError('This action was already retried', 409, undefined, 'ACTION_ALREADY_RETRIED')
      }
      throw error
    }

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
