/**
 * Billing Lifecycle Jobs
 *
 * Background jobs for automatic subscription lifecycle management:
 * - Expire trials when trial period ends
 * - Handle grace period for past_due subscriptions
 * - Reset monthly usage counters
 *
 * P1: Lifecycle Management
 */

import { queryWithRLS, queryOneWithRLS } from '../db'

export interface JobResult {
  processed: number
  errors: string[]
}

/**
 * Expire trials that have passed their trial end date
 * Trial -> Expired (if no payment method) or Active (if payment processed by Stripe)
 */
export async function expireTrials(): Promise<JobResult> {
  const result: JobResult = { processed: 0, errors: [] }

  // Find trials that should expire
  const expiredTrials = await queryWithRLS<{ id: string; teamId: string }>(
    `SELECT id, "teamId" FROM subscriptions
     WHERE status = 'trialing'
       AND "trialEndsAt" < NOW()
       AND "externalSubscriptionId" IS NULL
     FOR UPDATE SKIP LOCKED`
  )

  console.log(`[lifecycle-job] Found ${expiredTrials.length} trials to expire`)

  for (const trial of expiredTrials) {
    try {
      await queryWithRLS(
        `UPDATE subscriptions
         SET status = 'expired', "updatedAt" = NOW()
         WHERE id = $1`,
        [trial.id]
      )

      // Log event
      await logLifecycleEvent(trial.id, 'trial_expired')
      result.processed++
    } catch (error) {
      result.errors.push(`Failed to expire trial ${trial.id}: ${error}`)
    }
  }

  return result
}

/**
 * Handle past_due subscriptions - expire after grace period (3 days)
 * GRACE_PERIOD_DAYS is hardcoded to prevent SQL injection
 */
export async function handlePastDueGracePeriod(): Promise<JobResult> {
  const result: JobResult = { processed: 0, errors: [] }
  // Grace period: 3 days (hardcoded in query for security)

  const expiredPastDue = await queryWithRLS<{ id: string }>(
    `SELECT id FROM subscriptions
     WHERE status = 'past_due'
       AND "updatedAt" < NOW() - INTERVAL '3 days'
     FOR UPDATE SKIP LOCKED`
  )

  console.log(`[lifecycle-job] Found ${expiredPastDue.length} past_due subscriptions to expire`)

  for (const sub of expiredPastDue) {
    try {
      await queryWithRLS(
        `UPDATE subscriptions
         SET status = 'expired', "updatedAt" = NOW()
         WHERE id = $1`,
        [sub.id]
      )

      await logLifecycleEvent(sub.id, 'past_due_expired')
      result.processed++
    } catch (error) {
      result.errors.push(`Failed to expire past_due ${sub.id}: ${error}`)
    }
  }

  return result
}

/**
 * Reset monthly usage counters
 * Archives previous month's usage, doesn't delete (for historical data)
 */
export async function resetMonthlyUsage(): Promise<JobResult> {
  const result: JobResult = { processed: 0, errors: [] }

  // Get current month key
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear

  const previousPeriodKey = `${previousYear}-${String(previousMonth).padStart(2, '0')}`

  console.log(`[lifecycle-job] Archiving usage for period: ${previousPeriodKey}`)

  // Archive previous month's usage (don't delete, just mark)
  const archived = await queryWithRLS(
    `UPDATE usage
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{archived}', 'true')
     WHERE "periodKey" = $1
       AND (metadata->>'archived') IS NULL
     RETURNING id`,
    [previousPeriodKey]
  )

  result.processed = archived.length
  console.log(`[lifecycle-job] Archived ${archived.length} usage records`)

  return result
}

/**
 * Log lifecycle event for audit trail
 */
async function logLifecycleEvent(subscriptionId: string, eventType: string) {
  await queryWithRLS(
    `INSERT INTO "billing_events" ("subscriptionId", type, status, amount, currency, metadata)
     VALUES ($1, 'lifecycle', 'succeeded', 0, 'usd', $2)`,
    [subscriptionId, JSON.stringify({ event: eventType, timestamp: new Date().toISOString() })]
  )
}
