/**
 * Membership Service
 *
 * Provides unified team membership context combining:
 * - Role & hierarchy
 * - Permissions (RBAC)
 * - Subscription features
 * - Quota state
 *
 * @module MembershipService
 */

import { APP_CONFIG_MERGED } from '../config/config-sync'
import { TeamMemberService } from './team-member.service'
import { SubscriptionService } from './subscription.service'
import { PermissionService } from './permission.service'
import { PlanService } from './plan.service'
import { UsageService } from './usage.service'
import { hasFeature as checkFeatureInList } from '../billing/helpers'
import type {
  Permission,
  ActionResult,
  ActionDeniedReason,
  MembershipSubscription,
  QuotaState,
  TeamMembershipData,
} from '../permissions/types'

// ===========================================
// TEAM MEMBERSHIP CLASS
// ===========================================

/**
 * Represents complete team membership context for a user
 *
 * Combines role, permissions, subscription, features, and quotas
 * into a single object with helper methods.
 */
export class TeamMembership implements TeamMembershipData {
  readonly userId: string
  readonly teamId: string
  readonly role: string | null
  readonly hierarchy: number
  readonly permissions: Permission[]
  readonly subscription: MembershipSubscription | null
  readonly features: string[]
  readonly quotas: Record<string, QuotaState>

  constructor(data: TeamMembershipData) {
    this.userId = data.userId
    this.teamId = data.teamId
    this.role = data.role
    this.hierarchy = data.hierarchy
    this.permissions = data.permissions
    this.subscription = data.subscription
    this.features = data.features
    this.quotas = data.quotas
  }

  /**
   * Check if user has minimum hierarchy level
   *
   * @param level - Minimum hierarchy level required
   * @returns True if user meets or exceeds level
   *
   * @example
   * if (membership.hasMinHierarchy(50)) {
   *   // User has hierarchy >= 50 (admin or higher)
   * }
   */
  hasMinHierarchy(level: number): boolean {
    return this.hierarchy >= level
  }

  /**
   * Check if user has specific role
   *
   * @param role - Role to check
   * @returns True if user has the role
   *
   * @example
   * if (membership.hasRole('admin')) {
   *   // User is admin
   * }
   */
  hasRole(role: string): boolean {
    return this.role === role
  }

  /**
   * Check if user has any of the specified roles
   *
   * @param roles - Array of roles to check
   * @returns True if user has at least one role
   *
   * @example
   * if (membership.hasAnyRole(['owner', 'admin'])) {
   *   // User is owner or admin
   * }
   */
  hasAnyRole(roles: string[]): boolean {
    if (!this.role) return false
    return roles.includes(this.role)
  }

  /**
   * Check if user has specific permission
   *
   * @param permission - Permission to check
   * @returns True if user has the permission
   *
   * @example
   * if (membership.hasPermission('customers.delete')) {
   *   // User can delete customers
   * }
   */
  hasPermission(permission: Permission): boolean {
    return this.permissions.includes(permission)
  }

  /**
   * Check if user has specific feature
   *
   * @param feature - Feature slug to check
   * @returns True if plan includes feature
   *
   * @example
   * if (membership.hasFeature('advanced_analytics')) {
   *   // Plan includes advanced analytics
   * }
   */
  hasFeature(feature: string): boolean {
    return this.features.includes(feature)
  }

  /**
   * Check quota for a specific limit
   *
   * @param limitSlug - Limit slug to check
   * @param increment - Optional increment to check against
   * @returns Object with allowed status and remaining quota
   *
   * @example
   * const quota = membership.checkQuota('projects', 1)
   * if (!quota.allowed) {
   *   console.log('Quota exceeded')
   * }
   */
  checkQuota(
    limitSlug: string,
    increment: number = 1
  ): { allowed: boolean; remaining: number } {
    const quota = this.quotas[limitSlug]

    if (!quota) {
      // Unknown limit = allow
      return { allowed: true, remaining: Infinity }
    }

    if (quota.unlimited) {
      return { allowed: true, remaining: Infinity }
    }

    const wouldExceed = quota.used + increment > quota.limit
    return {
      allowed: !wouldExceed,
      remaining: Math.max(0, quota.remaining - increment),
    }
  }

  /**
   * Check if action is allowed (comprehensive check)
   *
   * Verifies:
   * 1. User is a member
   * 2. User has required permission (RBAC)
   * 3. Plan includes required feature
   * 4. Quota is available
   * 5. Subscription is active
   *
   * @param action - Action slug to check
   * @param options - Options for quota increment
   * @returns ActionResult with allowed status and details
   *
   * @example
   * const result = membership.canPerformAction('projects.create')
   * if (!result.allowed) {
   *   console.log(result.message, result.reason)
   * }
   */
  canPerformAction(
    action: string,
    options?: { incrementQuota?: number }
  ): ActionResult {
    // 1. Check membership
    if (!this.role) {
      return {
        allowed: false,
        reason: 'not_member',
        message: 'You are not a member of this team',
      }
    }

    // 2. Check subscription status
    if (this.subscription && this.subscription.status !== 'active' && this.subscription.status !== 'trialing') {
      return {
        allowed: false,
        reason: 'subscription_inactive',
        message: `Subscription is ${this.subscription.status}`,
        meta: {
          currentStatus: this.subscription.status,
        },
      }
    }

    // Parse action (e.g., 'customers.create' -> permission check)
    const [entity, actionType] = action.split('.')
    const permission = `${entity}.${actionType}` as Permission

    // 3. Check permission (RBAC)
    if (PermissionService.isValid(permission)) {
      if (!this.hasPermission(permission)) {
        return {
          allowed: false,
          reason: 'permission_denied',
          message: `You do not have permission: ${permission}`,
          meta: {
            requiredPermission: permission,
            userRole: this.role,
          },
        }
      }
    }

    // 4. Check feature (plan-based)
    // Note: This would require a mapping of actions to features
    // For now, we'll skip this unless explicitly needed

    // 5. Check quota (if action maps to a limit)
    // Note: This would require a mapping of actions to limits
    // For now, we'll skip this unless explicitly needed

    return { allowed: true }
  }
}

// ===========================================
// MEMBERSHIP SERVICE
// ===========================================

export class MembershipService {
  /**
   * Get complete team membership context for a user
   *
   * Combines data from:
   * - TeamMemberService (role, joinedAt)
   * - SubscriptionService (plan, features, quotas)
   * - PermissionService (permissions array)
   * - APP_CONFIG_MERGED (hierarchy from role config)
   *
   * @param userId - User ID
   * @param teamId - Team ID
   * @returns TeamMembership object
   *
   * @example
   * const membership = await MembershipService.get('user-123', 'team-456')
   * if (membership.hasMinHierarchy(50)) {
   *   // User is admin or higher
   * }
   */
  static async get(userId: string, teamId: string): Promise<TeamMembership> {
    if (!userId || !teamId) {
      throw new Error('User ID and Team ID are required')
    }
    // 1. Get team member info (role, joinedAt)
    const teamMember = await TeamMemberService.getByTeamAndUser(teamId, userId)

    // If not a member, return minimal membership with null role
    if (!teamMember) {
      return new TeamMembership({
        userId,
        teamId,
        role: null,
        hierarchy: 0,
        permissions: [],
        subscription: null,
        features: [],
        quotas: {},
      })
    }

    // 2. Get hierarchy from APP_CONFIG_MERGED
    const hierarchy = this.getHierarchyForRole(teamMember.role)

    // 3. Get role permissions from PermissionService
    const permissions = PermissionService.getRolePermissions(teamMember.role)

    // 4. Get subscription info
    const subscription = await SubscriptionService.getActive(teamId)

    let membershipSubscription: MembershipSubscription | null = null
    let features: string[] = []
    let quotas: Record<string, QuotaState> = {}

    if (subscription) {
      membershipSubscription = {
        id: subscription.id,
        planSlug: subscription.plan.slug,
        planName: subscription.plan.name,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null,
        currentPeriodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null,
      }

      // 5. Get plan features
      const planConfig = PlanService.getConfig(subscription.plan.slug)
      if (planConfig) {
        features = planConfig.features || []
      }

      // 6. Get quota states
      quotas = await this.getQuotaStates(subscription.id, subscription.plan.slug)
    }

    return new TeamMembership({
      userId,
      teamId,
      role: teamMember.role,
      hierarchy,
      permissions,
      subscription: membershipSubscription,
      features,
      quotas,
    })
  }

  /**
   * Get hierarchy level for a role from config
   *
   * @param role - Team role
   * @returns Hierarchy number (higher = more privileged)
   *
   * @private
   */
  private static getHierarchyForRole(role: string): number {
    const hierarchyConfig = APP_CONFIG_MERGED.teamRoles?.hierarchy

    if (!hierarchyConfig) {
      // Fallback to default hierarchy
      const defaultHierarchy: Record<string, number> = {
        owner: 100,
        admin: 50,
        member: 10,
        viewer: 1,
      }
      return defaultHierarchy[role] ?? 0
    }

    return hierarchyConfig[role] ?? 0
  }

  /**
   * Get quota states for all limits in a plan
   *
   * @param subscriptionId - Subscription ID
   * @param planSlug - Plan slug
   * @returns Object with quota states by limit slug
   *
   * @private
   */
  private static async getQuotaStates(
    subscriptionId: string,
    planSlug: string
  ): Promise<Record<string, QuotaState>> {
    const quotas: Record<string, QuotaState> = {}

    // Get plan limits
    const planConfig = PlanService.getConfig(planSlug)
    if (!planConfig || !planConfig.limits) {
      return quotas
    }

    // For each limit in plan, get current usage
    for (const [limitSlug, limitValue] of Object.entries(planConfig.limits)) {
      if (limitValue === -1) {
        // Unlimited
        quotas[limitSlug] = {
          used: 0,
          limit: -1,
          unlimited: true,
          remaining: Infinity,
        }
        continue
      }

      // Get current usage from UsageService
      const quota = await SubscriptionService.checkQuota(
        (await SubscriptionService.getById(subscriptionId))?.teamId || '',
        limitSlug
      )

      quotas[limitSlug] = {
        used: quota.current,
        limit: quota.max,
        unlimited: quota.max === -1,
        remaining: quota.remaining,
      }
    }

    return quotas
  }
}
