/**
 * Stripe Payment Gateway Integration
 *
 * Wrapper around Stripe SDK for subscription billing operations.
 * Handles checkout sessions, customer portal, and webhooks.
 *
 * P2: Stripe Integration
 */
import Stripe from 'stripe';
export interface CreateCheckoutParams {
    teamId: string;
    planSlug: string;
    billingPeriod: 'monthly' | 'yearly';
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    customerId?: string;
}
export interface CreatePortalParams {
    customerId: string;
    returnUrl: string;
}
/**
 * Create Stripe Checkout session for subscription
 */
export declare function createCheckoutSession(params: CreateCheckoutParams): Promise<Stripe.Checkout.Session>;
/**
 * Create Stripe Customer Portal session for self-service billing
 */
export declare function createPortalSession(params: CreatePortalParams): Promise<Stripe.BillingPortal.Session>;
/**
 * Verify Stripe webhook signature (MANDATORY for security)
 */
export declare function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event;
/**
 * Get Stripe customer by ID
 */
export declare function getCustomer(customerId: string): Promise<Stripe.Customer>;
/**
 * Create Stripe customer
 */
export declare function createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
}): Promise<Stripe.Customer>;
/**
 * Get Stripe instance for advanced usage (lazy-loaded)
 */
export declare function getStripeInstance(): Stripe;
/**
 * Cancel subscription at period end (soft cancel)
 * User keeps access until the current billing period ends
 */
export declare function cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<Stripe.Subscription>;
/**
 * Cancel subscription immediately (hard cancel)
 * User loses access immediately
 */
export declare function cancelSubscriptionImmediately(subscriptionId: string): Promise<Stripe.Subscription>;
/**
 * Reactivate a subscription that was scheduled to cancel
 * Only works if cancel_at_period_end was true
 */
export declare function reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
export interface UpdateSubscriptionParams {
    subscriptionId: string;
    newPriceId: string;
    prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}
/**
 * Update subscription to a new plan/price
 * Stripe handles proration automatically based on prorationBehavior
 */
export declare function updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<Stripe.Subscription>;
//# sourceMappingURL=stripe.d.ts.map