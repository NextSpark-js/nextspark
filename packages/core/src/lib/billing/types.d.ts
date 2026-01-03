/**
 * Billing System Types
 *
 * Core types for plans, subscriptions, usage tracking, and billing events.
 * Used throughout the billing system for type safety.
 */
export type PlanType = 'free' | 'paid' | 'enterprise';
export type PlanVisibility = 'public' | 'hidden' | 'invite_only';
export interface Plan {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    type: PlanType;
    visibility: PlanVisibility;
    priceMonthly: number | null;
    priceYearly: number | null;
    currency: string;
    trialDays: number;
    features: string[];
    limits: Record<string, number>;
    metadata: Record<string, unknown>;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'expired';
export type PaymentProvider = 'stripe' | 'paddle' | 'lemonsqueezy';
export type BillingInterval = 'monthly' | 'yearly';
export interface Subscription {
    id: string;
    teamId: string;
    userId: string | null;
    planId: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEndsAt: Date | null;
    canceledAt: Date | null;
    cancelAtPeriodEnd: boolean;
    billingInterval: BillingInterval;
    paymentProvider: PaymentProvider | null;
    externalSubscriptionId: string | null;
    externalCustomerId: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export interface SubscriptionWithPlan extends Subscription {
    plan: Plan;
}
export interface Usage {
    id: string;
    subscriptionId: string;
    limitSlug: string;
    periodKey: string;
    currentValue: number;
    lastIncrementAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface UsageEvent {
    id: string;
    subscriptionId: string;
    userId: string | null;
    teamId: string;
    limitSlug: string;
    delta: number;
    action: string | null;
    resourceType: string | null;
    resourceId: string | null;
    periodKey: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export interface BillingEvent {
    id: string;
    subscriptionId: string;
    type: 'payment' | 'refund' | 'invoice' | 'credit' | 'lifecycle';
    status: 'pending' | 'succeeded' | 'failed';
    amount: number;
    currency: string;
    externalPaymentId: string | null;
    invoiceUrl: string | null;
    receiptUrl: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export type InvoiceStatus = 'pending' | 'paid' | 'failed' | 'refunded';
/**
 * Invoice from Stripe synced to local database
 */
export interface Invoice {
    id: string;
    teamId: string;
    invoiceNumber: string;
    date: Date;
    amount: number;
    currency: string;
    status: InvoiceStatus;
    pdfUrl: string | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface QuotaInfo {
    allowed: boolean;
    current: number;
    max: number;
    remaining: number;
    percentUsed: number;
}
export interface UserUsageSummary {
    userId: string;
    userName: string;
    userEmail: string;
    limitSlug: string;
    totalUsage: number;
    percentage: number;
}
export interface TopConsumer {
    userId: string;
    userName: string;
    totalUsage: number;
    percentage: number;
}
export interface TeamUsageSummary {
    byLimit: Record<string, {
        current: number;
        limit: number;
        percentUsed: number;
    }>;
    byUser: UserUsageSummary[];
    topConsumers: TopConsumer[];
}
export interface CanPerformActionResult {
    allowed: boolean;
    reason?: 'no_permission' | 'feature_not_in_plan' | 'quota_exceeded';
    quota?: QuotaInfo;
}
//# sourceMappingURL=types.d.ts.map