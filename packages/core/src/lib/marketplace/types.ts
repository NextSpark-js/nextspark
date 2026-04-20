/**
 * Marketplace Types
 *
 * Core types for the marketplace/connect payment splitting system.
 * Supports Stripe Connect (Express) and MercadoPago Split.
 *
 * This module is PARALLEL to the billing system:
 * - billing/ = SaaS subscription (the business pays for the platform)
 * - marketplace/ = Payment splitting (customer pays, platform takes commission)
 */

// ===========================================
// PROVIDER TYPES
// ===========================================

export type MarketplaceProvider = 'stripe_connect' | 'mercadopago_split'

// ===========================================
// CONNECTED ACCOUNT TYPES
// ===========================================

export type OnboardingStatus =
  | 'pending'      // Account created, onboarding not started
  | 'in_progress'  // Onboarding started but not complete
  | 'active'       // Fully onboarded, can accept payments
  | 'restricted'   // Some capabilities disabled (e.g., pending KYC docs)
  | 'disabled'     // Account disabled by provider
  | 'disconnected' // Manually disconnected by team

export interface ConnectedAccount {
  id: string
  teamId: string
  provider: MarketplaceProvider
  externalAccountId: string        // acct_xxx (Stripe) or MP user_id
  email: string
  businessName: string | null
  country: string                  // ISO 3166-1 alpha-2 (US, AR, BR, MX)
  currency: string                 // ISO 4217 (usd, ars, brl, mxn)
  onboardingStatus: OnboardingStatus
  chargesEnabled: boolean
  payoutsEnabled: boolean
  commissionRate: number           // 0.15 = 15%
  fixedFee: number                 // Fixed fee per transaction (in smallest currency unit)
  payoutSchedule: 'daily' | 'weekly' | 'monthly' | 'manual'
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// ===========================================
// PAYMENT TYPES
// ===========================================

export type MarketplacePaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'canceled'

export interface MarketplacePayment {
  id: string
  connectedAccountId: string
  teamId: string
  referenceId: string              // External reference (booking ID, order ID, etc.)
  referenceType: string            // 'booking', 'order', etc.
  externalPaymentId: string        // pi_xxx (Stripe) or MP payment_id
  externalChargeId: string | null
  externalTransferId: string | null
  totalAmount: number              // What the customer paid
  applicationFee: number           // Platform commission
  businessAmount: number           // What the business receives (before provider fees)
  providerFee: number | null       // Provider processing fee
  currency: string
  commissionRate: number           // Rate applied for this payment
  status: MarketplacePaymentStatus
  statusDetail: string | null      // Provider-specific status detail
  paymentMethod: string | null     // visa, master, pix, rapipago, etc.
  paymentType: string | null       // credit_card, debit_card, bank_transfer, cash
  refundedAmount: number
  metadata: Record<string, unknown>
  paidAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ===========================================
// PAYOUT TYPES
// ===========================================

export type PayoutStatus =
  | 'pending'
  | 'in_transit'
  | 'paid'
  | 'failed'
  | 'canceled'

export interface Payout {
  id: string
  connectedAccountId: string
  externalPayoutId: string
  amount: number
  currency: string
  status: PayoutStatus
  arrivalDate: Date | null
  failureCode: string | null
  failureMessage: string | null
  createdAt: Date
  updatedAt: Date
}

// ===========================================
// COMMISSION TYPES
// ===========================================

export type CommissionModel = 'percentage' | 'fixed' | 'hybrid' | 'tiered'

export interface CommissionConfig {
  model: CommissionModel
  /** Percentage rate (e.g., 0.15 for 15%). Used in percentage and hybrid models. */
  rate?: number
  /** Fixed fee per transaction in smallest currency unit. Used in fixed and hybrid models. */
  fixedAmount?: number
  /** Minimum fee per transaction. */
  minFee?: number
  /** Maximum fee per transaction. */
  maxFee?: number
  /** Volume-based tiers. Used in tiered model. */
  tiers?: Array<{
    minVolume: number  // Monthly volume threshold
    rate: number       // Rate for this tier
  }>
}

// ===========================================
// WEBHOOK EVENT TYPES
// ===========================================

export interface MarketplaceWebhookEvent {
  id: string
  provider: MarketplaceProvider
  externalEventId: string
  eventType: string
  action: string
  resourceId: string
  processed: boolean
  processedAt: Date | null
  error: string | null
  rawPayload: Record<string, unknown>
  createdAt: Date
}
