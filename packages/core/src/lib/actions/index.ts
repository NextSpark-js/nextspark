/**
 * NextSpark Server Actions
 *
 * Server Actions for CRUD operations, user management, and team management.
 * Auth (userId/teamId) is obtained automatically from session and cookies.
 *
 * Import from '@nextsparkjs/core/actions' or '@nextsparkjs/core/lib/actions'.
 *
 * @example
 * ```typescript
 * import {
 *   // Entity actions
 *   createEntity,
 *   updateEntity,
 *   deleteEntity,
 *   getEntity,
 *   listEntities,
 *   // User actions
 *   updateProfile,
 *   updateAvatar,
 *   deleteAccount,
 *   // Team actions
 *   updateTeam,
 *   inviteMember,
 *   removeMember,
 *   updateMemberRole,
 * } from '@nextsparkjs/core/actions'
 *
 * // Entity operations - auth obtained from server session
 * const result = await createEntity('schools', { name: 'MIT' })
 * await updateEntity('campaigns', id, { status: 'paused' })
 * await deleteEntity('leads', id, { redirectTo: '/leads' })
 *
 * // User profile operations
 * await updateProfile({ firstName: 'John', lastName: 'Doe' })
 * await updateAvatar(formData)
 * await deleteAccount()
 *
 * // Team operations
 * await updateTeam('team-id', { name: 'New Name' })
 * await inviteMember('team-id', 'user@example.com', 'member')
 * await removeMember('team-id', 'member-id')
 * await updateMemberRole('team-id', 'member-id', 'admin')
 * ```
 */

// ============================================================================
// ENTITY ACTIONS
// ============================================================================

export {
  createEntity,
  updateEntity,
  deleteEntity,
  getEntity,
  listEntities,
  deleteEntities,
  entityExists,
  countEntities,
} from './entity.actions'

// ============================================================================
// USER ACTIONS
// ============================================================================

export {
  updateProfile,
  updateAvatar,
  deleteAccount,
} from './user.actions'

export type {
  UpdateProfileData,
  ProfileUpdateResult,
} from './user.actions'

// ============================================================================
// TEAM ACTIONS
// ============================================================================

export {
  updateTeam,
  inviteMember,
  removeMember,
  updateMemberRole,
} from './team.actions'

export type {
  UpdateTeamData,
  InviteMemberResult,
} from './team.actions'

// ============================================================================
// SHARED TYPES
// ============================================================================

export type {
  EntityActionResult,
  EntityActionVoidResult,
  CreateEntityInput,
  UpdateEntityInput,
  ListEntityOptions,
  ListEntityResult,
  ActionConfig,
  ActionAuthContext,
  BatchDeleteResult,
} from './types'
