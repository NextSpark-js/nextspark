/**
 * Subscription Service
 *
 * Provides core subscription management functions including queries,
 * mutations, feature checks, and quota enforcement.
 *
 * @module SubscriptionService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '../db'
import { doAction } from '../plugins/hook-system'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { PlanService } from './plan.service'
import {
  getPeriodKey,
  calculatePercentUsed,
  isSubscriptionActive,
  hasFeature as checkFeatureInList,
} from '../billing/helpers'
import { updateSubscriptionPlan } from '../billing/gateways/stripe'
// Note: checkDowngrade is imported dynamically in changePlan() to avoid circular dependency
import type {
  Plan,
  Subscription,
  SubscriptionWithPlan,
  SubscriptionStatus,
  QuotaInfo,
  Usage,
  CanPerformActionResult,
  BillingInterval,
} from '../billing/types'

// ===========================================
// TYPES
// ===========================================

export interface CreateSubscriptionOptions {
  billingInterval?: BillingInterval
  trialDays?: number
  paymentProvider?: 'stripe' | 'paddle' | 'lemonsqueezy'
  externalSubscriptionId?: string
  externalCustomerId?: string
}

export interface ChangePlanResult {
  success: boolean
  subscription?: SubscriptionWithPlan
  downgradeWarnings?: string[]
  error?: string
}

// ===========================================
// SERVICE
// ===========================================

export class SubscriptionService {
  // ===========================================
  // QUERIES
  // ===========================================

  /**
   * Get subscription by ID
   *
   * @param id - Subscription ID
   * @returns Subscription or null if not found
   *
   * @example
   * const sub = await SubscriptionService.getById('sub-uuid-123')
   */
  static async getById(id: string): Promise<Subscription | null> {
    if (!id || id.trim() === '') {
      throw new Error('Subscription ID is required')
    }

    return queryOneWithRLS<Subscription>(
      'SELECT * FROM "subscriptions" WHERE id = $1',
      [id]
    )
  }

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
  static async getActive(teamId: string): Promise<SubscriptionWithPlan | null> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    const result = await queryOneWithRLS<Subscription & { plan: Plan }>(
      `
      SELECT
        s.*,
        row_to_json(p.*) as plan
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE s."teamId" = $1
        AND s.status IN ('active', 'trialing', 'past_due')
      ORDER BY s."createdAt" DESC
      LIMIT 1
      `,
      [teamId]
    )

    if (!result) return null

    return {
      ...result,
      plan: result.plan,
    } as SubscriptionWithPlan
  }

  /**
   * Get subscription by team ID (alias for getActive)
   *
   * @param teamId - Team ID
   * @returns Active subscription with plan or null
   */
  static async getByTeamId(teamId: string): Promise<SubscriptionWithPlan | null> {
    return this.getActive(teamId)
  }

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
  static async getByUserId(userId: string): Promise<SubscriptionWithPlan | null> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    const result = await queryOneWithRLS<Subscription & { plan: Plan }>(
      `
      SELECT
        s.*,
        row_to_json(p.*) as plan
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE s."userId" = $1
        AND s.status IN ('active', 'trialing', 'past_due')
      ORDER BY s."createdAt" DESC
      LIMIT 1
      `,
      [userId]
    )

    if (!result) return null

    return {
      ...result,
      plan: result.plan,
    } as SubscriptionWithPlan
  }

  // ===========================================
  // MUTATIONS
  // ===========================================

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
  static async create(
    teamId: string,
    planId: string,
    options: CreateSubscriptionOptions = {}
  ): Promise<Subscription> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!planId || planId.trim() === '') {
      throw new Error('Plan ID is required')
    }

    const {
      billingInterval = 'monthly',
      trialDays = 0,
      paymentProvider = null,
      externalSubscriptionId = null,
      externalCustomerId = null,
    } = options

    // Calculate period end based on billing interval
    const periodInterval = billingInterval === 'yearly' ? '1 year' : '1 month'

    // Calculate trial end if applicable
    const trialEndsSql = trialDays > 0
      ? `NOW() + INTERVAL '${trialDays} days'`
      : 'NULL'

    const status = trialDays > 0 ? 'trialing' : 'active'

    const result = await mutateWithRLS<Subscription>(
      `
      INSERT INTO "subscriptions" (
        "teamId",
        "planId",
        status,
        "currentPeriodStart",
        "currentPeriodEnd",
        "trialEndsAt",
        "billingInterval",
        "paymentProvider",
        "externalSubscriptionId",
        "externalCustomerId"
      ) VALUES (
        $1,
        $2,
        $3,
        NOW(),
        NOW() + INTERVAL '${periodInterval}',
        ${trialEndsSql},
        $4,
        $5,
        $6,
        $7
      )
      RETURNING *
      `,
      [
        teamId,
        planId,
        status,
        billingInterval,
        paymentProvider,
        externalSubscriptionId,
        externalCustomerId,
      ]
    )

    if (!result.rows[0]) {
      throw new Error('Failed to create subscription')
    }

    // Emit subscription created hook for webhooks/integrations
    await doAction('subscription.created', {
      id: result.rows[0].id,
      data: result.rows[0],
      teamId,
    })

    return result.rows[0]
  }

  /**
   * Create default subscription (free plan) for a team
   *
   * @param teamId - Team ID
   * @returns Created subscription
   *
   * @example
   * const sub = await SubscriptionService.createDefault('team-123')
   */
  static async createDefault(teamId: string): Promise<Subscription> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    const defaultPlan = await PlanService.getDefault()
    if (!defaultPlan) {
      throw new Error('Default plan not found')
    }

    return this.create(teamId, defaultPlan.id, {
      billingInterval: 'monthly',
    })
  }

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
  static async updateStatus(
    subscriptionId: string,
    status: SubscriptionStatus
  ): Promise<Subscription> {
    if (!subscriptionId || subscriptionId.trim() === '') {
      throw new Error('Subscription ID is required')
    }

    const validStatuses: SubscriptionStatus[] = [
      'trialing', 'active', 'past_due', 'canceled', 'paused', 'expired'
    ]

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`)
    }

    // Get current status for hook
    const current = await this.getById(subscriptionId)
    const previousStatus = current?.status

    const result = await mutateWithRLS<Subscription>(
      `
      UPDATE "subscriptions"
      SET status = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, subscriptionId]
    )

    if (!result.rows[0]) {
      throw new Error('Subscription not found')
    }

    // Emit subscription updated hook
    await doAction('subscription.updated', {
      id: subscriptionId,
      data: result.rows[0],
      previousStatus,
      newStatus: status,
    })

    return result.rows[0]
  }

  /**
   * Cancel subscription
   *
   * @param subscriptionId - Subscription ID
   * @param cancelAtPeriodEnd - If true, cancel at end of current period
   *
   * @example
   * await SubscriptionService.cancel('sub-123', true)
   */
  static async cancel(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Subscription> {
    if (!subscriptionId || subscriptionId.trim() === '') {
      throw new Error('Subscription ID is required')
    }

    if (cancelAtPeriodEnd) {
      const result = await mutateWithRLS<Subscription>(
        `
        UPDATE "subscriptions"
        SET "cancelAtPeriodEnd" = true, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [subscriptionId]
      )

      if (!result.rows[0]) {
        throw new Error('Subscription not found')
      }

      // Emit hook for scheduled cancellation
      await doAction('subscription.cancelled', {
        id: subscriptionId,
        data: result.rows[0],
        immediate: false,
        cancelAtPeriodEnd: true,
      })

      return result.rows[0]
    }

    // Immediate cancellation
    const result = await mutateWithRLS<Subscription>(
      `
      UPDATE "subscriptions"
      SET
        status = 'canceled',
        "canceledAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [subscriptionId]
    )

    if (!result.rows[0]) {
      throw new Error('Subscription not found')
    }

    // Emit hook for immediate cancellation
    await doAction('subscription.cancelled', {
      id: subscriptionId,
      data: result.rows[0],
      immediate: true,
      cancelAtPeriodEnd: false,
    })

    return result.rows[0]
  }

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
  static async changePlan(
    teamId: string,
    targetPlanSlug: string,
    billingInterval: BillingInterval = 'monthly'
  ): Promise<ChangePlanResult> {
    if (!teamId || teamId.trim() === '') {
      return { success: false, error: 'Team ID is required' }
    }

    if (!targetPlanSlug || targetPlanSlug.trim() === '') {
      return { success: false, error: 'Target plan slug is required' }
    }

    // 1. Get current subscription
    const currentSub = await this.getActive(teamId)
    if (!currentSub?.externalSubscriptionId) {
      return { success: false, error: 'No active subscription found' }
    }

    // 2. Get target plan config from registry
    const targetPlanConfig = PlanService.getConfig(targetPlanSlug)
    if (!targetPlanConfig) {
      return { success: false, error: `Plan ${targetPlanSlug} not found` }
    }

    // 3. Get Stripe price ID
    const newPriceId = PlanService.getStripePriceId(targetPlanSlug, billingInterval)
    if (!newPriceId) {
      return { success: false, error: `No Stripe price for ${targetPlanSlug} ${billingInterval}` }
    }

    // 4. Check for downgrade warnings
    let downgradeWarnings: string[] = []
    const isDowngrade = !PlanService.isUpgrade(currentSub.plan.slug, targetPlanSlug)

    if (isDowngrade) {
      // Dynamic import to avoid circular dependency: subscription.service -> enforcement -> subscription.service
      const { checkDowngrade } = await import('../billing/enforcement')
      const downgradeCheck = await checkDowngrade(teamId, targetPlanSlug)
      downgradeWarnings = downgradeCheck.warnings
    }

    // 5. Update via Stripe
    try {
      await updateSubscriptionPlan({
        subscriptionId: currentSub.externalSubscriptionId,
        newPriceId,
        prorationBehavior: 'create_prorations',
      })

      // 6. Get local plan ID from DB
      const targetPlan = await PlanService.getBySlug(targetPlanSlug)
      if (!targetPlan) {
        return { success: false, error: 'Plan not found in database' }
      }

      // 7. Update local subscription
      await queryWithRLS(
        `
        UPDATE "subscriptions"
        SET
          "planId" = $1,
          "billingInterval" = $2,
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{previousPlanSlug}',
            $3::jsonb
          ),
          "updatedAt" = NOW()
        WHERE "teamId" = $4 AND status IN ('active', 'trialing')
        `,
        [targetPlan.id, billingInterval, JSON.stringify(currentSub.plan.slug), teamId]
      )

      // 8. Log billing event
      await queryWithRLS(
        `
        INSERT INTO "billing_events" (id, "subscriptionId", type, status, metadata, "createdAt")
        VALUES ($1, $2, 'lifecycle', 'succeeded', $3, NOW())
        `,
        [
          crypto.randomUUID(),
          currentSub.id,
          JSON.stringify({
            action: 'plan_change',
            fromPlan: currentSub.plan.slug,
            toPlan: targetPlanSlug,
            billingInterval,
          }),
        ]
      )

      // 9. Get updated subscription
      const updatedSub = await this.getActive(teamId)

      // 10. Emit subscription updated hook for plan change
      await doAction('subscription.updated', {
        id: currentSub.id,
        data: updatedSub,
        previousPlan: currentSub.plan.slug,
        newPlan: targetPlanSlug,
        isUpgrade: !isDowngrade,
        teamId,
      })

      return {
        success: true,
        subscription: updatedSub || undefined,
        downgradeWarnings: downgradeWarnings.length > 0 ? downgradeWarnings : undefined,
      }
    } catch (error) {
      console.error('[SubscriptionService.changePlan] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change plan',
      }
    }
  }

  /**
   * Pause subscription
   *
   * @param subscriptionId - Subscription ID
   * @returns Updated subscription
   *
   * @example
   * await SubscriptionService.pause('sub-123')
   */
  static async pause(subscriptionId: string): Promise<Subscription> {
    if (!subscriptionId || subscriptionId.trim() === '') {
      throw new Error('Subscription ID is required')
    }

    // Verify subscription is active
    const current = await this.getById(subscriptionId)
    if (!current || current.status !== 'active') {
      throw new Error('Can only pause active subscriptions')
    }

    return this.updateStatus(subscriptionId, 'paused')
  }

  /**
   * Resume a paused subscription
   *
   * @param subscriptionId - Subscription ID
   * @returns Updated subscription
   *
   * @example
   * await SubscriptionService.resume('sub-123')
   */
  static async resume(subscriptionId: string): Promise<Subscription> {
    if (!subscriptionId || subscriptionId.trim() === '') {
      throw new Error('Subscription ID is required')
    }

    // Verify subscription is paused
    const current = await this.getById(subscriptionId)
    if (!current || current.status !== 'paused') {
      throw new Error('Can only resume paused subscriptions')
    }

    return this.updateStatus(subscriptionId, 'active')
  }

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
  static async listByStatus(
    status: SubscriptionStatus,
    options: { limit?: number; offset?: number } = {}
  ): Promise<SubscriptionWithPlan[]> {
    const { limit = 100, offset = 0 } = options

    const results = await queryWithRLS<Subscription & { plan: Plan }>(
      `
      SELECT
        s.*,
        row_to_json(p.*) as plan
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE s.status = $1
      ORDER BY s."createdAt" DESC
      LIMIT $2 OFFSET $3
      `,
      [status, limit, offset]
    )

    return results.map(r => ({ ...r, plan: r.plan })) as SubscriptionWithPlan[]
  }

  /**
   * List subscriptions expiring soon
   *
   * @param days - Number of days to look ahead
   * @returns Array of subscriptions expiring within the specified days
   *
   * @example
   * const expiringSoon = await SubscriptionService.listExpiringSoon(7)
   */
  static async listExpiringSoon(days: number = 7): Promise<SubscriptionWithPlan[]> {
    if (days < 1) {
      throw new Error('Days must be at least 1')
    }

    const results = await queryWithRLS<Subscription & { plan: Plan }>(
      `
      SELECT
        s.*,
        row_to_json(p.*) as plan
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE s.status IN ('active', 'trialing')
        AND s."currentPeriodEnd" <= NOW() + INTERVAL '${days} days'
        AND s."currentPeriodEnd" > NOW()
      ORDER BY s."currentPeriodEnd" ASC
      `
    )

    return results.map(r => ({ ...r, plan: r.plan })) as SubscriptionWithPlan[]
  }

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
  static async listByPlan(
    planSlug: string,
    options: { status?: SubscriptionStatus; limit?: number; offset?: number } = {}
  ): Promise<SubscriptionWithPlan[]> {
    if (!planSlug || planSlug.trim() === '') {
      throw new Error('Plan slug is required')
    }

    const { status, limit = 100, offset = 0 } = options

    let query = `
      SELECT
        s.*,
        row_to_json(p.*) as plan
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE p.slug = $1
    `
    const params: unknown[] = [planSlug]

    if (status) {
      query += ` AND s.status = $2`
      params.push(status)
    }

    query += ` ORDER BY s."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const results = await queryWithRLS<Subscription & { plan: Plan }>(query, params)

    return results.map(r => ({ ...r, plan: r.plan })) as SubscriptionWithPlan[]
  }

  /**
   * Get subscription by external (Stripe) subscription ID
   *
   * @param externalId - External subscription ID from payment provider
   * @returns Subscription with plan or null
   *
   * @example
   * const sub = await SubscriptionService.getByExternalId('sub_1234567890')
   */
  static async getByExternalId(externalId: string): Promise<SubscriptionWithPlan | null> {
    if (!externalId || externalId.trim() === '') {
      return null
    }

    const result = await queryOneWithRLS<Subscription & { plan: Plan }>(
      `
      SELECT
        s.*,
        row_to_json(p.*) as plan
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE s."externalSubscriptionId" = $1
      `,
      [externalId]
    )

    if (!result) return null

    return { ...result, plan: result.plan } as SubscriptionWithPlan
  }

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
  static async countByPlan(planSlug?: string): Promise<Record<string, number> | number> {
    if (planSlug) {
      const result = await queryOneWithRLS<{ count: string }>(
        `
        SELECT COUNT(*) as count
        FROM "subscriptions" s
        JOIN "plans" p ON s."planId" = p.id
        WHERE p.slug = $1 AND s.status IN ('active', 'trialing')
        `,
        [planSlug]
      )
      return parseInt(result?.count ?? '0', 10)
    }

    const results = await queryWithRLS<{ slug: string; count: string }>(
      `
      SELECT p.slug, COUNT(*) as count
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE s.status IN ('active', 'trialing')
      GROUP BY p.slug
      `
    )

    const counts: Record<string, number> = {}
    for (const row of results) {
      counts[row.slug] = parseInt(row.count, 10)
    }
    return counts
  }

  /**
   * Get subscription history for a team
   *
   * @param teamId - Team ID
   * @returns Array of all subscriptions (including canceled)
   *
   * @example
   * const history = await SubscriptionService.getHistory('team-123')
   */
  static async getHistory(teamId: string): Promise<SubscriptionWithPlan[]> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    const results = await queryWithRLS<Subscription & { plan: Plan }>(
      `
      SELECT
        s.*,
        row_to_json(p.*) as plan
      FROM "subscriptions" s
      JOIN "plans" p ON s."planId" = p.id
      WHERE s."teamId" = $1
      ORDER BY s."createdAt" DESC
      `,
      [teamId]
    )

    return results.map(r => ({
      ...r,
      plan: r.plan,
    })) as SubscriptionWithPlan[]
  }

  // ===========================================
  // FEATURE & QUOTA CHECKS
  // ===========================================

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
  static async hasFeature(teamId: string, featureSlug: string): Promise<boolean> {
    if (!teamId || !featureSlug) {
      return false
    }

    const subscription = await this.getActive(teamId)
    if (!subscription || !isSubscriptionActive(subscription.status)) {
      return false
    }

    // Get plan config from registry
    const planConfig = PlanService.getConfig(subscription.plan.slug)
    if (!planConfig) return false

    return checkFeatureInList(planConfig.features, featureSlug)
  }

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
  static async checkQuota(teamId: string, limitSlug: string): Promise<QuotaInfo> {
    if (!teamId || !limitSlug) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        remaining: 0,
        percentUsed: 0,
      }
    }

    const subscription = await this.getActive(teamId)

    if (!subscription || !isSubscriptionActive(subscription.status)) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        remaining: 0,
        percentUsed: 0,
      }
    }

    // Get limit config from registry
    const limitConfig = BILLING_REGISTRY.limits[limitSlug]
    if (!limitConfig) {
      // Unknown limit = allow
      return {
        allowed: true,
        current: 0,
        max: -1,
        remaining: Infinity,
        percentUsed: 0,
      }
    }

    // Get plan limit value
    const max = PlanService.getLimit(subscription.plan.slug, limitSlug)

    // Unlimited
    if (max === -1) {
      return {
        allowed: true,
        current: 0,
        max: -1,
        remaining: Infinity,
        percentUsed: 0,
      }
    }

    // Get current usage
    const periodKey = getPeriodKey(limitConfig.resetPeriod)
    const usage = await queryOneWithRLS<Usage>(
      `
      SELECT * FROM "usage"
      WHERE "subscriptionId" = $1
        AND "limitSlug" = $2
        AND "periodKey" = $3
      `,
      [subscription.id, limitSlug, periodKey]
    )

    const current = usage?.currentValue ?? 0
    const remaining = max - current
    const percentUsed = calculatePercentUsed(current, max)

    return {
      allowed: current < max,
      current,
      max,
      remaining: Math.max(0, remaining),
      percentUsed,
    }
  }

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
  static async canPerformAction(
    userId: string,
    teamId: string,
    action: string
  ): Promise<CanPerformActionResult> {
    if (!userId || !teamId || !action) {
      return { allowed: false, reason: 'no_permission' }
    }

    // 0. ADMIN BYPASS - Superadmin and Developer bypass all billing restrictions
    const user = await queryOneWithRLS<{ role: string }>(
      'SELECT role FROM "users" WHERE id = $1',
      [userId]
    )

    if (user?.role === 'superadmin' || user?.role === 'developer') {
      return { allowed: true }
    }

    // 1. RBAC Check - Verify role permission (for regular users)
    const teamMember = await queryOneWithRLS<{ role: string; userRole: string }>(
      `
      SELECT tm.role, u.role as "userRole"
      FROM "team_members" tm
      JOIN "users" u ON u.id = tm."userId"
      WHERE tm."teamId" = $1 AND tm."userId" = $2
      `,
      [teamId, userId]
    )

    if (!teamMember) {
      return { allowed: false, reason: 'no_permission' }
    }

    // Verify RBAC permission if mapping is defined
    const requiredPermission = BILLING_REGISTRY.actionMappings.permissions?.[action]
    if (requiredPermission) {
      try {
        const { checkTeamPermission } = await import('../teams/permissions')
        const hasPermission = checkTeamPermission(
          teamMember.userRole as any,
          teamMember.role as any,
          requiredPermission as any
        )
        if (!hasPermission) {
          return { allowed: false, reason: 'no_permission' }
        }
      } catch {
        // Permissions module not available, skip RBAC check
        console.warn('[SubscriptionService] Team permissions module not available')
      }
    }

    // 2. Feature Check - Verify plan feature
    const requiredFeature = BILLING_REGISTRY.actionMappings.features[action]
    if (requiredFeature) {
      const hasFeatureAccess = await this.hasFeature(teamId, requiredFeature)
      if (!hasFeatureAccess) {
        return { allowed: false, reason: 'feature_not_in_plan' }
      }
    }

    // 3. Quota Check - Verify available limit
    const consumedLimit = BILLING_REGISTRY.actionMappings.limits[action]
    if (consumedLimit) {
      const quota = await this.checkQuota(teamId, consumedLimit)
      if (!quota.allowed) {
        return { allowed: false, reason: 'quota_exceeded', quota }
      }
      return { allowed: true, quota }
    }

    return { allowed: true }
  }

  // ===========================================
  // LIFECYCLE
  // ===========================================

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
  static async processExpiredTrials(): Promise<number> {
    // Get all expired trials
    const expiredTrials = await queryWithRLS<{ id: string; planId: string }>(
      `
      SELECT id, "planId" FROM "subscriptions"
      WHERE status = 'trialing'
        AND "trialEndsAt" < NOW()
      `
    )

    if (expiredTrials.length === 0) {
      return 0
    }

    // Update to active (assuming they have valid payment) or expired
    await queryWithRLS(
      `
      UPDATE "subscriptions"
      SET
        status = CASE
          WHEN "externalSubscriptionId" IS NOT NULL THEN 'active'
          ELSE 'expired'
        END,
        "updatedAt" = NOW()
      WHERE status = 'trialing'
        AND "trialEndsAt" < NOW()
      `
    )

    return expiredTrials.length
  }
}
