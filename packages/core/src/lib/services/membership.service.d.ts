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
import type { Permission, ActionResult, MembershipSubscription, QuotaState, TeamMembershipData } from '../permissions/types';
/**
 * Represents complete team membership context for a user
 *
 * Combines role, permissions, subscription, features, and quotas
 * into a single object with helper methods.
 */
export declare class TeamMembership implements TeamMembershipData {
    readonly userId: string;
    readonly teamId: string;
    readonly role: string | null;
    readonly hierarchy: number;
    readonly permissions: Permission[];
    readonly subscription: MembershipSubscription | null;
    readonly features: string[];
    readonly quotas: Record<string, QuotaState>;
    constructor(data: TeamMembershipData);
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
    hasMinHierarchy(level: number): boolean;
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
    hasRole(role: string): boolean;
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
    hasAnyRole(roles: string[]): boolean;
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
    hasPermission(permission: Permission): boolean;
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
    hasFeature(feature: string): boolean;
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
    checkQuota(limitSlug: string, increment?: number): {
        allowed: boolean;
        remaining: number;
    };
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
    canPerformAction(action: string, options?: {
        incrementQuota?: number;
    }): ActionResult;
}
export declare class MembershipService {
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
    static get(userId: string, teamId: string): Promise<TeamMembership>;
    /**
     * Get hierarchy level for a role from config
     *
     * @param role - Team role
     * @returns Hierarchy number (higher = more privileged)
     *
     * @private
     */
    private static getHierarchyForRole;
    /**
     * Get quota states for all limits in a plan
     *
     * @param subscriptionId - Subscription ID
     * @param planSlug - Plan slug
     * @returns Object with quota states by limit slug
     *
     * @private
     */
    private static getQuotaStates;
}
//# sourceMappingURL=membership.service.d.ts.map