/**
 * Polar.sh Payment Gateway Implementation
 *
 * Implements BillingGateway interface for Polar.sh.
 * Wraps Polar SDK types into provider-agnostic result types.
 *
 * Key differences from Stripe:
 * - Uses `productPriceId` instead of `priceId`
 * - Cancel = "revoke" in Polar terminology (immediate)
 * - Customer portal via "customer sessions" (not a hosted portal page)
 * - Webhook verification requires ALL headers, not just a signature string
 * - Uses `validateEvent` from @polar-sh/sdk/webhooks
 *
 * NOTE: Polar also offers @polar-sh/better-auth for direct Better Auth integration.
 * That is an ALTERNATIVE approach to this gateway. If you want the simpler plugin-based
 * approach (auto-create customer on signup, client-side checkout helpers), use the
 * Better Auth plugin instead of this gateway. The two approaches are mutually exclusive
 * for the same project - pick one.
 */

import { Polar } from '@polar-sh/sdk'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
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
} from './types'

// Lazy-load Polar client to avoid initialization during build time
let polarInstance: Polar | null = null

function getPolar(): Polar {
  if (!polarInstance) {
    if (!process.env.POLAR_ACCESS_TOKEN) {
      throw new Error('POLAR_ACCESS_TOKEN is not configured')
    }
    polarInstance = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
    })
  }
  return polarInstance
}

/**
 * Polar.sh implementation of the BillingGateway interface.
 * Maps Polar SDK types to provider-agnostic result types.
 */
export class PolarGateway implements BillingGateway {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const { teamId, planSlug, billingPeriod, successUrl, cancelUrl, customerEmail } = params

    // Get price ID from billing config (uses providerPriceIds -> stripePriceId* fallback)
    const priceId = PlanService.getPriceId(planSlug, billingPeriod)
    if (!priceId) {
      throw new Error(`No price ID configured for ${planSlug} ${billingPeriod}`)
    }

    const checkoutParams: Record<string, unknown> = {
      productPriceId: priceId,
      successUrl,
      metadata: { teamId, planSlug, billingPeriod },
    }

    if (customerEmail) {
      checkoutParams.customerEmail = customerEmail
    }

    // Polar doesn't have a cancel_url concept like Stripe,
    // but we can use the success/return URLs
    if (cancelUrl) {
      checkoutParams.returnUrl = cancelUrl
    }

    const result = await getPolar().checkouts.create(checkoutParams as Parameters<typeof getPolar.prototype.checkouts.create>[0])

    return {
      id: result.id,
      url: result.url ?? null,
    }
  }

  async createPortalSession(params: CreatePortalParams): Promise<PortalSessionResult> {
    const { customerId, returnUrl } = params

    // Polar uses "customer sessions" to provide portal access
    const result = await getPolar().customerSessions.create({
      customerId,
    })

    // customerPortalUrl already includes the return context
    return {
      url: result.customerPortalUrl,
    }
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signatureOrHeaders: string | Record<string, string>
  ): WebhookEventResult {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('POLAR_WEBHOOK_SECRET is not configured')
    }

    // Polar requires ALL headers for verification, not just a signature
    const headers = typeof signatureOrHeaders === 'string'
      ? { 'webhook-id': '', 'webhook-timestamp': '', 'webhook-signature': signatureOrHeaders }
      : signatureOrHeaders

    const body = typeof payload === 'string' ? payload : payload.toString('utf-8')

    try {
      const event = validateEvent(body, headers, webhookSecret)
      return {
        id: (event as Record<string, unknown>).id as string || crypto.randomUUID(),
        type: event.type,
        data: event.data as Record<string, unknown>,
      }
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        throw new Error(`Polar webhook verification failed: ${error.message}`)
      }
      throw error
    }
  }

  async getCustomer(customerId: string): Promise<CustomerResult> {
    const customer = await getPolar().customers.get({ id: customerId })

    return {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
    }
  }

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const { email, name, metadata } = params

    const customerParams: Record<string, unknown> = { email }
    if (name) customerParams.name = name
    if (metadata) customerParams.metadata = metadata

    // Add organization ID if available
    if (process.env.POLAR_ORGANIZATION_ID) {
      customerParams.organizationId = process.env.POLAR_ORGANIZATION_ID
    }

    const customer = await getPolar().customers.create(
      customerParams as Parameters<typeof getPolar.prototype.customers.create>[0]
    )

    return {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
    }
  }

  async updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<SubscriptionResult> {
    const { subscriptionId, newPriceId } = params

    // Polar uses subscriptions.update with productPriceId
    const result = await getPolar().subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: {
        productPriceId: newPriceId,
      },
    })

    return {
      id: result.id,
      status: result.status,
      cancelAtPeriodEnd: result.cancelAtPeriodEnd ?? false,
    }
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<SubscriptionResult> {
    // Polar: cancel via subscriptions.update with cancelAtPeriodEnd flag
    // This schedules cancellation at the end of the current billing period
    const result = await getPolar().subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: {
        cancelAtPeriodEnd: true,
      },
    })

    return {
      id: result.id,
      status: result.status,
      cancelAtPeriodEnd: true,
    }
  }

  async cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult> {
    // Polar: "revoke" = immediate cancellation
    const result = await getPolar().subscriptions.revoke({
      id: subscriptionId,
    })

    return {
      id: result.id,
      status: result.status ?? 'canceled',
      cancelAtPeriodEnd: false,
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    // Polar: reactivate by setting cancelAtPeriodEnd back to false
    const result = await getPolar().subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: {
        cancelAtPeriodEnd: false,
      },
    })

    return {
      id: result.id,
      status: result.status,
      cancelAtPeriodEnd: false,
    }
  }
}

/**
 * Get raw Polar instance for advanced usage (e.g., webhook handlers that need full types).
 * Prefer using getBillingGateway() for all other operations.
 */
export function getPolarInstance(): Polar {
  return getPolar()
}
