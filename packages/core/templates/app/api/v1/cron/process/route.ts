/**
 * Cron Endpoint - Process Scheduled Actions
 * GET /api/v1/cron/process
 *
 * This endpoint is designed to be called by an external cron service
 * (e.g., cron-job.org, Vercel Cron, GitHub Actions)
 *
 * Authentication: Requires CRON_SECRET header
 * Frequency: Recommended every 1 minute
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  processPendingActions,
  cleanupOldActions,
  initializeScheduledActions
} from '@nextsparkjs/core/lib/scheduled-actions'
import type { ProcessResult } from '@nextsparkjs/core/lib/scheduled-actions'

/**
 * Process pending scheduled actions
 * Protected by CRON_SECRET for security
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  // Ensure action handlers are registered in this context
  // (initializeScheduledActions has its own guard against duplicates)
  initializeScheduledActions()

  try {
    // Validate CRON_SECRET
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error('[Cron] CRON_SECRET environment variable is not set')
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
          code: 'CRON_SECRET_NOT_CONFIGURED'
        },
        { status: 500 }
      )
    }

    if (!cronSecret || cronSecret !== expectedSecret) {
      console.warn('[Cron] Unauthorized cron request attempt')
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          code: 'INVALID_CRON_SECRET'
        },
        { status: 401 }
      )
    }

    console.log('[Cron] Starting scheduled actions processing')

    // Process pending actions (batch of 10 max)
    const processResult: ProcessResult = await processPendingActions(10)

    // Optionally run cleanup (every 24th run if called every hour)
    // For now, run cleanup every time (can be optimized later)
    const cleanupCount = await cleanupOldActions(7)

    const executionTime = Date.now() - startTime

    console.log(`[Cron] Processing complete in ${executionTime}ms`)

    return NextResponse.json(
      {
        success: true,
        data: {
          processing: processResult,
          cleanup: {
            deletedCount: cleanupCount
          },
          executionTime
        },
        info: {
          timestamp: new Date().toISOString()
        }
      },
      { status: 200 }
    )
  } catch (error) {
    const executionTime = Date.now() - startTime

    console.error('[Cron] Error processing scheduled actions:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'PROCESSING_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        info: {
          timestamp: new Date().toISOString(),
          executionTime
        }
      },
      { status: 500 }
    )
  }
}
