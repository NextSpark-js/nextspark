/**
 * Teams System Object - Zod Validation Schemas
 *
 * Teams are system objects with dedicated services, not generic entities.
 * This file contains all Zod schemas for the teams system.
 *
 * @module core/lib/teams/schema
 */

import { z } from 'zod'

// Enum schemas
export const teamRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer'])
export const invitationStatusSchema = z.enum(['pending', 'accepted', 'declined', 'expired'])

// Base Team schema
export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  /**
   * Description field has no max length limit (TEXT type in database)
   * Database migration 007_teams_table.sql defines this as TEXT without constraints
   * If max length is desired, it should be a business decision
   */
  description: z.string().nullable().optional(),
  ownerId: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// Team Member schema
export const teamMemberSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string(),
  userId: z.string(),
  role: teamRoleSchema,
  invitedBy: z.string().nullable().optional(),
  joinedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// Team Invitation schema
export const teamInvitationSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string(),
  email: z.string().email('Invalid email address'),
  role: teamRoleSchema,
  status: invitationStatusSchema,
  token: z.string().uuid(),
  invitedBy: z.string(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable().optional(),
  declinedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// API Request schemas
export const createTeamSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
})

/**
 * Schema for owner-only team updates (name/description)
 * Only team owners (ownerId === userId) can update these fields
 * Used when: Owner updates team name or description
 *
 * @security This schema is only used after owner verification
 * @note Fields are optional to allow partial updates (e.g., only description)
 */
export const ownerUpdateTeamSchema = z.object({
  name: z.string()
    .min(1, 'Team name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z.string().nullable().optional(),
})

/**
 * Schema for admin team updates (non-owner-only fields)
 * Admins can update: slug, avatarUrl, settings
 * Does NOT include name/description (those are owner-only)
 * Used when: Admin (non-owner) updates team metadata
 *
 * @security This schema explicitly excludes owner-only fields (name, description)
 */
export const adminUpdateTeamSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Schema for general team updates (combined owner + admin permissions)
 * This is a merge of ownerUpdateTeamSchema and adminUpdateTeamSchema
 * Used for: API consumers that need a unified schema
 *
 * @note For internal use, prefer ownerUpdateTeamSchema or adminUpdateTeamSchema
 * based on the user's role and the fields being updated
 */
export const updateTeamSchema = ownerUpdateTeamSchema.merge(adminUpdateTeamSchema)

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer'], {
    message: 'Role must be admin, member, or viewer'
  }), // Cannot invite as owner
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer'], {
    message: 'Role must be admin, member, or viewer'
  }), // Cannot promote to owner
})

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// Query parameter schemas
export const teamListQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  scope: z.enum(['user', 'all']).default('user'), // 'all' requires superadmin
})

export const memberListQuerySchema = paginationSchema.extend({
  role: teamRoleSchema.optional(),
  search: z.string().optional(),
})

export const invitationListQuerySchema = paginationSchema.extend({
  status: invitationStatusSchema.optional(),
})

// Type exports for inference
export type TeamSchema = z.infer<typeof teamSchema>
export type TeamMemberSchema = z.infer<typeof teamMemberSchema>
export type TeamInvitationSchema = z.infer<typeof teamInvitationSchema>
export type CreateTeamSchema = z.infer<typeof createTeamSchema>
export type UpdateTeamSchema = z.infer<typeof updateTeamSchema>
export type OwnerUpdateTeamSchema = z.infer<typeof ownerUpdateTeamSchema>
export type AdminUpdateTeamSchema = z.infer<typeof adminUpdateTeamSchema>
export type InviteMemberSchema = z.infer<typeof inviteMemberSchema>
export type UpdateMemberRoleSchema = z.infer<typeof updateMemberRoleSchema>
export type TeamListQuerySchema = z.infer<typeof teamListQuerySchema>
export type MemberListQuerySchema = z.infer<typeof memberListQuerySchema>
export type InvitationListQuerySchema = z.infer<typeof invitationListQuerySchema>
