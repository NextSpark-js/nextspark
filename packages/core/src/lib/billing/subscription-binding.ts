/**
 * The subscription row a gateway applies a NEW paid subscription to (#300).
 *
 * A team keeps its subscription rows: when one ends (an expired trial, a cancelled or expired subscription) it stays
 * with that status, and a later checkout must still activate the team. So the row is the team's current one (active,
 * trialing or past_due), else its latest one, locked for the caller's update. Setting the latest row active cannot
 * conflict with idx_subscriptions_unique_active: the team has no current row then.
 *
 * Only for binding a new subscription to a team (Stripe checkout.session.completed, Polar checkout.updated, Lemon
 * Squeezy subscription_created, ...). Events about a subscription that is already bound look it up by its external id.
 * Call it inside the webhook's transaction (processWebhookEventOnce), so the lock holds until the update commits.
 */

import { queryOne } from '../db'

export interface BindableSubscriptionRow {
  id: string
  teamId: string
  status: string
  paymentProvider: string | null
  externalSubscriptionId: string | null
  metadata: Record<string, unknown> | null
}

const CURRENT_STATUSES = ['active', 'trialing', 'past_due']

/**
 * The team's row for a new paid subscription, or null when the team has no row at all (logged as an error with the
 * event id: the payment cannot be applied).
 *
 * `bind`, when given, refuses a current row that is already bound to another subscription, of the same provider or of
 * another one (logged as an error): a second live subscription is not applied over the first, and a team switching
 * providers cancels the old subscription first. An ended row is always reused.
 */
export async function subscriptionRowForNewSubscription(
  teamId: string,
  context: { gateway: string; eventId: string; bind?: { provider: string; externalSubscriptionId: string } }
): Promise<BindableSubscriptionRow | null> {
  const row = await queryOne<BindableSubscriptionRow>(
    `SELECT id, "teamId", status, "paymentProvider", "externalSubscriptionId", metadata
     FROM subscriptions
     WHERE "teamId" = $1
     ORDER BY (status = ANY($2::text[])) DESC, "createdAt" DESC
     LIMIT 1
     FOR UPDATE`,
    [teamId, CURRENT_STATUSES]
  )
  if (!row) {
    console.error(`[${context.gateway}-webhook] Event ${context.eventId}: team ${teamId} has no subscription row, the subscription is not applied`)
    return null
  }
  const bind = context.bind
  if (bind && CURRENT_STATUSES.includes(row.status) && row.externalSubscriptionId) {
    if (row.paymentProvider !== bind.provider) {
      console.error(
        `[${context.gateway}-webhook] Event ${context.eventId}: team ${teamId} has a live ${row.paymentProvider ?? 'unknown'} subscription ` +
        `${row.externalSubscriptionId}; ${bind.provider} subscription ${bind.externalSubscriptionId} is not applied (cancel the ${row.paymentProvider ?? 'other'} one first)`
      )
      return null
    }
    if (row.externalSubscriptionId !== bind.externalSubscriptionId) {
      console.error(
        `[${context.gateway}-webhook] Event ${context.eventId}: team ${teamId} already has live subscription ${row.externalSubscriptionId}, ` +
        `${bind.externalSubscriptionId} is not applied`
      )
      return null
    }
  }
  return row
}
