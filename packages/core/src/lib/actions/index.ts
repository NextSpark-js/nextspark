/**
 * Entity Server Actions
 *
 * Generic Server Actions for CRUD operations on any registered entity.
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
 * // Create
 * const result = await createEntity('schools', userId, teamId, { name: 'MIT' })
 *
 * // Update
 * await updateEntity('campaigns', id, userId, { status: 'paused' })
 *
 * // Delete
 * await deleteEntity('leads', id, userId)
 *
 * // Get
 * const entity = await getEntity('schools', id, userId)
 *
 * // List
 * const list = await listEntities('campaigns', userId, teamId, { limit: 20 })
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
