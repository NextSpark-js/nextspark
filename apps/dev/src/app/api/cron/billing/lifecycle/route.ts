/**
 * Billing Lifecycle Cron Job
 *
 * Scheduled job that runs automatically to manage subscription lifecycle.
 * Protected with CRON_SECRET to prevent unauthorized execution.
 *
 * P1: Lifecycle Management
 *
 * Configure in vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/billing/lifecycle",
 *       "schedule": "0 0 * * *"
 *     }
 *   ]
 * }
 */

import { NextRequest } from 'next/server'
import { handlePastDueGracePeriod } from '@nextsparkjs/core/lib/billing/jobs'
import { SubscriptionService, UsageService } from '@nextsparkjs/core/lib/services'

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET (MANDATORY for security)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('[lifecycle-cron] Unauthorized attempt to access cron endpoint')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    expireTrials: { processed: 0, errors: [] as string[] },
    pastDueGrace: { processed: 0, errors: [] as string[] },
    resetUsage: { processed: 0, errors: [] as string[] }
  }

  try {
    console.log('[lifecycle-cron] Starting billing lifecycle jobs...')

    // 1. Expire trials (service returns count)
    try {
      const count = await SubscriptionService.processExpiredTrials()
      results.expireTrials = { processed: count, errors: [] }
    } catch (error) {
      results.expireTrials.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    // 2. Handle past_due grace period (jobs.ts function returns {processed, errors})
    results.pastDueGrace = await handlePastDueGracePeriod()

    // 3. Reset monthly usage (only on first day of month)
    const today = new Date()
    if (today.getDate() === 1) {
      try {
        const count = await UsageService.processMonthlyReset()
        results.resetUsage = { processed: count, errors: [] }
      } catch (error) {
        results.resetUsage.errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    const totalProcessed =
      results.expireTrials.processed + results.pastDueGrace.processed + results.resetUsage.processed

    const allErrors = [
      ...results.expireTrials.errors,
      ...results.pastDueGrace.errors,
      ...results.resetUsage.errors
    ]

    console.log(`[lifecycle-cron] Completed: ${totalProcessed} items processed, ${allErrors.length} errors`)

    return Response.json({
      success: true,
      processed: totalProcessed,
      errors: allErrors,
      details: results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[lifecycle-cron] Fatal error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering via dashboard
export async function POST(request: NextRequest) {
  return GET(request)
}
