/**
 * Billing Gateway Interface
 *
 * Defines the contract that all payment provider implementations must satisfy.
 * Consumers interact with this interface via the factory (getBillingGateway()),
 * making provider switching a configuration change rather than a code change.
 */

import type {
  CheckoutSessionResult,
  PortalSessionResult,
  SubscriptionResult,
  CustomerResult,
  WebhookEventResult,
  CreateCheckoutParams,
  CreatePortalParams,
  CreateCustomerParams,
  UpdateSubscriptionParams,
  CreateOneTimeCheckoutParams,
} from './types'

export interface BillingGateway {
  // Checkout
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>
  createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<CheckoutSessionResult>
  createPortalSession(params: CreatePortalParams): Promise<PortalSessionResult>

  // Customers
  getCustomer(customerId: string): Promise<CustomerResult>
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>

  // Subscription Management
  updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<SubscriptionResult>
  cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<SubscriptionResult>
  cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult>
  reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult>

  // Dashboard
  /** Get the human-readable provider name (e.g., "Stripe", "Polar") */
  getProviderName(): string

  /** Get the provider dashboard URL for a subscription (e.g., Stripe Dashboard, Polar Dashboard) */
  getSubscriptionDashboardUrl(externalSubscriptionId: string | null | undefined): string | null

  // Webhooks
  verifyWebhookSignature(payload: string | Buffer, signatureOrHeaders: string | Record<string, string>): WebhookEventResult
}
