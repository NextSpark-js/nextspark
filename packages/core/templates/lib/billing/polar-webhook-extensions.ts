/**
 * Polar Webhook Extensions
 *
 * Override this file in your project to handle one-time payments
 * (credit packs, LTD purchases, upsells, etc.) via Polar checkout.
 *
 * Example: create lib/billing/polar-webhook-extensions.ts in your project:
 *
 *   import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/config-types'
 *   import { handleCreditPackPurchase } from '@/lib/billing/credit-packs'
 *
 *   export const polarWebhookExtensions: PolarWebhookExtensions = {
 *     onOneTimePaymentCompleted: async (order, context) => {
 *       if (order.metadata?.type === 'credit_pack') {
 *         await handleCreditPackPurchase(order, context)
 *       }
 *     }
 *   }
 */

import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/config-types'

export const polarWebhookExtensions: PolarWebhookExtensions = {}
