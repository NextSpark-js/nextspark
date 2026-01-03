/**
 * Stripe Payment Gateway Integration
 *
 * Wrapper around Stripe SDK for subscription billing operations.
 * Handles checkout sessions, customer portal, and webhooks.
 *
 * P2: Stripe Integration
 */

import Stripe from 'stripe'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'

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

export interface CreateCheckoutParams {
  teamId: string
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  customerId?: string // Existing Stripe customer
}

export interface CreatePortalParams {
  customerId: string
  returnUrl: string
}

/**
 * Create Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
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

  return getStripe().checkout.sessions.create(sessionParams)
}

/**
 * Create Stripe Customer Portal session for self-service billing
 */
export async function createPortalSession(
  params: CreatePortalParams
): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl
  })
}

/**
 * Verify Stripe webhook signature (MANDATORY for security)
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }
  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
}

/**
 * Get Stripe customer by ID
 */
export async function getCustomer(customerId: string): Promise<Stripe.Customer> {
  return getStripe().customers.retrieve(customerId) as Promise<Stripe.Customer>
}

/**
 * Create Stripe customer
 */
export async function createCustomer(params: {
  email: string
  name?: string
  metadata?: Record<string, string>
}): Promise<Stripe.Customer> {
  return getStripe().customers.create(params)
}

/**
 * Get Stripe instance for advanced usage (lazy-loaded)
 */
export function getStripeInstance(): Stripe {
  return getStripe()
}

/**
 * Cancel subscription at period end (soft cancel)
 * User keeps access until the current billing period ends
 */
export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true
  })
}

/**
 * Cancel subscription immediately (hard cancel)
 * User loses access immediately
 */
export async function cancelSubscriptionImmediately(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.cancel(subscriptionId)
}

/**
 * Reactivate a subscription that was scheduled to cancel
 * Only works if cancel_at_period_end was true
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false
  })
}

export interface UpdateSubscriptionParams {
  subscriptionId: string
  newPriceId: string
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
}

/**
 * Update subscription to a new plan/price
 * Stripe handles proration automatically based on prorationBehavior
 */
export async function updateSubscriptionPlan(
  params: UpdateSubscriptionParams
): Promise<Stripe.Subscription> {
  const { subscriptionId, newPriceId, prorationBehavior = 'create_prorations' } = params

  const stripe = getStripe()

  // Get current subscription to find the item ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const itemId = subscription.items.data[0]?.id

  if (!itemId) {
    throw new Error('Subscription has no items')
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: itemId,
      price: newPriceId,
    }],
    proration_behavior: prorationBehavior,
  })
}
