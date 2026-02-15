/**
 * Provider-Agnostic Billing Gateway Types
 *
 * These types decouple consumers from specific payment provider SDKs (Stripe, Polar, etc.).
 * Gateway implementations map provider-specific types to these generic results.
 */

// ===========================================
// CHECKOUT & PORTAL
// ===========================================

export interface CheckoutSessionResult {
  id: string
  url: string | null
}

export interface PortalSessionResult {
  url: string
}

// ===========================================
// SUBSCRIPTIONS
// ===========================================

export interface SubscriptionResult {
  id: string
  status: string
  cancelAtPeriodEnd: boolean
}

// ===========================================
// CUSTOMERS
// ===========================================

export interface CustomerResult {
  id: string
  email: string | null
  name: string | null
}

// ===========================================
// WEBHOOKS
// ===========================================

export interface WebhookEventResult {
  id: string
  type: string
  data: Record<string, unknown>
}

// ===========================================
// PARAMETER TYPES
// ===========================================

export interface CreateCheckoutParams {
  teamId: string
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  customerId?: string
}

export interface CreatePortalParams {
  customerId: string
  returnUrl: string
}

export interface CreateCustomerParams {
  email: string
  name?: string
  metadata?: Record<string, string>
}

export interface UpdateSubscriptionParams {
  subscriptionId: string
  newPriceId: string
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
}
