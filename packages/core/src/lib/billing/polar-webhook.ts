/**
 * Polar.sh Webhook Types
 *
 * Exports extension interfaces for the Polar webhook handler.
 * Projects override lib/billing/polar-webhook-extensions.ts to handle
 * one-time payment events (credit packs, LTD purchases, upsells, etc.)
 *
 * Usage in lib/billing/polar-webhook-extensions.ts:
 *   import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/polar-webhook'
 *
 *   export const polarWebhookExtensions: PolarWebhookExtensions = {
 *     onOneTimePaymentCompleted: async (order, context) => {
 *       if (order.metadata?.type === 'credit_pack') {
 *         await handleCreditPackPurchase(order, context)
 *       }
 *     }
 *   }
 */

import type { OneTimePaymentContext } from './types'

export type { OneTimePaymentContext }

export interface PolarOrderData {
  id: string
  amount: number
  currency: string
  metadata: Record<string, string>
  customerId?: string
  externalCustomerId?: string
  productId?: string
}

export interface PolarWebhookExtensions {
  /**
   * Called when a Polar order.paid event fires for an order with no subscriptionId
   * (i.e. a one-time purchase, not a recurring subscription payment).
   * Use this for credit packs, one-time purchases, etc.
   */
  onOneTimePaymentCompleted?: (
    order: PolarOrderData,
    context: OneTimePaymentContext
  ) => Promise<void>
}
