/**
 * MercadoPago Marketplace Webhook Extensions
 *
 * Override these callbacks to handle marketplace-specific payment events.
 * This is the theme/project-level customization point.
 *
 * Example: fulfill an order when payment is approved, notify seller on chargeback, etc.
 *
 * import type { MPMarketplaceWebhookExtensions } from '@nextsparkjs/core/lib/marketplace/mercadopago-webhook'
 *
 * export const mpMarketplaceWebhookExtensions: MPMarketplaceWebhookExtensions = {
 *   onPaymentApproved: async (payment, context) => {
 *     // Fulfill the order
 *     await fulfillOrder(context.referenceId)
 *   },
 *   onChargeBack: async (payment, context) => {
 *     // Freeze seller payouts, notify admin
 *     await handleChargeback(context.connectedAccountId, payment.id)
 *   },
 * }
 */

import type { MPMarketplaceWebhookExtensions } from '@nextsparkjs/core/lib/marketplace/mercadopago-webhook'

export const mpMarketplaceWebhookExtensions: MPMarketplaceWebhookExtensions = {}
