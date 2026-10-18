/**
 * Lemon Squeezy webhook types and the checkout team token (#268)
 *
 * Exports the extension interface for the Lemon Squeezy webhook handler: a project names its module in
 * nextspark.config.ts (`billing.webhookExtensions.lemonsqueezy`) to handle one-time orders (credit packs, lifetime
 * deals, upsells).
 *
 * Usage in lib/billing/lemonsqueezy-webhook-extensions.ts:
 *   import type { LemonSqueezyWebhookExtensions } from '@nextsparkjs/core/lib/billing/lemonsqueezy-webhook'
 *
 *   export const lemonsqueezyWebhookExtensions: LemonSqueezyWebhookExtensions = {
 *     onOneTimePaymentCompleted: async (order, context) => {
 *       if (order.metadata.type === 'credit_pack') await grantCredits(context.teamId, order)
 *     }
 *   }
 *
 * The team token: Lemon Squeezy returns a checkout's custom data in its webhooks (meta.custom_data), but anyone can
 * also put custom data in a checkout link by hand (`checkout[custom][teamId]=...`). So the checkouts this app creates
 * carry `teamToken`, an HMAC of the team id with the webhook signing secret, and the webhook binds an order or a new
 * subscription to a team only when the token matches.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { OneTimePaymentContext } from './types'

export type { OneTimePaymentContext }

export interface LemonSqueezyOrderData {
  /** The Lemon Squeezy order id */
  id: string
  /** The order's unique identifier (a UUID) */
  identifier: string | null
  /** In cents */
  total: number
  currency: string
  /** The checkout's custom data (teamId, teamToken and the metadata passed to createOneTimeCheckout) */
  metadata: Record<string, string>
  customerId: string | null
  productId: string | null
  variantId: string | null
}

export interface LemonSqueezyWebhookExtensions {
  /**
   * Called for an order_created event of a paid order whose variant is not a plan's (a one-time purchase), after the
   * team in its custom data was verified.
   */
  onOneTimePaymentCompleted?: (
    order: LemonSqueezyOrderData,
    context: OneTimePaymentContext
  ) => Promise<void>
}

/** The token a checkout carries next to the team id: hex HMAC-SHA256 of the team id with the webhook secret. */
export function lemonSqueezyTeamToken(teamId: string, webhookSecret: string): string {
  return createHmac('sha256', webhookSecret).update(`nextspark-lemonsqueezy-team:${teamId}`).digest('hex')
}

/** True when `token` is the team token of `teamId`; constant-time. */
export function isValidLemonSqueezyTeamToken(teamId: string, token: unknown, webhookSecret: string): boolean {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false
  return timingSafeEqual(Buffer.from(lemonSqueezyTeamToken(teamId, webhookSecret), 'hex'), Buffer.from(token, 'hex'))
}
