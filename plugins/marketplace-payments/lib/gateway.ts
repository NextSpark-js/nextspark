/**
 * The contract of a split-payment provider. The amounts a gateway receives were already computed on the server
 * (lib/commission.ts): a gateway forwards them, it does not decide them.
 */

export type MarketplaceProvider = 'stripe' | 'mercadopago'

export type SellerStatus = 'pending' | 'active' | 'restricted' | 'disconnected'

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed'

/** The seller a call acts for. `accessToken` is decrypted, and only present for a provider whose calls use it. */
export interface SellerRef {
  providerAccountId: string
  accessToken?: string
}

export interface OnboardingParams {
  teamId: string
  email?: string
  country?: string
  /** Where the provider sends the seller back. */
  returnUrl: string
  /** Stripe only: where an expired onboarding link sends the seller. */
  refreshUrl?: string
  /** The seller's existing provider account, to resume its onboarding. */
  providerAccountId?: string
  /** OAuth providers only: the opaque anti-CSRF value of this attempt. */
  state?: string
}

export interface OnboardingResult {
  redirectUrl: string
  /** Set when the provider created the account at this step. */
  providerAccountId?: string
}

export interface AccountStatusResult {
  status: SellerStatus
  chargesEnabled: boolean
  payoutsEnabled: boolean
  country?: string
}

export interface SplitCheckoutParams {
  /** Our payment row's id. The provider returns it in its events, and it is the idempotency key. */
  paymentId: string
  amountCents: number
  commissionCents: number
  currency: string
  description: string
  successUrl: string
  cancelUrl: string
  /** The webhook URL of this payment, for a provider that takes one per checkout. */
  notificationUrl?: string
}

export interface SplitCheckoutResult {
  checkoutUrl: string
  providerCheckoutId: string
}

export interface RefundParams {
  providerPaymentId: string
  /** Omitted: the whole payment. */
  amountCents?: number
  currency: string
  /** Stable across retries of the same refund. */
  idempotencyKey: string
}

export interface RefundResult {
  providerRefundId: string
}

/** A request as it arrived: the raw bytes, because a signature is computed over them. */
export interface RawWebhookRequest {
  rawBody: Buffer
  /** Header names in lower case. */
  headers: Record<string, string>
  url: URL
}

export interface MarketplaceGateway {
  readonly provider: MarketplaceProvider
  startOnboarding(params: OnboardingParams): Promise<OnboardingResult>
  getAccountStatus(seller: SellerRef): Promise<AccountStatusResult>
  createSplitCheckout(params: SplitCheckoutParams, seller: SellerRef): Promise<SplitCheckoutResult>
  refund(params: RefundParams, seller: SellerRef): Promise<RefundResult>
}
