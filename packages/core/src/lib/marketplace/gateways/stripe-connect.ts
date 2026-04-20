/**
 * Stripe Connect Gateway Implementation
 *
 * Implements MarketplaceGateway for Stripe Connect Express accounts
 * with Destination Charges for payment splitting.
 *
 * Model: Express accounts + Destination charges
 * - Platform is merchant of record (customer's card statement shows platform name)
 * - application_fee_amount extracts platform commission
 * - Stripe handles KYC/onboarding for connected accounts
 */

import Stripe from 'stripe'
import type { MarketplaceGateway } from '../interface'
import type {
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
} from '../interface'
import type { OnboardingStatus, MarketplacePaymentStatus } from '../types'

// Lazy-load Stripe client
let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }
  return stripeInstance
}

/**
 * Map Stripe account status to our OnboardingStatus
 */
function mapAccountStatus(account: Stripe.Account): OnboardingStatus {
  if (account.requirements?.disabled_reason) return 'disabled'
  if (account.charges_enabled && account.payouts_enabled) return 'active'
  if (account.requirements?.past_due?.length) return 'restricted'
  if (account.details_submitted) return 'in_progress'
  return 'pending'
}

/**
 * Map Stripe payment intent status to our MarketplacePaymentStatus
 */
function mapPaymentStatus(status: string): MarketplacePaymentStatus {
  const statusMap: Record<string, MarketplacePaymentStatus> = {
    requires_payment_method: 'pending',
    requires_confirmation: 'pending',
    requires_action: 'pending',
    processing: 'processing',
    succeeded: 'succeeded',
    canceled: 'canceled',
    requires_capture: 'processing',
  }
  return statusMap[status] || 'failed'
}

export class StripeConnectGateway implements MarketplaceGateway {
  readonly provider = 'stripe_connect'

  // --- Account Management ---

  async createConnectedAccount(params: CreateConnectedAccountParams): Promise<ConnectedAccountResult> {
    const account = await getStripe().accounts.create({
      type: 'express',
      country: params.country,
      email: params.email,
      business_type: params.businessType || 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: params.businessName || undefined,
        mcc: '7230', // Barber and Beauty Shops
      },
      metadata: {
        teamId: params.teamId,
        ...params.metadata,
      },
    })

    return this.mapAccountResult(account)
  }

  async createOnboardingLink(params: CreateOnboardingLinkParams): Promise<OnboardingLinkResult> {
    const accountLink = await getStripe().accountLinks.create({
      account: params.externalAccountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: 'account_onboarding',
    })

    return {
      url: accountLink.url,
      // Account links expire quickly (minutes, not hours)
      expiresAt: new Date(accountLink.expires_at * 1000),
    }
  }

  async getAccountStatus(externalAccountId: string): Promise<ConnectedAccountResult> {
    const account = await getStripe().accounts.retrieve(externalAccountId)
    return this.mapAccountResult(account)
  }

  async createDashboardLink(externalAccountId: string): Promise<DashboardLinkResult> {
    const loginLink = await getStripe().accounts.createLoginLink(externalAccountId)
    return { url: loginLink.url }
  }

  // --- Payments ---

  async createMarketplaceCheckout(params: CreateMarketplaceCheckoutParams): Promise<MarketplacePaymentResult> {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: {
              name: params.description,
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: params.applicationFee,
        transfer_data: {
          destination: params.externalAccountId,
        },
        metadata: {
          referenceId: params.referenceId,
          connectedAccountId: params.connectedAccountId,
          ...params.metadata,
        },
      },
      customer_email: params.customerEmail || undefined,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        referenceId: params.referenceId,
        connectedAccountId: params.connectedAccountId,
      },
    })

    return {
      id: session.id,
      status: 'pending',
      url: session.url,
    }
  }

  async createMarketplacePayment(params: CreateMarketplacePaymentParams): Promise<MarketplacePaymentResult> {
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      application_fee_amount: params.applicationFee,
      transfer_data: {
        destination: params.externalAccountId,
      },
      customer: params.customerId || undefined,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        referenceId: params.referenceId,
        connectedAccountId: params.connectedAccountId,
        ...params.metadata,
      },
      description: params.description,
    })

    return {
      id: paymentIntent.id,
      status: mapPaymentStatus(paymentIntent.status),
      chargeId: typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id,
    }
  }

  async getPaymentStatus(externalPaymentId: string): Promise<MarketplacePaymentResult> {
    const pi = await getStripe().paymentIntents.retrieve(externalPaymentId)

    return {
      id: pi.id,
      status: mapPaymentStatus(pi.status),
      chargeId: typeof pi.latest_charge === 'string'
        ? pi.latest_charge
        : pi.latest_charge?.id,
    }
  }

  // --- Refunds ---

  async refundPayment(params: RefundMarketplacePaymentParams): Promise<RefundResult> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: params.externalPaymentId,
      refund_application_fee: params.refundApplicationFee ?? true,
      reason: (params.reason as Stripe.RefundCreateParams['reason']) || 'requested_by_customer',
    }

    if (params.amount) {
      refundParams.amount = params.amount
    }

    const refund = await getStripe().refunds.create(refundParams)

    return {
      id: refund.id,
      amount: refund.amount,
      status: refund.status || 'pending',
      feeRefunded: 0, // Stripe handles fee refund automatically if refund_application_fee is true
    }
  }

  // --- Payouts ---

  async createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
    const payout = await getStripe().payouts.create(
      {
        amount: params.amount,
        currency: params.currency,
        description: params.description,
      },
      { stripeAccount: params.externalAccountId }
    )

    return {
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status as PayoutResult['status'],
      arrivalDate: new Date(payout.arrival_date * 1000),
    }
  }

  async getAccountBalance(externalAccountId: string): Promise<AccountBalanceResult> {
    const balance = await getStripe().balance.retrieve({
      stripeAccount: externalAccountId,
    })

    const available = balance.available[0]
    const pending = balance.pending[0]

    return {
      available: available?.amount ?? 0,
      pending: pending?.amount ?? 0,
      currency: available?.currency ?? pending?.currency ?? 'usd',
    }
  }

  // --- Webhooks ---

  verifyWebhookSignature(
    payload: string | Buffer,
    signatureOrHeaders: string | Record<string, string>
  ): { id: string; type: string; account?: string; data: Record<string, unknown> } {
    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('STRIPE_CONNECT_WEBHOOK_SECRET is not configured')
    }

    const signature = typeof signatureOrHeaders === 'string'
      ? signatureOrHeaders
      : signatureOrHeaders['stripe-signature'] || ''

    const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret)

    return {
      id: event.id,
      type: event.type,
      account: event.account,
      data: event.data as unknown as Record<string, unknown>,
    }
  }

  // --- Private helpers ---

  private mapAccountResult(account: Stripe.Account): ConnectedAccountResult {
    return {
      id: account.id,
      email: account.email ?? '',
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
      onboardingStatus: mapAccountStatus(account),
      requirements: account.requirements ? {
        currentlyDue: account.requirements.currently_due ?? [],
        eventuallyDue: account.requirements.eventually_due ?? [],
        pastDue: account.requirements.past_due ?? [],
        disabledReason: account.requirements.disabled_reason ?? null,
      } : undefined,
    }
  }
}
