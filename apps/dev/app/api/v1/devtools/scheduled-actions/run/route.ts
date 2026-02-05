/**
 * DevTools Scheduled Actions Run API
 *
 * POST /api/v1/devtools/scheduled-actions/run
 *
 * Executes a pending action immediately.
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
import type { ScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions/types'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { executeAction } from '@nextsparkjs/core/lib/scheduled-actions/processor'

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
    return NextResponse.json({
      success: false,
      error: 'Action not found'
    }, { status: 404 })
  }

  const action = actions[0]

  // Only allow running pending actions
  if (action.status !== 'pending') {
    return NextResponse.json({
      success: false,
      error: 'Only pending actions can be executed'
    }, { status: 400 })
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
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute action'
    }, { status: 500 })
  }
}, 'write');

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}
