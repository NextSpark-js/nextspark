/**
 * Team Service
 *
 * Provides team management functions including creation, updates,
 * and single-tenant (global team) operations.
 *
 * @module TeamService
 */
import type { Team, TeamRole } from '../teams/types';
export interface TeamWithMemberCount extends Team {
    memberCount: number;
}
export interface TeamWithDetails extends Team {
    userRole: TeamRole;
    joinedAt: string;
    memberCount: number;
}
export interface UpdateTeamPayload {
    name?: string;
    slug?: string;
    description?: string;
    avatarUrl?: string;
    settings?: Record<string, unknown>;
}
export declare class TeamService {
    /**
     * Get team by ID
     *
     * @param teamId - Team ID
     * @param userId - Optional user ID for RLS
     * @returns Team or null if not found
     *
     * @example
     * const team = await TeamService.getById('team-123')
     */
    static getById(teamId: string, userId?: string): Promise<Team | null>;
    /**
     * Get team by slug
     *
     * @param slug - Team slug
     * @returns Team or null if not found
     *
     * @example
     * const team = await TeamService.getBySlug('my-team')
     */
    static getBySlug(slug: string): Promise<Team | null>;
    /**
     * Get the global team (for single-tenant mode)
     * Returns the first team found (should be the only one)
     *
     * @returns The global team or null if none exists
     *
     * @example
     * const globalTeam = await TeamService.getGlobal()
     */
    static getGlobal(): Promise<Team | null>;
    /**
     * Check if global team exists (for single-tenant mode)
     * Used to determine if public signup should be blocked
     *
     * @returns True if a team exists, false otherwise
     *
     * @example
     * const hasTeam = await TeamService.hasGlobal()
     */
    static hasGlobal(): Promise<boolean>;
    /**
     * Get all teams for a user with detailed information
     *
     * @param userId - The user ID
     * @returns Array of teams with membership details
     *
     * @example
     * const teams = await TeamService.getUserTeams('user-123')
     */
    static getUserTeams(userId: string): Promise<TeamWithDetails[]>;
    /**
     * Get team by ID with member count
     *
     * @param teamId - The team ID
     * @param userId - The user ID (for RLS)
     * @returns Team with member count or null
     *
     * @example
     * const team = await TeamService.getWithMemberCount('team-123', 'user-456')
     */
    static getWithMemberCount(teamId: string, userId: string): Promise<TeamWithMemberCount | null>;
    /**
     * Get team owner with user details
     *
     * @param teamId - Team ID
     * @returns Owner user information or null
     *
     * @example
     * const owner = await TeamService.getOwner('team-123')
     */
    static getOwner(teamId: string): Promise<{
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    } | null>;
    /**
     * Get teams owned by a user
     *
     * @param userId - User ID
     * @returns Array of teams owned by the user
     *
     * @example
     * const ownedTeams = await TeamService.getByOwnerId('user-123')
     */
    static getByOwnerId(userId: string): Promise<Team[]>;
    /**
     * Create a new team
     * Also creates team membership for owner and default subscription
     *
     * @param userId - The ID of the user creating the team
     * @param name - Optional team name (defaults to user's name + Team)
     * @returns The created Team
     *
     * @example
     * const team = await TeamService.create('user-123', 'My Company')
     */
    static create(userId: string, name?: string): Promise<Team>;
    /**
     * Update team
     *
     * @param teamId - Team ID
     * @param data - Update payload
     * @param userId - User ID (for permission check and RLS)
     * @returns Updated team
     *
     * @example
     * const team = await TeamService.update('team-123', { name: 'New Name' }, 'user-456')
     */
    static update(teamId: string, data: UpdateTeamPayload, userId: string): Promise<Team>;
    /**
     * Delete team
     * Only the owner can delete a team
     *
     * @param teamId - Team ID
     * @param userId - User ID (must be owner)
     *
     * @example
     * await TeamService.delete('team-123', 'user-456')
     */
    static delete(teamId: string, userId: string): Promise<void>;
    /**
     * Check if slug is available (not used by another team)
     *
     * @param slug - The slug to check
     * @param excludeTeamId - Optional team ID to exclude from check (for updates)
     * @returns True if slug is available, false otherwise
     *
     * @example
     * const available = await TeamService.isSlugAvailable('my-team')
     */
    static isSlugAvailable(slug: string, excludeTeamId?: string): Promise<boolean>;
    /**
     * Generate a unique slug for a team
     *
     * @param baseName - The base name to generate slug from
     * @returns A unique slug
     *
     * @example
     * const slug = await TeamService.generateSlug('My Company')
     * // 'my-company' or 'my-company-1' if taken
     */
    static generateSlug(baseName: string): Promise<string>;
    /**
     * Switch active team (for session management)
     * Verifies user is a member of the team
     *
     * @param userId - The user ID
     * @param teamId - The team ID to switch to
     * @returns True if successful
     *
     * @example
     * await TeamService.switchActive('user-123', 'team-456')
     */
    static switchActive(userId: string, teamId: string): Promise<boolean>;
    /**
     * Check if team exists
     *
     * @param teamId - Team ID
     * @returns True if team exists
     *
     * @example
     * const exists = await TeamService.exists('team-123')
     */
    static exists(teamId: string): Promise<boolean>;
}
//# sourceMappingURL=team.service.d.ts.map