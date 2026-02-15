/**
 * Stripe Payment Gateway Implementation
 *
 * Implements BillingGateway interface for Stripe.
 * Wraps Stripe SDK types into provider-agnostic result types.
 *
 * P2: Stripe Integration
 */

import Stripe from 'stripe'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import type { BillingGateway } from './interface'
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
} from './types'

// Re-export param types for backward compat
export type { CreateCheckoutParams, CreatePortalParams, UpdateSubscriptionParams } from './types'

// Lazy-load Stripe client to avoid initialization during build time
let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
      typescript: true
    })
  }
  return stripeInstance
}

/**
 * Stripe implementation of the BillingGateway interface.
 * Maps Stripe SDK types to provider-agnostic result types.
 */
export class StripeGateway implements BillingGateway {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const { teamId, planSlug, billingPeriod, successUrl, cancelUrl, customerEmail, customerId } =
      params

    // Get price ID from billing config
    const planConfig = BILLING_REGISTRY.plans.find(p => p.slug === planSlug)
    if (!planConfig) {
      throw new Error(`Plan ${planSlug} not found in BILLING_REGISTRY`)
    }

    const priceId =
      billingPeriod === 'yearly' ? planConfig.stripePriceIdYearly : planConfig.stripePriceIdMonthly

    if (!priceId) {
      throw new Error(`No Stripe price configured for ${planSlug} ${billingPeriod}`)
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { teamId, planSlug, billingPeriod },
      client_reference_id: teamId
    }

    // Use existing customer or create new one
    if (customerId) {
      sessionParams.customer = customerId
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail
    }

    // Add trial if plan has trial days and this is a new subscription
    if (planConfig.trialDays && planConfig.trialDays > 0 && !customerId) {
      sessionParams.subscription_data = {
        trial_period_days: planConfig.trialDays
      }
    }

    const session = await getStripe().checkout.sessions.create(sessionParams)
    return { id: session.id, url: session.url }
  }

  async createPortalSession(params: CreatePortalParams): Promise<PortalSessionResult> {
    const session = await getStripe().billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl
    })
    return { url: session.url }
  }

  verifyWebhookSignature(payload: string | Buffer, signatureOrHeaders: string | Record<string, string>): WebhookEventResult {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    }
    // Stripe uses a single signature string (stripe-signature header)
    const signature = typeof signatureOrHeaders === 'string'
      ? signatureOrHeaders
      : signatureOrHeaders['stripe-signature'] || ''
    const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
    return {
      id: event.id,
      type: event.type,
      data: event.data as unknown as Record<string, unknown>,
    }
  }

  async getCustomer(customerId: string): Promise<CustomerResult> {
    const customer = await getStripe().customers.retrieve(customerId)
    if ('deleted' in customer && customer.deleted) {
      throw new Error(`Customer ${customerId} has been deleted`)
    }
    return {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
    }
  }

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const customer = await getStripe().customers.create(params)
    return {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
    }
  }

  async updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<SubscriptionResult> {
    const { subscriptionId, newPriceId, prorationBehavior = 'create_prorations' } = params
    const stripe = getStripe()

    // Get current subscription to find the item ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const itemId = subscription.items.data[0]?.id

    if (!itemId) {
      throw new Error('Subscription has no items')
    }

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: itemId,
        price: newPriceId,
      }],
      proration_behavior: prorationBehavior,
    })

    return {
      id: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    }
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<SubscriptionResult> {
    const updated = await getStripe().subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    })
    return {
      id: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    }
  }

  async cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult> {
    const canceled = await getStripe().subscriptions.cancel(subscriptionId)
    return {
      id: canceled.id,
      status: canceled.status,
      cancelAtPeriodEnd: canceled.cancel_at_period_end,
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    const updated = await getStripe().subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    })
    return {
      id: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    }
  }
}

// ===========================================
// ESCAPE HATCH: Raw Stripe instance for webhook handlers
// ===========================================

/**
 * Get raw Stripe instance for advanced usage (webhook handlers that need Stripe.Event types).
 * Prefer using getBillingGateway() for all other operations.
 */
export function getStripeInstance(): Stripe {
  return getStripe()
}

// ===========================================
// DEPRECATED: Standalone function exports for backward compatibility
// ===========================================

const _defaultGateway = new StripeGateway()

/** @deprecated Use getBillingGateway().createCheckoutSession() instead */
export async function createCheckoutSession(params: CreateCheckoutParams) {
  return _defaultGateway.createCheckoutSession(params)
}

/** @deprecated Use getBillingGateway().createPortalSession() instead */
export async function createPortalSession(params: CreatePortalParams) {
  return _defaultGateway.createPortalSession(params)
}

/** @deprecated Use getBillingGateway().verifyWebhookSignature() instead */
export function verifyWebhookSignature(payload: string | Buffer, signatureOrHeaders: string | Record<string, string>) {
  return _defaultGateway.verifyWebhookSignature(payload, signatureOrHeaders)
}

/** @deprecated Use getBillingGateway().getCustomer() instead */
export async function getCustomer(customerId: string) {
  return _defaultGateway.getCustomer(customerId)
}

/** @deprecated Use getBillingGateway().createCustomer() instead */
export async function createCustomer(params: CreateCustomerParams) {
  return _defaultGateway.createCustomer(params)
}

/** @deprecated Use getBillingGateway().cancelSubscriptionAtPeriodEnd() instead */
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  return _defaultGateway.cancelSubscriptionAtPeriodEnd(subscriptionId)
}

/** @deprecated Use getBillingGateway().cancelSubscriptionImmediately() instead */
export async function cancelSubscriptionImmediately(subscriptionId: string) {
  return _defaultGateway.cancelSubscriptionImmediately(subscriptionId)
}

/** @deprecated Use getBillingGateway().reactivateSubscription() instead */
export async function reactivateSubscription(subscriptionId: string) {
  return _defaultGateway.reactivateSubscription(subscriptionId)
}

/** @deprecated Use getBillingGateway().updateSubscriptionPlan() instead */
export async function updateSubscriptionPlan(params: UpdateSubscriptionParams) {
  return _defaultGateway.updateSubscriptionPlan(params)
}
