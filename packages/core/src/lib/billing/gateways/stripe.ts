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
import { PlanService } from '../../services/plan.service'
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
  CreateOneTimeCheckoutParams,
} from './types'

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

    const priceId = PlanService.getPriceId(planSlug, billingPeriod)
    if (!priceId) {
      throw new Error(`No price ID configured for ${planSlug} ${billingPeriod}`)
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

  async createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<CheckoutSessionResult> {
    const { teamId, priceId, quantity = 1, successUrl, cancelUrl, customerEmail, customerId, metadata } = params

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { teamId, ...metadata },
      client_reference_id: teamId,
    }

    if (customerId) {
      sessionParams.customer = customerId
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail
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

  getProviderName(): string {
    return 'Stripe'
  }

  getResourceHintDomains(): { preconnect: string[]; dnsPrefetch: string[] } {
    return {
      // js.stripe.com: Stripe.js SDK loaded on page render
      preconnect: ['https://js.stripe.com'],
      // api.stripe.com: called by Stripe.js after user fills payment form (too late for preconnect)
      dnsPrefetch: ['https://api.stripe.com'],
    }
  }

  getSubscriptionDashboardUrl(externalSubscriptionId: string | null | undefined): string | null {
    if (!externalSubscriptionId) return null
    const isLive = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live')
    const prefix = isLive ? '' : 'test/'
    return `https://dashboard.stripe.com/${prefix}subscriptions/${externalSubscriptionId}`
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

