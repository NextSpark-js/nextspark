/**
 * Marketplace Module
 *
 * Payment splitting system for marketplace/platform businesses.
 * Supports Stripe Connect and MercadoPago Split.
 *
 * Usage:
 *   import { getMarketplaceGateway, calculateFee } from '@nextsparkjs/core/lib/marketplace'
 *
 *   const gateway = getMarketplaceGateway()
 *   const fee = calculateFee(10000, { model: 'percentage', rate: 0.15 })
 *   const checkout = await gateway.createMarketplaceCheckout({ ... })
 */

// Types
export type {
  MarketplaceProvider,
  ConnectedAccount,
  OnboardingStatus,
  MarketplacePayment,
  MarketplacePaymentStatus,
  Payout,
  PayoutStatus,
  CommissionModel,
  CommissionConfig,
  MarketplaceWebhookEvent,
} from './types'

// Interface
export type {
  MarketplaceGateway,
  CreateConnectedAccountParams,
  CreateOnboardingLinkParams,
  CreateMarketplacePaymentParams,
  CreateMarketplaceCheckoutParams,
  RefundMarketplacePaymentParams,
  CreatePayoutParams,
  ConnectedAccountResult,
  OnboardingLinkResult,
  DashboardLinkResult,
  MarketplacePaymentResult,
  RefundResult,
  PayoutResult,
  AccountBalanceResult,
} from './interface'

// Factory
export {
  getMarketplaceGateway,
  setMarketplaceProvider,
  resetMarketplaceGateway,
} from './gateways/factory'

// Commission
export { calculateFee, describeCommission } from './commission'

// MercadoPago OAuth helpers
export {
  exchangeMPAuthorizationCode,
  refreshMPToken,
  setMPTokenProvider,
} from './gateways/mercadopago-split'
export type { MPTokenProvider } from './gateways/mercadopago-split'

// MercadoPago Marketplace Webhook
export { handleMPMarketplaceWebhook } from './mercadopago-webhook'
export type {
  MPWebhookNotification,
  MPFullPayment,
  MPPaymentContext,
  MPMarketplaceWebhookExtensions,
} from './mercadopago-webhook'

// Stripe Connect Webhook
export { handleStripeConnectWebhook } from './stripe-connect-webhook'
export type { StripeConnectWebhookExtensions } from './stripe-connect-webhook'

// Token Encryption (for marketplace OAuth tokens at rest)
export {
  encryptToken,
  decryptToken,
  encryptTokens,
  decryptTokens,
} from './token-encryption'
