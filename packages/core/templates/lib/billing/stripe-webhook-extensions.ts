/**
 * Stripe Webhook Extensions
 *
 * Override this file in your project to handle one-time payments
 * (credit packs, LTD purchases, upsells, etc.) via Stripe checkout.
 *
 * Example: create lib/billing/stripe-webhook-extensions.ts in your project:
 *
 *   import type { StripeWebhookExtensions } from '@nextsparkjs/core/lib/billing/stripe-webhook'
 *   import { handleCreditPackPurchase } from '@/lib/billing/credit-packs'
 *
 *   export const stripeWebhookExtensions: StripeWebhookExtensions = {
 *     onOneTimePaymentCompleted: async (session, context) => {
 *       if (session.metadata?.type === 'credit_pack') {
 *         await handleCreditPackPurchase(session, context)
 *       }
 *     }
 *   }
 */

import type { StripeWebhookExtensions } from '@nextsparkjs/core/lib/billing/stripe-webhook'

export const stripeWebhookExtensions: StripeWebhookExtensions = {}
