/**
 * Team Member Service
 *
 * Provides team membership management including adding/removing members,
 * role management, and permission checks.
 *
 * @module TeamMemberService
 */
import type { TeamMember, TeamRole } from '../teams/types';
export interface TeamMemberWithUser extends TeamMember {
    userName: string | null;
    userEmail: string;
    userImage: string | null;
}
export interface AddMemberOptions {
    invitedBy?: string;
}
export declare class TeamMemberService {
    /**
     * Get team member by team and user ID
     *
     * @param teamId - Team ID
     * @param userId - User ID
     * @returns Team member or null if not found
     *
     * @example
     * const member = await TeamMemberService.getByTeamAndUser('team-123', 'user-456')
     */
    static getByTeamAndUser(teamId: string, userId: string): Promise<TeamMember | null>;
    /**
     * List all team members with user details
     *
     * @param teamId - Team ID
     * @param requestingUserId - User ID making the request (for RLS)
     * @returns Array of team members with user information
     *
     * @example
     * const members = await TeamMemberService.listByTeam('team-123', 'user-456')
     */
    static listByTeam(teamId: string, requestingUserId: string): Promise<TeamMemberWithUser[]>;
    /**
     * Get user's role in a team
     *
     * @param teamId - Team ID
     * @param userId - User ID
     * @returns The user's role or null if not a member
     *
     * @example
     * const role = await TeamMemberService.getRole('team-123', 'user-456')
     */
    static getRole(teamId: string, userId: string): Promise<TeamRole | null>;
    /**
     * Add a user to a team
     *
     * @param teamId - Team ID
     * @param userId - User ID to add
     * @param role - Role to assign
     * @param options - Additional options (invitedBy)
     * @returns Created team member
     *
     * @example
     * const member = await TeamMemberService.add('team-123', 'user-456', 'member', {
     *   invitedBy: 'owner-user-id'
     * })
     */
    static add(teamId: string, userId: string, role: TeamRole, options?: AddMemberOptions): Promise<TeamMember>;
    /**
     * Add user to the global team (for single-tenant invite flow)
     *
     * @param userId - User ID to add
     * @param role - Role to assign (default: 'member')
     * @param invitedBy - User ID who invited them
     *
     * @example
     * await TeamMemberService.addToGlobal('user-123', 'member', 'owner-id')
     */
    static addToGlobal(userId: string, role?: TeamRole, invitedBy?: string): Promise<void>;
    /**
     * Transfer team ownership to another member
     *
     * @param teamId - Team ID
     * @param newOwnerId - User ID of the new owner (must be existing member)
     * @param currentOwnerId - Current owner's user ID (for verification)
     * @returns Updated team members (both old and new owner)
     *
     * @example
     * await TeamMemberService.transferOwnership('team-123', 'new-owner-id', 'current-owner-id')
     */
    static transferOwnership(teamId: string, newOwnerId: string, currentOwnerId: string): Promise<{
        previousOwner: TeamMember;
        newOwner: TeamMember;
    }>;
    /**
     * Remove a user from a team
     *
     * @param teamId - Team ID
     * @param userId - User ID to remove
     *
     * @example
     * await TeamMemberService.remove('team-123', 'user-456')
     */
    static remove(teamId: string, userId: string): Promise<void>;
    /**
     * Update user's role in a team
     *
     * @param teamId - Team ID
     * @param userId - User ID
     * @param role - New role
     * @returns Updated team member
     *
     * @example
     * const member = await TeamMemberService.updateRole('team-123', 'user-456', 'admin')
     */
    static updateRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMember>;
    /**
     * Check if user is a member of a team
     *
     * @param teamId - Team ID
     * @param userId - User ID
     * @returns True if user is a member
     *
     * @example
     * const isMember = await TeamMemberService.isMember('team-123', 'user-456')
     */
    static isMember(teamId: string, userId: string): Promise<boolean>;
    /**
     * Check if user has required permission in team
     *
     * @param userId - User ID
     * @param teamId - Team ID
     * @param requiredRoles - Array of roles that are allowed
     * @returns True if user has permission
     *
     * @example
     * const hasPermission = await TeamMemberService.hasPermission(
     *   'user-123',
     *   'team-456',
     *   ['owner', 'admin']
     * )
     */
    static hasPermission(userId: string, teamId: string, requiredRoles?: TeamRole[]): Promise<boolean>;
    /**
     * Get count of team members
     *
     * @param teamId - Team ID
     * @returns Number of members
     *
     * @example
     * const count = await TeamMemberService.count('team-123')
     */
    static count(teamId: string): Promise<number>;
    /**
     * Get count of members by role
     *
     * @param teamId - Team ID
     * @returns Object with role counts
     *
     * @example
     * const counts = await TeamMemberService.countByRole('team-123')
     * // { owner: 1, admin: 2, member: 5, viewer: 3 }
     */
    static countByRole(teamId: string): Promise<Record<string, number>>;
    /**
     * List all team memberships for a user
     * Useful for team switcher or user profile
     *
     * @param userId - User ID
     * @returns Array of memberships with team details
     *
     * @example
     * const memberships = await TeamMemberService.listByUser('user-123')
     */
    static listByUser(userId: string): Promise<Array<TeamMember & {
        teamName: string;
        teamSlug: string;
    }>>;
    /**
     * List team members filtered by role
     *
     * @param teamId - Team ID
     * @param role - Role to filter by
     * @param requestingUserId - User ID making the request (for RLS)
     * @returns Array of members with that role
     *
     * @example
     * const admins = await TeamMemberService.listByRole('team-123', 'admin', 'user-456')
     */
    static listByRole(teamId: string, role: TeamRole, requestingUserId: string): Promise<TeamMemberWithUser[]>;
    /**
     * Search team members by name or email
     *
     * @param teamId - Team ID
     * @param query - Search query (name or email)
     * @param requestingUserId - User ID making the request (for RLS)
     * @returns Array of matching members
     *
     * @example
     * const results = await TeamMemberService.search('team-123', 'john', 'user-456')
     */
    static search(teamId: string, query: string, requestingUserId: string): Promise<TeamMemberWithUser[]>;
    /**
     * Get recently joined members
     *
     * @param teamId - Team ID
     * @param limit - Maximum number of members to return (default: 10)
     * @param requestingUserId - User ID making the request (for RLS)
     * @returns Array of recently joined members
     *
     * @example
     * const recent = await TeamMemberService.getRecentlyJoined('team-123', 5, 'user-456')
     */
    static getRecentlyJoined(teamId: string, limit: number, requestingUserId: string): Promise<TeamMemberWithUser[]>;
    /**
     * Get members who were invited by a specific user
     *
     * @param teamId - Team ID
     * @param invitedByUserId - User ID who sent the invitations
     * @param requestingUserId - User ID making the request (for RLS)
     * @returns Array of members invited by the user
     *
     * @example
     * const invited = await TeamMemberService.listInvitedBy('team-123', 'user-456', 'user-789')
     */
    static listInvitedBy(teamId: string, invitedByUserId: string, requestingUserId: string): Promise<TeamMemberWithUser[]>;
}
//# sourceMappingURL=team-member.service.d.ts.map