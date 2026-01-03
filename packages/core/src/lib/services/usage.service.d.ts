/**
 * Usage Service
 *
 * Provides usage tracking and quota management functions.
 * Uses a hybrid 2-table approach (usage + usage_events) for O(1) checks
 * and detailed audit trail.
 *
 * @module UsageService
 */
import type { Usage, UsageEvent, UserUsageSummary, TopConsumer, TeamUsageSummary } from '../billing/types';
export interface TrackUsageParams {
    teamId: string;
    userId: string;
    limitSlug: string;
    delta: number;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
}
export interface UsageTimelineOptions {
    limitSlug?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}
export declare class UsageService {
    /**
     * Get usage record for a specific subscription, limit, and period
     *
     * @param subscriptionId - Subscription ID
     * @param limitSlug - Limit slug
     * @param periodKey - Period key (e.g., '2024-01')
     * @returns Usage record or null
     *
     * @example
     * const usage = await UsageService.get('sub-123', 'projects', '2024-01')
     */
    static get(subscriptionId: string, limitSlug: string, periodKey: string): Promise<Usage | null>;
    /**
     * Get current usage value for a subscription and limit
     *
     * @param subscriptionId - Subscription ID
     * @param limitSlug - Limit slug
     * @returns Current usage value (0 if not found)
     *
     * @example
     * const current = await UsageService.getCurrent('sub-123', 'api_calls')
     */
    static getCurrent(subscriptionId: string, limitSlug: string): Promise<number>;
    /**
     * Get all usage records for a subscription in current period
     *
     * @param subscriptionId - Subscription ID
     * @returns Array of usage records
     *
     * @example
     * const allUsage = await UsageService.getAll('sub-123')
     */
    static getAll(subscriptionId: string): Promise<Usage[]>;
    /**
     * Get current usage for a team by limit slug
     * Convenience method that doesn't require subscriptionId
     *
     * @param teamId - Team ID
     * @param limitSlug - Limit slug
     * @returns Current usage value (0 if not found)
     *
     * @example
     * const apiCalls = await UsageService.getByTeam('team-123', 'api_calls')
     */
    static getByTeam(teamId: string, limitSlug: string): Promise<number>;
    /**
     * List subscriptions near their quota threshold
     *
     * @param percentThreshold - Percentage threshold (e.g., 80 means >= 80% used)
     * @param limitSlug - Optional limit slug to check (all limits if not specified)
     * @returns Array of subscriptions with their usage info
     *
     * @example
     * const nearLimit = await UsageService.listNearQuota(80, 'api_calls')
     */
    static listNearQuota(percentThreshold?: number, limitSlug?: string): Promise<Array<{
        subscriptionId: string;
        teamId: string;
        planSlug: string;
        limitSlug: string;
        current: number;
        max: number;
        percentUsed: number;
    }>>;
    /**
     * Get usage trend over multiple periods
     *
     * @param subscriptionId - Subscription ID
     * @param limitSlug - Limit slug
     * @param periods - Number of periods to look back
     * @returns Array of usage by period
     *
     * @example
     * const trend = await UsageService.getTrend('sub-123', 'api_calls', 6)
     */
    static getTrend(subscriptionId: string, limitSlug: string, periods?: number): Promise<Array<{
        periodKey: string;
        value: number;
    }>>;
    /**
     * Track usage - Updates both usage and usage_events tables atomically
     *
     * This is the primary function for recording quota consumption.
     * It updates the aggregate usage table (for fast O(1) checks) and
     * creates a detailed event record (for reporting and audit).
     *
     * @param params - Usage tracking parameters
     * @returns Updated usage record
     *
     * @example
     * const usage = await UsageService.track({
     *   teamId: 'team-123',
     *   userId: 'user-456',
     *   limitSlug: 'api_calls',
     *   delta: 1,
     *   action: 'api.request',
     * })
     */
    static track(params: TrackUsageParams): Promise<Usage>;
    /**
     * Increment usage (convenience wrapper)
     *
     * @param subscriptionId - Subscription ID
     * @param limitSlug - Limit slug
     * @param amount - Amount to increment (default: 1)
     * @returns Updated usage record
     *
     * @example
     * const usage = await UsageService.increment('sub-123', 'api_calls')
     */
    static increment(subscriptionId: string, limitSlug: string, amount?: number): Promise<Usage>;
    /**
     * Decrement usage
     *
     * @param subscriptionId - Subscription ID
     * @param limitSlug - Limit slug
     * @param amount - Amount to decrement (default: 1)
     * @returns Updated usage record
     *
     * @example
     * await UsageService.decrement('sub-123', 'projects', 1)
     */
    static decrement(subscriptionId: string, limitSlug: string, amount?: number): Promise<Usage>;
    /**
     * Reset usage for a subscription
     *
     * @param subscriptionId - Subscription ID
     * @param limitSlug - Optional limit slug (if not provided, resets all)
     *
     * @example
     * // Reset specific limit
     * await UsageService.reset('sub-123', 'api_calls')
     *
     * // Reset all limits
     * await UsageService.reset('sub-123')
     */
    static reset(subscriptionId: string, limitSlug?: string): Promise<void>;
    /**
     * Process monthly usage reset (batch job)
     * Resets usage for all limits with monthly reset period
     *
     * @returns Number of records reset
     *
     * @example
     * const count = await UsageService.processMonthlyReset()
     */
    static processMonthlyReset(): Promise<number>;
    /**
     * Get usage breakdown by user for a team
     *
     * @param teamId - Team ID
     * @param periodKey - Period key (e.g., '2024-01')
     * @returns Array of user usage summaries
     *
     * @example
     * const byUser = await UsageService.getTeamUsageByUser('team-123', '2024-01')
     */
    static getTeamUsageByUser(teamId: string, periodKey: string): Promise<UserUsageSummary[]>;
    /**
     * Get top consumers for a specific limit
     *
     * @param teamId - Team ID
     * @param limitSlug - Limit slug
     * @param periodKey - Period key
     * @param limit - Number of top consumers (default: 5)
     * @returns Array of top consumers
     *
     * @example
     * const top = await UsageService.getTopConsumers('team-123', 'api_calls', '2024-01')
     */
    static getTopConsumers(teamId: string, limitSlug: string, periodKey: string, limit?: number): Promise<TopConsumer[]>;
    /**
     * Get user usage timeline
     *
     * @param userId - User ID
     * @param options - Query options
     * @returns Array of usage events
     *
     * @example
     * const timeline = await UsageService.getUserTimeline('user-123', {
     *   limitSlug: 'api_calls',
     *   limit: 50,
     * })
     */
    static getUserTimeline(userId: string, options?: UsageTimelineOptions): Promise<UsageEvent[]>;
    /**
     * Get comprehensive team usage summary
     *
     * @param teamId - Team ID
     * @param periodKey - Period key (default: current month)
     * @returns Complete team usage summary
     *
     * @example
     * const summary = await UsageService.getTeamSummary('team-123')
     */
    static getTeamSummary(teamId: string, periodKey?: string): Promise<TeamUsageSummary>;
}
//# sourceMappingURL=usage.service.d.ts.map