/**
 * Theme Scheduled Actions - Handler Registration
 *
 * This module registers all scheduled action handlers for the default theme.
 * The core initializer calls these functions at startup.
 *
 * @module contents/themes/default/lib/scheduled-actions
 *
 * @example
 * // Called by core/lib/scheduled-actions/initializer.ts
 * // Do NOT call directly from app code
 * registerAllHandlers()
 * await registerRecurringActions()
 */

import { registerWebhookAction } from './webhook'
import { registerBillingAction, ensureBillingActionScheduled } from './billing'
import { addAction } from '@nextsparkjs/core/lib/plugins/hook-system'
import { scheduleAction } from '@nextsparkjs/core/lib/scheduled-actions'

/**
 * Register all scheduled action handlers for this theme
 *
 * This function registers all action handlers (webhook, billing, etc.).
 * Called by the core initializer - the guard is handled there.
 */
export function registerAllHandlers(): void {
  console.log('[theme:scheduled-actions] Registering action handlers...')

  registerWebhookAction()
  registerBillingAction()
  registerEntityWebhookHooks()

  console.log('[theme:scheduled-actions] All action handlers registered')
}

/**
 * Register entity hooks for webhook triggers
 *
 * Listens to entity.tasks.created and entity.tasks.updated hooks
 * and schedules webhook:send actions.
 */
function registerEntityWebhookHooks() {
  console.log('[theme:scheduled-actions] Registering entity webhook hooks...')

  // AC-15: Task create triggers webhook:send
  addAction('entity.tasks.created', async (hookData: Record<string, unknown>) => {
    try {
      console.log('[webhook:trigger] Task created, scheduling webhook...')
      const entityData = hookData.data as Record<string, unknown> | undefined
      await scheduleAction('webhook:send', {
        eventType: 'created',
        entityType: 'task',
        entityId: (hookData.id as string) || (entityData?.id as string),
        data: entityData,
        teamId: entityData?.teamId as string | undefined,
      })
    } catch (error) {
      console.error('[webhook:trigger] Error scheduling task create webhook:', error)
    }
  })

  // AC-16: Task update triggers webhook:send
  addAction('entity.tasks.updated', async (hookData: Record<string, unknown>) => {
    try {
      console.log('[webhook:trigger] Task updated, scheduling webhook...')
      const entityData = hookData.data as Record<string, unknown> | undefined
      await scheduleAction('webhook:send', {
        eventType: 'updated',
        entityType: 'task',
        entityId: hookData.id as string,
        data: entityData,
        teamId: entityData?.teamId as string | undefined,
      })
    } catch (error) {
      console.error('[webhook:trigger] Error scheduling task update webhook:', error)
    }
  })

  // =========================================================================
  // SUBSCRIPTION WEBHOOK HOOKS
  // =========================================================================
  // These hooks listen to subscription lifecycle events from SubscriptionService
  // and schedule webhook:send actions to notify external systems.

  // Subscription created
  addAction('subscription.created', async (hookData: Record<string, unknown>) => {
    try {
      console.log('[webhook:trigger] Subscription created, scheduling webhook...')
      const entityData = hookData.data as Record<string, unknown> | undefined
      await scheduleAction('webhook:send', {
        eventType: 'created',
        entityType: 'subscription',
        entityId: hookData.id as string,
        data: entityData,
        teamId: (hookData.teamId as string) || (entityData?.teamId as string),
        webhookKey: 'subscriptions',
      })
    } catch (error) {
      console.error('[webhook:trigger] Error scheduling subscription created webhook:', error)
    }
  })

  // Subscription updated (status change, plan change)
  addAction('subscription.updated', async (hookData: Record<string, unknown>) => {
    try {
      console.log('[webhook:trigger] Subscription updated, scheduling webhook...')
      const entityData = hookData.data as Record<string, unknown> | undefined
      await scheduleAction('webhook:send', {
        eventType: 'updated',
        entityType: 'subscription',
        entityId: hookData.id as string,
        data: {
          ...entityData,
          previousStatus: hookData.previousStatus,
          newStatus: hookData.newStatus,
          previousPlan: hookData.previousPlan,
          newPlan: hookData.newPlan,
          isUpgrade: hookData.isUpgrade,
        },
        teamId: (hookData.teamId as string) || (entityData?.teamId as string),
        webhookKey: 'subscriptions',
      })
    } catch (error) {
      console.error('[webhook:trigger] Error scheduling subscription updated webhook:', error)
    }
  })

  // Subscription cancelled
  addAction('subscription.cancelled', async (hookData: Record<string, unknown>) => {
    try {
      console.log('[webhook:trigger] Subscription cancelled, scheduling webhook...')
      const entityData = hookData.data as Record<string, unknown> | undefined
      await scheduleAction('webhook:send', {
        eventType: 'cancelled',
        entityType: 'subscription',
        entityId: hookData.id as string,
        data: {
          ...entityData,
          immediate: hookData.immediate,
          cancelAtPeriodEnd: hookData.cancelAtPeriodEnd,
        },
        teamId: entityData?.teamId as string | undefined,
        webhookKey: 'subscriptions',
      })
    } catch (error) {
      console.error('[webhook:trigger] Error scheduling subscription cancelled webhook:', error)
    }
  })

  console.log('[theme:scheduled-actions] Entity webhook hooks registered')
}

/**
 * Register recurring scheduled actions for this theme
 *
 * This async function ensures all recurring actions are scheduled.
 * Called by the core initializer after handlers are registered.
 */
export async function registerRecurringActions(): Promise<void> {
  console.log('[theme:scheduled-actions] Registering recurring actions...')

  await ensureBillingActionScheduled()

  console.log('[theme:scheduled-actions] All recurring actions registered')
}

// Re-export individual functions for direct use
export { registerWebhookAction } from './webhook'
export { registerBillingAction, ensureBillingActionScheduled } from './billing'
