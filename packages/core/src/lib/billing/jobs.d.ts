/**
 * Billing Lifecycle Jobs
 *
 * Background jobs for automatic subscription lifecycle management:
 * - Expire trials when trial period ends
 * - Handle grace period for past_due subscriptions
 * - Reset monthly usage counters
 *
 * P1: Lifecycle Management
 */
export interface JobResult {
    processed: number;
    errors: string[];
}
/**
 * Expire trials that have passed their trial end date
 * Trial -> Expired (if no payment method) or Active (if payment processed by Stripe)
 */
export declare function expireTrials(): Promise<JobResult>;
/**
 * Handle past_due subscriptions - expire after grace period (3 days)
 * GRACE_PERIOD_DAYS is hardcoded to prevent SQL injection
 */
export declare function handlePastDueGracePeriod(): Promise<JobResult>;
/**
 * Reset monthly usage counters
 * Archives previous month's usage, doesn't delete (for historical data)
 */
export declare function resetMonthlyUsage(): Promise<JobResult>;
//# sourceMappingURL=jobs.d.ts.map