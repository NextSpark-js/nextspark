/**
 * Subscription Service
 *
 * Provides core subscription management functions including queries,
 * mutations, feature checks, and quota enforcement.
 *
 * @module SubscriptionService
 */
import type { Subscription, SubscriptionWithPlan, SubscriptionStatus, QuotaInfo, CanPerformActionResult, BillingInterval } from '../billing/types';
export interface CreateSubscriptionOptions {
    billingInterval?: BillingInterval;
    trialDays?: number;
    paymentProvider?: 'stripe' | 'paddle' | 'lemonsqueezy';
    externalSubscriptionId?: string;
    externalCustomerId?: string;
}
export interface ChangePlanResult {
    success: boolean;
    subscription?: SubscriptionWithPlan;
    downgradeWarnings?: string[];
    error?: string;
}
export declare class SubscriptionService {
    /**
     * Get subscription by ID
     *
     * @param id - Subscription ID
     * @returns Subscription or null if not found
     *
     * @example
     * const sub = await SubscriptionService.getById('sub-uuid-123')
     */
    static getById(id: string): Promise<Subscription | null>;
    /**
     * Get active subscription for a team with plan details
     *
     * @param teamId - Team ID
     * @returns Active subscription with plan or null
     *
     * @example
     * const sub = await SubscriptionService.getActive('team-uuid-123')
     * console.log(sub?.plan.name) // 'Pro Plan'
     */
    static getActive(teamId: string): Promise<SubscriptionWithPlan | null>;
    /**
     * Get subscription by team ID (alias for getActive)
     *
     * @param teamId - Team ID
     * @returns Active subscription with plan or null
     */
    static getByTeamId(teamId: string): Promise<SubscriptionWithPlan | null>;
    /**
     * Get subscription by user ID (B2C optimization)
     * Uses optional userId field to avoid JOIN
     *
     * @param userId - User ID
     * @returns Active subscription with plan or null
     *
     * @example
     * const sub = await SubscriptionService.getByUserId('user-uuid-123')
     */
    static getByUserId(userId: string): Promise<SubscriptionWithPlan | null>;
    /**
     * Create a new subscription
     *
     * @param teamId - Team ID
     * @param planId - Plan ID
     * @param options - Creation options
     * @returns Created subscription
     *
     * @example
     * const sub = await SubscriptionService.create('team-123', 'plan-456')
     */
    static create(teamId: string, planId: string, options?: CreateSubscriptionOptions): Promise<Subscription>;
    /**
     * Create default subscription (free plan) for a team
     *
     * @param teamId - Team ID
     * @returns Created subscription
     *
     * @example
     * const sub = await SubscriptionService.createDefault('team-123')
     */
    static createDefault(teamId: string): Promise<Subscription>;
    /**
     * Update subscription status
     *
     * @param subscriptionId - Subscription ID
     * @param status - New status
     * @returns Updated subscription
     *
     * @example
     * await SubscriptionService.updateStatus('sub-123', 'canceled')
     */
    static updateStatus(subscriptionId: string, status: SubscriptionStatus): Promise<Subscription>;
    /**
     * Cancel subscription
     *
     * @param subscriptionId - Subscription ID
     * @param cancelAtPeriodEnd - If true, cancel at end of current period
     *
     * @example
     * await SubscriptionService.cancel('sub-123', true)
     */
    static cancel(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<Subscription>;
    /**
     * Change subscription plan (upgrade or downgrade)
     *
     * @param teamId - Team ID
     * @param targetPlanSlug - Target plan slug
     * @param billingInterval - Billing interval
     * @returns Change result with warnings if downgrade
     *
     * @example
     * const result = await SubscriptionService.changePlan('team-123', 'pro', 'monthly')
     * if (result.downgradeWarnings) {
     *   console.log('Warnings:', result.downgradeWarnings)
     * }
     */
    static changePlan(teamId: string, targetPlanSlug: string, billingInterval?: BillingInterval): Promise<ChangePlanResult>;
    /**
     * Pause subscription
     *
     * @param subscriptionId - Subscription ID
     * @returns Updated subscription
     *
     * @example
     * await SubscriptionService.pause('sub-123')
     */
    static pause(subscriptionId: string): Promise<Subscription>;
    /**
     * Resume a paused subscription
     *
     * @param subscriptionId - Subscription ID
     * @returns Updated subscription
     *
     * @example
     * await SubscriptionService.resume('sub-123')
     */
    static resume(subscriptionId: string): Promise<Subscription>;
    /**
     * List subscriptions by status
     *
     * @param status - Subscription status to filter
     * @param options - Pagination options
     * @returns Array of subscriptions with plans
     *
     * @example
     * const activeSubscriptions = await SubscriptionService.listByStatus('active')
     * const trialingSubs = await SubscriptionService.listByStatus('trialing', { limit: 50 })
     */
    static listByStatus(status: SubscriptionStatus, options?: {
        limit?: number;
        offset?: number;
    }): Promise<SubscriptionWithPlan[]>;
    /**
     * List subscriptions expiring soon
     *
     * @param days - Number of days to look ahead
     * @returns Array of subscriptions expiring within the specified days
     *
     * @example
     * const expiringSoon = await SubscriptionService.listExpiringSoon(7)
     */
    static listExpiringSoon(days?: number): Promise<SubscriptionWithPlan[]>;
    /**
     * List subscriptions by plan
     *
     * @param planSlug - Plan slug to filter by
     * @param options - Pagination and status filter options
     * @returns Array of subscriptions on the specified plan
     *
     * @example
     * const proSubscriptions = await SubscriptionService.listByPlan('pro')
     * const activeProSubs = await SubscriptionService.listByPlan('pro', { status: 'active' })
     */
    static listByPlan(planSlug: string, options?: {
        status?: SubscriptionStatus;
        limit?: number;
        offset?: number;
    }): Promise<SubscriptionWithPlan[]>;
    /**
     * Get subscription by external (Stripe) subscription ID
     *
     * @param externalId - External subscription ID from payment provider
     * @returns Subscription with plan or null
     *
     * @example
     * const sub = await SubscriptionService.getByExternalId('sub_1234567890')
     */
    static getByExternalId(externalId: string): Promise<SubscriptionWithPlan | null>;
    /**
     * Count subscriptions by plan
     *
     * @param planSlug - Optional plan slug to filter
     * @returns Count per plan or total
     *
     * @example
     * const counts = await SubscriptionService.countByPlan()
     * // { free: 100, pro: 50, enterprise: 10 }
     */
    static countByPlan(planSlug?: string): Promise<Record<string, number> | number>;
    /**
     * Get subscription history for a team
     *
     * @param teamId - Team ID
     * @returns Array of all subscriptions (including canceled)
     *
     * @example
     * const history = await SubscriptionService.getHistory('team-123')
     */
    static getHistory(teamId: string): Promise<SubscriptionWithPlan[]>;
    /**
     * Check if team has a specific feature
     *
     * @param teamId - Team ID
     * @param featureSlug - Feature slug to check
     * @returns True if team has access to feature
     *
     * @example
     * const hasAnalytics = await SubscriptionService.hasFeature('team-123', 'advanced_analytics')
     */
    static hasFeature(teamId: string, featureSlug: string): Promise<boolean>;
    /**
     * Check quota for a specific limit
     *
     * @param teamId - Team ID
     * @param limitSlug - Limit slug to check
     * @returns Quota information including allowed status
     *
     * @example
     * const quota = await SubscriptionService.checkQuota('team-123', 'projects')
     * if (!quota.allowed) {
     *   console.log('Quota exceeded:', quota.current, '/', quota.max)
     * }
     */
    static checkQuota(teamId: string, limitSlug: string): Promise<QuotaInfo>;
    /**
     * Check if action is allowed (RBAC + feature + quota)
     *
     * The system verifies 3 levels in order:
     * 1. Permission (RBAC) - Does the role allow this action?
     * 2. Feature (Plan) - Does the plan include this feature?
     * 3. Quota (Limits) - Is there available quota?
     *
     * @param userId - User ID performing the action
     * @param teamId - Team ID context
     * @param action - Action slug to check
     * @returns Result with allowed status and reason if blocked
     *
     * @example
     * const result = await SubscriptionService.canPerformAction('user-123', 'team-456', 'projects.create')
     * if (!result.allowed) {
     *   console.log('Blocked:', result.reason)
     * }
     */
    static canPerformAction(userId: string, teamId: string, action: string): Promise<CanPerformActionResult>;
    /**
     * Process expired trials (batch job)
     * Moves trialing subscriptions to active or expired
     *
     * @returns Number of subscriptions processed
     *
     * @example
     * const count = await SubscriptionService.processExpiredTrials()
     * console.log(`Processed ${count} expired trials`)
     */
    static processExpiredTrials(): Promise<number>;
}
//# sourceMappingURL=subscription.service.d.ts.map