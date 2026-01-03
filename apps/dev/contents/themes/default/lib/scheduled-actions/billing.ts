/**
 * Billing Scheduled Action Handler
 *
 * This handler performs daily checks for subscription renewals and updates
 * subscription statuses for expired subscriptions.
 *
 * Uses core billing services for actual subscription lifecycle management.
 *
 * @module contents/themes/default/lib/scheduled-actions/billing
 */

import { registerScheduledAction, scheduleRecurringAction, scheduleAction } from '@nextsparkjs/core/lib/scheduled-actions'
import type { ScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { expireTrials, handlePastDueGracePeriod } from '@nextsparkjs/core/lib/billing/jobs'
import { SubscriptionService } from '@nextsparkjs/core/lib/services/subscription.service'

/**
 * Register the billing check action handler
 *
 * This function registers the 'billing:check-renewals' action handler that
 * processes subscription renewals and updates expired subscriptions.
 *
 * Uses core billing services:
 * - expireTrials(): Expire trials that have passed their end date
 * - handlePastDueGracePeriod(): Expire past_due subscriptions after grace period
 * - SubscriptionService.listExpiringSoon(): Get subscriptions expiring soon
 */
export function registerBillingAction() {
  registerScheduledAction(
    'billing:check-renewals',
    async (_payload: unknown, _action: ScheduledAction) => {
      console.log('[billing:check-renewals] Starting subscription lifecycle check...')

      try {
        // 1. Expire trials that have passed their end date
        const trialsResult = await expireTrials()
        console.log(`[billing:check-renewals] Trials expired: ${trialsResult.processed}`)
        if (trialsResult.errors.length > 0) {
          console.warn('[billing:check-renewals] Trial expiration errors:', trialsResult.errors)
        }

        // 2. Handle past_due subscriptions after grace period
        const pastDueResult = await handlePastDueGracePeriod()
        console.log(`[billing:check-renewals] Past due expired: ${pastDueResult.processed}`)
        if (pastDueResult.errors.length > 0) {
          console.warn('[billing:check-renewals] Past due handling errors:', pastDueResult.errors)
        }

        // 3. Send reminder webhooks for subscriptions expiring in 7 days
        const expiringSoon = await SubscriptionService.listExpiringSoon(7)
        console.log(`[billing:check-renewals] Subscriptions expiring in 7 days: ${expiringSoon.length}`)

        // Schedule webhook for each expiring subscription
        let webhooksScheduled = 0
        for (const sub of expiringSoon) {
          const daysUntilExpiry = Math.ceil(
            (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )

          await scheduleAction('webhook:send', {
            eventType: 'expiring_soon',
            entityType: 'subscription',
            entityId: sub.id,
            data: {
              subscriptionId: sub.id,
              teamId: sub.teamId,
              planSlug: sub.plan.slug,
              status: sub.status,
              periodEnd: sub.currentPeriodEnd,
              daysUntilExpiry,
            },
          }, { teamId: sub.teamId })

          webhooksScheduled++
        }

        if (webhooksScheduled > 0) {
          console.log(`[billing:check-renewals] Scheduled ${webhooksScheduled} expiring_soon webhooks`)
        }

        // Log summary
        console.log('[billing:check-renewals] Check completed successfully:', {
          trialsExpired: trialsResult.processed,
          pastDueExpired: pastDueResult.processed,
          expiringSoon: expiringSoon.length,
          webhooksScheduled,
        })
      } catch (error) {
        console.error('[billing:check-renewals] Error during check:', error)
        throw error
      }
    },
    {
      description: 'Daily subscription lifecycle check',
      timeout: 60000, // 60 seconds for billing checks
    }
  )
}

/**
 * Ensure billing action is scheduled as recurring
 *
 * This function should be called at app startup to ensure the billing check
 * is scheduled to run daily. It checks if a recurring action already exists
 * to avoid duplicates.
 *
 * @example
 * // Call at app startup
 * await ensureBillingActionScheduled()
 */
export async function ensureBillingActionScheduled() {
  try {
    // Check if a pending recurring billing action already exists
    // Only check for pending status - if no pending exists, create a new one
    const existingQuery = `
      SELECT id
      FROM "scheduled_actions"
      WHERE "actionType" = 'billing:check-renewals'
        AND "recurringInterval" = 'daily'
        AND status = 'pending'
      LIMIT 1
    `

    const existing = await queryWithRLS<{ id: string }>(
      existingQuery,
      [],
      null // System operation, no user context
    )

    if (existing.length > 0) {
      console.log('[billing:check-renewals] Daily recurring action already scheduled')
      return
    }

    // Schedule new recurring daily action
    console.log('[billing:check-renewals] Scheduling new daily recurring action...')
    const actionId = await scheduleRecurringAction(
      'billing:check-renewals',
      {}, // No payload needed
      'daily'
    )

    console.log(`[billing:check-renewals] Daily recurring action scheduled with ID: ${actionId}`)
  } catch (error) {
    console.error('[billing:check-renewals] Error ensuring action is scheduled:', error)
    // Don't throw - this is called at startup and shouldn't crash the app
  }
}
