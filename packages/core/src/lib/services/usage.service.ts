/**
 * Usage Service
 *
 * Provides usage tracking and quota management functions.
 * Uses a hybrid 2-table approach (usage + usage_events) for O(1) checks
 * and detailed audit trail.
 *
 * @module UsageService
 */

import { queryOneWithRLS, queryWithRLS, getTransactionClient } from '../db'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { SubscriptionService } from './subscription.service'
import { PlanService } from './plan.service'
import { getPeriodKey, calculatePercentUsed } from '../billing/helpers'
import type {
  Usage,
  UsageEvent,
  UserUsageSummary,
  TopConsumer,
  TeamUsageSummary,
} from '../billing/types'

// ===========================================
// TYPES
// ===========================================

export interface TrackUsageParams {
  teamId: string
  userId: string
  limitSlug: string
  delta: number  // Can be positive (consume) or negative (release)
  action?: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export interface UsageTimelineOptions {
  limitSlug?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

// ===========================================
// SERVICE
// ===========================================

export class UsageService {
  // ===========================================
  // QUERIES
  // ===========================================

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
  static async get(
    subscriptionId: string,
    limitSlug: string,
    periodKey: string
  ): Promise<Usage | null> {
    if (!subscriptionId || !limitSlug || !periodKey) {
      return null
    }

    return queryOneWithRLS<Usage>(
      `
      SELECT * FROM "usage"
      WHERE "subscriptionId" = $1
        AND "limitSlug" = $2
        AND "periodKey" = $3
      `,
      [subscriptionId, limitSlug, periodKey]
    )
  }

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
  static async getCurrent(subscriptionId: string, limitSlug: string): Promise<number> {
    if (!subscriptionId || !limitSlug) {
      return 0
    }

    // Get limit config to determine period
    const limitConfig = BILLING_REGISTRY.limits[limitSlug]
    const periodKey = limitConfig ? getPeriodKey(limitConfig.resetPeriod) : 'all_time'

    const usage = await this.get(subscriptionId, limitSlug, periodKey)
    return usage?.currentValue ?? 0
  }

  /**
   * Get all usage records for a subscription in current period
   *
   * @param subscriptionId - Subscription ID
   * @returns Array of usage records
   *
   * @example
   * const allUsage = await UsageService.getAll('sub-123')
   */
  static async getAll(subscriptionId: string): Promise<Usage[]> {
    if (!subscriptionId) {
      return []
    }

    return queryWithRLS<Usage>(
      `
      SELECT * FROM "usage"
      WHERE "subscriptionId" = $1
      ORDER BY "limitSlug" ASC
      `,
      [subscriptionId]
    )
  }

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
  static async getByTeam(teamId: string, limitSlug: string): Promise<number> {
    if (!teamId || !limitSlug) {
      return 0
    }

    const subscription = await SubscriptionService.getActive(teamId)
    if (!subscription) {
      return 0
    }

    return this.getCurrent(subscription.id, limitSlug)
  }

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
  static async listNearQuota(
    percentThreshold: number = 80,
    limitSlug?: string
  ): Promise<Array<{
    subscriptionId: string
    teamId: string
    planSlug: string
    limitSlug: string
    current: number
    max: number
    percentUsed: number
  }>> {
    if (percentThreshold < 0 || percentThreshold > 100) {
      throw new Error('Threshold must be between 0 and 100')
    }

    // Get all active subscriptions with their usage
    let query = `
      SELECT
        s.id as "subscriptionId",
        s."teamId",
        p.slug as "planSlug",
        u."limitSlug",
        u."currentValue" as current
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      JOIN "usage" u ON u."subscriptionId" = s.id
      WHERE s.status IN ('active', 'trialing')
    `
    const params: unknown[] = []

    if (limitSlug) {
      query += ` AND u."limitSlug" = $1`
      params.push(limitSlug)
    }

    const results = await queryWithRLS<{
      subscriptionId: string
      teamId: string
      planSlug: string
      limitSlug: string
      current: number
    }>(query, params)

    // Filter by threshold and calculate percentages
    const nearQuota: Array<{
      subscriptionId: string
      teamId: string
      planSlug: string
      limitSlug: string
      current: number
      max: number
      percentUsed: number
    }> = []

    for (const row of results) {
      const max = PlanService.getLimit(row.planSlug, row.limitSlug)

      // Skip unlimited (-1) or zero limits
      if (max <= 0) continue

      const percentUsed = calculatePercentUsed(row.current, max)

      if (percentUsed >= percentThreshold) {
        nearQuota.push({
          ...row,
          max,
          percentUsed,
        })
      }
    }

    // Sort by percentage used (highest first)
    return nearQuota.sort((a, b) => b.percentUsed - a.percentUsed)
  }

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
  static async getTrend(
    subscriptionId: string,
    limitSlug: string,
    periods: number = 6
  ): Promise<Array<{ periodKey: string; value: number }>> {
    if (!subscriptionId || !limitSlug) {
      return []
    }

    if (periods < 1 || periods > 24) {
      throw new Error('Periods must be between 1 and 24')
    }

    const results = await queryWithRLS<{ periodKey: string; currentValue: number }>(
      `
      SELECT "periodKey", "currentValue"
      FROM "usage"
      WHERE "subscriptionId" = $1 AND "limitSlug" = $2
      ORDER BY "periodKey" DESC
      LIMIT $3
      `,
      [subscriptionId, limitSlug, periods]
    )

    return results.map(r => ({
      periodKey: r.periodKey,
      value: r.currentValue,
    }))
  }

  // ===========================================
  // MUTATIONS
  // ===========================================

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
  static async track(params: TrackUsageParams): Promise<Usage> {
    const {
      teamId,
      userId,
      limitSlug,
      delta,
      action,
      resourceType,
      resourceId,
      metadata = {},
    } = params

    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    if (!limitSlug || limitSlug.trim() === '') {
      throw new Error('Limit slug is required')
    }

    // Get active subscription
    const subscription = await SubscriptionService.getActive(teamId)
    if (!subscription) {
      throw new Error(`No active subscription found for team ${teamId}`)
    }

    // Get period key from limit config
    const limitConfig = BILLING_REGISTRY.limits[limitSlug]
    const periodKey = limitConfig ? getPeriodKey(limitConfig.resetPeriod) : 'all_time'

    // Use transaction to update both tables atomically
    const tx = await getTransactionClient()

    try {
      // 1. Insert usage event (detailed record)
      await tx.query(
        `
        INSERT INTO "usage_events" (
          "subscriptionId",
          "userId",
          "teamId",
          "limitSlug",
          delta,
          action,
          "resourceType",
          "resourceId",
          "periodKey",
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          subscription.id,
          userId,
          teamId,
          limitSlug,
          delta,
          action,
          resourceType,
          resourceId,
          periodKey,
          JSON.stringify(metadata),
        ]
      )

      // 2. Update or insert usage aggregate
      const usage = await tx.queryOne<Usage>(
        `
        INSERT INTO "usage" (
          "subscriptionId",
          "limitSlug",
          "periodKey",
          "currentValue",
          "lastIncrementAt"
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT ("subscriptionId", "limitSlug", "periodKey")
        DO UPDATE SET
          "currentValue" = "usage"."currentValue" + $4,
          "lastIncrementAt" = NOW()
        RETURNING *
        `,
        [subscription.id, limitSlug, periodKey, delta]
      )

      await tx.commit()

      if (!usage) {
        throw new Error('Failed to track usage')
      }

      return usage
    } catch (error) {
      await tx.rollback()
      throw error
    }
  }

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
  static async increment(
    subscriptionId: string,
    limitSlug: string,
    amount: number = 1
  ): Promise<Usage> {
    if (!subscriptionId || !limitSlug) {
      throw new Error('Subscription ID and limit slug are required')
    }

    // Get limit config to determine period
    const limitConfig = BILLING_REGISTRY.limits[limitSlug]
    const periodKey = limitConfig ? getPeriodKey(limitConfig.resetPeriod) : 'all_time'

    const result = await queryOneWithRLS<Usage>(
      `
      INSERT INTO "usage" (
        "subscriptionId",
        "limitSlug",
        "periodKey",
        "currentValue",
        "lastIncrementAt"
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT ("subscriptionId", "limitSlug", "periodKey")
      DO UPDATE SET
        "currentValue" = "usage"."currentValue" + $4,
        "lastIncrementAt" = NOW()
      RETURNING *
      `,
      [subscriptionId, limitSlug, periodKey, amount]
    )

    if (!result) {
      throw new Error('Failed to increment usage')
    }

    return result
  }

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
  static async decrement(
    subscriptionId: string,
    limitSlug: string,
    amount: number = 1
  ): Promise<Usage> {
    return this.increment(subscriptionId, limitSlug, -amount)
  }

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
  static async reset(subscriptionId: string, limitSlug?: string): Promise<void> {
    if (!subscriptionId || subscriptionId.trim() === '') {
      throw new Error('Subscription ID is required')
    }

    if (limitSlug) {
      await queryWithRLS(
        `
        UPDATE "usage"
        SET "currentValue" = 0, "lastIncrementAt" = NOW()
        WHERE "subscriptionId" = $1 AND "limitSlug" = $2
        `,
        [subscriptionId, limitSlug]
      )
    } else {
      await queryWithRLS(
        `
        UPDATE "usage"
        SET "currentValue" = 0, "lastIncrementAt" = NOW()
        WHERE "subscriptionId" = $1
        `,
        [subscriptionId]
      )
    }
  }

  // ===========================================
  // BATCH OPERATIONS
  // ===========================================

  /**
   * Process monthly usage reset (batch job)
   * Resets usage for all limits with monthly reset period
   *
   * @returns Number of records reset
   *
   * @example
   * const count = await UsageService.processMonthlyReset()
   */
  static async processMonthlyReset(): Promise<number> {
    // Get all monthly limits
    const monthlyLimits = Object.entries(BILLING_REGISTRY.limits)
      .filter(([_, config]) => config.resetPeriod === 'monthly')
      .map(([slug]) => slug)

    if (monthlyLimits.length === 0) {
      return 0
    }

    // Create placeholders for limit slugs
    const placeholders = monthlyLimits.map((_, i) => `$${i + 1}`).join(', ')

    const result = await queryWithRLS<{ count: number }>(
      `
      WITH deleted AS (
        DELETE FROM "usage"
        WHERE "limitSlug" IN (${placeholders})
          AND "periodKey" != $${monthlyLimits.length + 1}
        RETURNING 1
      )
      SELECT COUNT(*)::int as count FROM deleted
      `,
      [...monthlyLimits, getPeriodKey('monthly')]
    )

    return result[0]?.count ?? 0
  }

  // ===========================================
  // REPORTING
  // ===========================================

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
  static async getTeamUsageByUser(
    teamId: string,
    periodKey: string
  ): Promise<UserUsageSummary[]> {
    if (!teamId || !periodKey) {
      return []
    }

    const subscription = await SubscriptionService.getActive(teamId)
    if (!subscription) return []

    const results = await queryWithRLS<{
      userId: string
      userName: string
      userEmail: string
      limitSlug: string
      totalUsage: number
    }>(
      `
      SELECT
        ue."userId",
        u.name as "userName",
        u.email as "userEmail",
        ue."limitSlug",
        SUM(ue.delta)::int as "totalUsage"
      FROM "usage_events" ue
      LEFT JOIN "users" u ON u.id = ue."userId"
      WHERE ue."subscriptionId" = $1
        AND ue."periodKey" = $2
      GROUP BY ue."userId", u.name, u.email, ue."limitSlug"
      ORDER BY "totalUsage" DESC
      `,
      [subscription.id, periodKey]
    )

    // Calculate percentages
    const limitTotals: Record<string, number> = {}
    results.forEach((r) => {
      limitTotals[r.limitSlug] = (limitTotals[r.limitSlug] || 0) + r.totalUsage
    })

    return results.map((r) => ({
      ...r,
      percentage: limitTotals[r.limitSlug] > 0
        ? Math.round((r.totalUsage / limitTotals[r.limitSlug]) * 100)
        : 0,
    }))
  }

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
  static async getTopConsumers(
    teamId: string,
    limitSlug: string,
    periodKey: string,
    limit: number = 5
  ): Promise<TopConsumer[]> {
    if (!teamId || !limitSlug || !periodKey) {
      return []
    }

    const subscription = await SubscriptionService.getActive(teamId)
    if (!subscription) return []

    const results = await queryWithRLS<{
      userId: string
      userName: string
      totalUsage: number
    }>(
      `
      SELECT
        ue."userId",
        u.name as "userName",
        SUM(ue.delta)::int as "totalUsage"
      FROM "usage_events" ue
      LEFT JOIN "users" u ON u.id = ue."userId"
      WHERE ue."subscriptionId" = $1
        AND ue."limitSlug" = $2
        AND ue."periodKey" = $3
      GROUP BY ue."userId", u.name
      ORDER BY "totalUsage" DESC
      LIMIT $4
      `,
      [subscription.id, limitSlug, periodKey, limit]
    )

    // Calculate total for percentages
    const total = results.reduce((sum, r) => sum + r.totalUsage, 0)

    return results.map((r) => ({
      ...r,
      percentage: total > 0 ? Math.round((r.totalUsage / total) * 100) : 0,
    }))
  }

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
  static async getUserTimeline(
    userId: string,
    options: UsageTimelineOptions = {}
  ): Promise<UsageEvent[]> {
    if (!userId || userId.trim() === '') {
      return []
    }

    const {
      limitSlug,
      startDate,
      endDate,
      limit = 100,
    } = options

    const params: unknown[] = [userId]
    let paramIndex = 2

    let query = `
      SELECT * FROM "usage_events"
      WHERE "userId" = $1
    `

    if (limitSlug) {
      query += ` AND "limitSlug" = $${paramIndex}`
      params.push(limitSlug)
      paramIndex++
    }

    if (startDate) {
      query += ` AND "createdAt" >= $${paramIndex}`
      params.push(startDate.toISOString())
      paramIndex++
    }

    if (endDate) {
      query += ` AND "createdAt" <= $${paramIndex}`
      params.push(endDate.toISOString())
      paramIndex++
    }

    query += `
      ORDER BY "createdAt" DESC
      LIMIT $${paramIndex}
    `
    params.push(limit)

    return queryWithRLS<UsageEvent>(query, params)
  }

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
  static async getTeamSummary(
    teamId: string,
    periodKey?: string
  ): Promise<TeamUsageSummary> {
    if (!teamId) {
      return { byLimit: {}, byUser: [], topConsumers: [] }
    }

    const subscription = await SubscriptionService.getActive(teamId)

    if (!subscription) {
      return { byLimit: {}, byUser: [], topConsumers: [] }
    }

    // Use current month if not specified
    const effectivePeriodKey = periodKey || getPeriodKey('monthly')

    // Get all usage for this subscription
    const usageRows = await queryWithRLS<Usage>(
      `
      SELECT * FROM "usage"
      WHERE "subscriptionId" = $1
        AND "periodKey" = $2
      `,
      [subscription.id, effectivePeriodKey]
    )

    // Build byLimit object
    const byLimit: TeamUsageSummary['byLimit'] = {}

    // Get plan config from registry
    const planConfig = BILLING_REGISTRY.plans.find(
      (p) => p.slug === subscription.plan.slug
    )

    for (const row of usageRows) {
      const limit = planConfig?.limits[row.limitSlug] ?? 0
      byLimit[row.limitSlug] = {
        current: row.currentValue,
        limit,
        percentUsed: calculatePercentUsed(row.currentValue, limit),
      }
    }

    // Get usage by user
    const byUser = await this.getTeamUsageByUser(teamId, effectivePeriodKey)

    // Get top consumers (using first limit with usage, or api_calls as default)
    const primaryLimit = Object.keys(byLimit)[0] || 'api_calls'
    const topConsumers = await this.getTopConsumers(teamId, primaryLimit, effectivePeriodKey, 5)

    return { byLimit, byUser, topConsumers }
  }
}
