/**
 * Teams System Object - TypeScript Types
 *
 * Teams are system objects with dedicated services, not generic entities.
 * This file contains all TypeScript types for the teams system.
 *
 * @module core/lib/teams/types
 */

import { APP_CONFIG_MERGED } from '../config/config-sync'

// =============================================================================
// TEAM ROLE TYPES (Extensible)
// =============================================================================

/**
 * Core team roles that are always available
 * These are the base roles defined in the core config
 */
export type CoreTeamRole = 'owner' | 'admin' | 'member' | 'viewer'

/**
 * Team member role - extensible type
 *
 * Themes can add custom roles via app.config.ts additionalTeamRoles.
 * The `& {}` trick allows string literals while maintaining autocomplete
 * for the core roles.
 *
 * @example
 * ```typescript
 * // Core roles work as expected
 * const role: TeamRole = 'owner' // OK
 *
 * // Custom roles defined in theme config also work
 * const customRole: TeamRole = 'editor' // OK if 'editor' is in availableTeamRoles
 * ```
 */
export type TeamRole = CoreTeamRole | (string & {})

/**
 * Validate if a string is a valid team role
 *
 * Checks against the merged config's availableTeamRoles.
 * Use this for runtime validation of role values.
 *
 * @param role - The role string to validate
 * @returns True if the role exists in availableTeamRoles
 *
 * @example
 * ```typescript
 * if (isValidTeamRole(someRole)) {
 *   // someRole is guaranteed to be in config
 * }
 * ```
 */
export function isValidTeamRole(role: string): role is TeamRole {
  const availableRoles = APP_CONFIG_MERGED.teamRoles?.availableTeamRoles ?? []
  return availableRoles.includes(role)
}

/**
 * Get all available team roles from merged config
 */
export function getAvailableTeamRoles(): readonly string[] {
  return APP_CONFIG_MERGED.teamRoles?.availableTeamRoles ?? ['owner', 'admin', 'member', 'viewer']
}

// Invitation status enum
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

// Base Team interface
export interface Team {
  id: string
  name: string
  slug: string
  description: string | null
  ownerId: string
  avatarUrl: string | null
  settings: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Team Member interface
export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  invitedBy: string | null
  joinedAt: string
  createdAt: string
  updatedAt: string
}

// Team Invitation interface
export interface TeamInvitation {
  id: string
  teamId: string
  email: string
  role: TeamRole
  status: InvitationStatus
  token: string
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  declinedAt: string | null
  createdAt: string
  updatedAt: string
}

// Extended Team with members
export interface TeamWithMembers extends Team {
  members: TeamMember[]
  memberCount: number
}

// Extended Team with subscription (for future Phase 2)
export interface TeamWithSubscription extends Team {
  subscription?: {
    id: string
    planId: string
    status: string
    trialEndsAt?: string
  }
}

// User's membership in a team
export interface UserTeamMembership {
  team: Team
  role: TeamRole
  joinedAt: string
}

// API Request types
export interface CreateTeamRequest {
  name: string
  slug: string
  description?: string
}

export interface UpdateTeamRequest {
  name?: string
  slug?: string
  description?: string
  avatarUrl?: string
  settings?: Record<string, any>
}

export interface InviteMemberRequest {
  email: string
  role: Exclude<TeamRole, 'owner'> // Cannot invite as owner
}

export interface UpdateMemberRoleRequest {
  role: Exclude<TeamRole, 'owner'> // Cannot promote to owner
}

// API Response types
export interface TeamListResponse {
  teams: TeamWithMembers[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface TeamDetailResponse {
  team: TeamWithMembers
}

export interface MemberListResponse {
  members: (TeamMember & { user?: any })[]
}

export interface InvitationListResponse {
  invitations: (TeamInvitation & { team?: Team })[]
}
