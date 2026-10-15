/**
 * DevTools Scheduled Actions Run API
 *
 * POST /api/v1/devtools/scheduled-actions/run
 *
 * Executes a pending action immediately.
 * Requires the developer role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  canAccessDevtoolsApi,
  createDevtoolsAccessDeniedResponse,
  createDevtoolsUnauthorizedResponse,
} from '@nextsparkjs/core/lib/api/auth/devtools-auth'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import type { ScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions/types'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { executeAction } from '@nextsparkjs/core/lib/scheduled-actions/processor'

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

    // Fetch the pending action
    const actions = await queryWithRLS<ScheduledAction>(
      `SELECT
        id,
        "actionType",
        status,
        payload,
        "teamId",
        "scheduledAt",
        attempts,
        "maxRetries",
        "recurringInterval",
        "recurrenceType",
        "lockGroup"
      FROM "scheduled_actions"
      WHERE id = $1`,
      [actionId],
      null
    )

    if (actions.length === 0) {
      return createApiError('Action not found', 404, undefined, 'NOT_FOUND')
    }

    const action = actions[0]

    // Only allow running pending actions
    if (action.status !== 'pending') {
      return createApiError('Only pending actions can be executed', 400, undefined, 'VALIDATION_ERROR')
    }

    try {
      // Execute the action immediately
      await executeAction(action)

      return NextResponse.json({
        success: true,
        data: {
          executed: true
        }
      })
    } catch (error) {
      console.error('[DevTools] Failed to execute action:', error)
      return createApiError('Failed to execute action', 500, undefined, 'INTERNAL_ERROR')
    }
  } catch (error) {
    console.error('[DevTools] Failed to run scheduled action:', error)
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

export const OPTIONS = corsPreflight
