/**
 * Entity Server Actions
 *
 * Generic Server Actions for CRUD operations on any registered entity.
 * Auth (userId/teamId) is obtained automatically from session and cookies.
 *
 * Import from '@nextsparkjs/core/actions' or '@nextsparkjs/core/lib/actions'.
 *
 * @example
 * ```typescript
 * import {
 *   createEntity,
 *   updateEntity,
 *   deleteEntity,
 *   getEntity,
 *   listEntities,
 * } from '@nextsparkjs/core/actions'
 *
 * // Create - auth obtained from server session
 * const result = await createEntity('schools', { name: 'MIT' })
 *
 * // Update with revalidation
 * await updateEntity('campaigns', id, { status: 'paused' }, {
 *   revalidatePaths: ['/dashboard']
 * })
 *
 * // Delete with redirect
 * await deleteEntity('leads', id, { redirectTo: '/leads' })
 *
 * // Get by ID
 * const entity = await getEntity('schools', id)
 *
 * // List with filters
 * const list = await listEntities('campaigns', { limit: 20, where: { status: 'active' } })
 * ```
 */

// Re-export all entity actions
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

// Re-export all types
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
