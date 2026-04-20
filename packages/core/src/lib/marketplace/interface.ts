/**
 * Marketplace Gateway Interface
 *
 * Defines the contract for marketplace payment providers.
 * This is SEPARATE from BillingGateway (which handles SaaS subscriptions).
 *
 * MarketplaceGateway handles:
 * - Connecting merchant accounts (onboarding)
 * - Creating split payments (customer pays, platform takes commission)
 * - Managing payouts to merchants
 * - Handling refunds with fee allocation
 * - Webhook signature verification
 */

import type {
  ConnectedAccount,
  OnboardingStatus,
  MarketplacePaymentStatus,
  PayoutStatus,
} from './types'

// ===========================================
// PARAMETER TYPES
// ===========================================

export interface CreateConnectedAccountParams {
  teamId: string
  email: string
  businessName?: string
  country: string               // ISO 3166-1 alpha-2
  businessType?: 'individual' | 'company'
  metadata?: Record<string, string>
}

export interface CreateOnboardingLinkParams {
  externalAccountId: string     // acct_xxx or MP user_id
  refreshUrl: string            // URL if link expires
  returnUrl: string             // URL after completing onboarding
}

export interface CreateMarketplacePaymentParams {
  connectedAccountId: string    // Our internal connected account ID
  externalAccountId: string     // Provider's account ID (acct_xxx, MP user_id)
  amount: number                // Total amount in smallest currency unit
  currency: string
  applicationFee: number        // Platform commission in smallest currency unit
  referenceId: string           // Booking/order ID
  description?: string
  customerEmail?: string
  customerId?: string           // Provider's customer ID if known
  successUrl?: string           // For redirect-based flows
  cancelUrl?: string
  metadata?: Record<string, string>
}

export interface CreateMarketplaceCheckoutParams {
  connectedAccountId: string
  externalAccountId: string
  amount: number
  currency: string
  applicationFee: number
  referenceId: string
  description: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export interface RefundMarketplacePaymentParams {
  externalPaymentId: string
  amount?: number               // Partial refund amount (omit for full)
  refundApplicationFee?: boolean // Whether to refund the platform fee too
  reason?: string
}

export interface CreatePayoutParams {
  externalAccountId: string
  amount: number
  currency: string
  description?: string
}

// ===========================================
// RESULT TYPES
// ===========================================

export interface ConnectedAccountResult {
  id: string                    // Provider's account ID
  email: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  onboardingStatus: OnboardingStatus
  requirements?: {
    currentlyDue: string[]
    eventuallyDue: string[]
    pastDue: string[]
    disabledReason: string | null
  }
}

export interface OnboardingLinkResult {
  url: string
  expiresAt?: Date
}

export interface DashboardLinkResult {
  url: string
}

export interface MarketplacePaymentResult {
  id: string                    // Provider's payment ID
  status: MarketplacePaymentStatus
  statusDetail?: string
  chargeId?: string
  transferId?: string
  url?: string | null           // Checkout URL (for redirect flows)
}

export interface RefundResult {
  id: string
  amount: number
  status: string
  feeRefunded: number           // How much of the application fee was refunded
}

export interface PayoutResult {
  id: string
  amount: number
  currency: string
  status: PayoutStatus
  arrivalDate?: Date
}

export interface AccountBalanceResult {
  available: number
  pending: number
  currency: string
}

// ===========================================
// GATEWAY INTERFACE
// ===========================================

export interface MarketplaceGateway {
  /** Provider identifier */
  readonly provider: string

  // --- Account Management ---

  /** Create a connected merchant account */
  createConnectedAccount(params: CreateConnectedAccountParams): Promise<ConnectedAccountResult>

  /** Generate an onboarding link for the merchant */
  createOnboardingLink(params: CreateOnboardingLinkParams): Promise<OnboardingLinkResult>

  /** Get the current status of a connected account */
  getAccountStatus(externalAccountId: string): Promise<ConnectedAccountResult>

  /** Generate a dashboard link for the merchant (Express dashboard for Stripe) */
  createDashboardLink(externalAccountId: string): Promise<DashboardLinkResult>

  // --- Payments ---

  /** Create a checkout session with payment splitting */
  createMarketplaceCheckout(params: CreateMarketplaceCheckoutParams): Promise<MarketplacePaymentResult>

  /** Create a direct payment with splitting (for API/server-side payments) */
  createMarketplacePayment(params: CreateMarketplacePaymentParams): Promise<MarketplacePaymentResult>

  /** Get payment status */
  getPaymentStatus(externalPaymentId: string): Promise<MarketplacePaymentResult>

  // --- Refunds ---

  /** Refund a marketplace payment (full or partial) */
  refundPayment(params: RefundMarketplacePaymentParams): Promise<RefundResult>

  // --- Payouts ---

  /** Trigger a manual payout to a connected account */
  createPayout(params: CreatePayoutParams): Promise<PayoutResult>

  /** Get the available balance for a connected account */
  getAccountBalance(externalAccountId: string): Promise<AccountBalanceResult>

  // --- Webhooks ---

  /** Verify webhook signature and return parsed event */
  verifyWebhookSignature(
    payload: string | Buffer,
    signatureOrHeaders: string | Record<string, string>
  ): { id: string; type: string; account?: string; data: Record<string, unknown> }
}
