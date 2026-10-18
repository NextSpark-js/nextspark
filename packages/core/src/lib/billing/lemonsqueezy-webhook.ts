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
 * carry `teamToken`, an HMAC of the team id and the checkout's variant id, and the webhook binds a new subscription or
 * an order to a team only when the token matches that team and the variant the event is about. The key is
 * LEMONSQUEEZY_TEAM_TOKEN_SECRET, or the webhook signing secret when it is unset.
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

/** The key of the team token: LEMONSQUEEZY_TEAM_TOKEN_SECRET, else LEMONSQUEEZY_WEBHOOK_SECRET; null when neither is set. */
export function lemonSqueezyTeamTokenSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.LEMONSQUEEZY_TEAM_TOKEN_SECRET?.trim() || env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim() || null
}

/** The token a checkout of `variantId` carries next to the team id: hex HMAC-SHA256 of both. */
export function lemonSqueezyTeamToken(teamId: string, variantId: string, secret: string): string {
  return createHmac('sha256', secret).update(`nextspark-lemonsqueezy-team:${teamId}:${variantId}`).digest('hex')
}

/** True when `token` is the team token of `teamId` for one of `variantIds`; constant-time per variant. */
export function isValidLemonSqueezyTeamToken(teamId: string, variantIds: string[], token: unknown, secret: string): boolean {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false
  const given = Buffer.from(token, 'hex')
  return variantIds.some(variantId => timingSafeEqual(Buffer.from(lemonSqueezyTeamToken(teamId, variantId, secret), 'hex'), given))
}
