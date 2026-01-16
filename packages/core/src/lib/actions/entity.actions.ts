'use server'

/**
 * Entity Server Actions
 *
 * Generic Server Actions for CRUD operations on any registered entity.
 * These actions run on the server and can be called directly from Client Components.
 *
 * SECURITY:
 * - Auth is obtained from session/cookies (NOT from client parameters)
 * - Permissions are checked against the permissions registry
 * - userId comes from getTypedSession()
 * - teamId comes from httpOnly cookie 'activeTeamId'
 *
 * Benefits over fetch/hooks:
 * - Zero JavaScript sent to client for mutation logic
 * - Type-safe end-to-end (no JSON serialization boundaries)
 * - Automatic cache revalidation with revalidatePath/revalidateTag
 * - Built-in error handling and result wrapping
 *
 * @example
 * ```typescript
 * // From a Client Component
 * 'use client'
 * import { createEntity } from '@nextsparkjs/core/actions'
 *
 * function MyForm() {
 *   async function handleSubmit(data) {
 *     const result = await createEntity('schools', data)
 *     if (result.success) {
 *       // Handle success
 *     }
 *   }
 * }
 * ```
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { GenericEntityService } from '../services/generic-entity.service'
import { entityRegistry } from '../entities/registry'
import { getTypedSession } from '../auth'
import { checkPermission } from '../permissions/check'
import type {
  EntityActionResult,
  EntityActionVoidResult,
  CreateEntityInput,
  UpdateEntityInput,
  ListEntityOptions,
  ListEntityResult,
  ActionConfig,
  BatchDeleteResult,
  ActionAuthContext,
} from './types'

// ============================================================================
// AUTH HELPERS
// ============================================================================

/**
 * Get authenticated user and team context from session/cookies
 * Returns error result if not authenticated or no team selected
 */
async function getAuthContext(): Promise<
  | ({ success: true } & ActionAuthContext)
  | { success: false; error: string }
> {
  // 1. Get userId from session
  const headersList = await headers()
  const session = await getTypedSession(headersList)

  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' }
  }

  // 2. Get teamId from httpOnly cookie
  const cookieStore = await cookies()
  const teamId = cookieStore.get('activeTeamId')?.value

  if (!teamId) {
    return { success: false, error: 'No active team selected' }
  }

  return { success: true, userId: session.user.id, teamId }
}

// ============================================================================
// CREATE ENTITY
// ============================================================================

/**
 * Create a new entity record
 *
 * Auth is automatically obtained from session/cookies - no need to pass userId/teamId.
 * Permissions are checked against the permissions registry before executing.
 *
 * @param entitySlug - The entity type slug (e.g., 'campaigns', 'schools')
 * @param data - The entity data to create
 * @param config - Optional configuration for revalidation/redirect
 * @returns The created entity wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * const result = await createEntity('schools', {
 *   name: 'MIT',
 *   status: 'active'
 * })
 *
 * if (result.success) {
 *   console.log('Created:', result.data)
 * } else {
 *   console.error('Error:', result.error)
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom revalidation
 * const result = await createEntity('campaigns', data, {
 *   revalidatePaths: ['/dashboard/overview'],
 *   revalidateTags: ['campaign-stats'],
 * })
 * ```
 */
export async function createEntity<T = unknown>(
  entitySlug: string,
  data: CreateEntityInput,
  config?: ActionConfig
): Promise<EntityActionResult<T>> {
  try {
    // 1. Validate entity exists
    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // 2. Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // 3. Check permission
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.create`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    // 4. Create entity via service
    const result = await GenericEntityService.create<T>(
      entitySlug,
      userId,
      teamId,
      data
    )

    // 5. Revalidate caches
    revalidatePath(`/dashboard/${entitySlug}`)

    if (config?.revalidatePaths) {
      config.revalidatePaths.forEach(path => revalidatePath(path))
    }

    if (config?.revalidateTags) {
      config.revalidateTags.forEach(tag => revalidateTag(tag))
    }

    // 6. Redirect if configured
    if (config?.redirectTo) {
      redirect(config.redirectTo)
    }

    return { success: true, data: result }
  } catch (error) {
    console.error(`[createEntity] Error creating ${entitySlug}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// UPDATE ENTITY
// ============================================================================

/**
 * Update an existing entity record
 *
 * Auth is automatically obtained from session/cookies.
 * Permissions are checked against the permissions registry before executing.
 *
 * @param entitySlug - The entity type slug
 * @param id - The entity ID to update
 * @param data - The fields to update
 * @param config - Optional configuration for revalidation/redirect
 * @returns The updated entity wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * const result = await updateEntity('campaigns', 'abc123', {
 *   status: 'paused'
 * })
 * ```
 */
export async function updateEntity<T = unknown>(
  entitySlug: string,
  id: string,
  data: UpdateEntityInput,
  config?: ActionConfig
): Promise<EntityActionResult<T>> {
  try {
    // 1. Validate inputs
    if (!id?.trim()) {
      return { success: false, error: 'Entity ID is required' }
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // 2. Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // 3. Check permission
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.update`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    // 4. Update entity via service
    // SECURITY: Pass teamId to prevent cross-team access for multi-team users
    const result = await GenericEntityService.update<T>(
      entitySlug,
      id,
      userId,
      data,
      teamId
    )

    // 5. Revalidate caches
    revalidatePath(`/dashboard/${entitySlug}`)
    revalidatePath(`/dashboard/${entitySlug}/${id}`)

    if (config?.revalidatePaths) {
      config.revalidatePaths.forEach(path => revalidatePath(path))
    }

    if (config?.revalidateTags) {
      config.revalidateTags.forEach(tag => revalidateTag(tag))
    }

    // 6. Redirect if configured
    if (config?.redirectTo) {
      redirect(config.redirectTo)
    }

    return { success: true, data: result }
  } catch (error) {
    console.error(`[updateEntity] Error updating ${entitySlug}/${id}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// DELETE ENTITY
// ============================================================================

/**
 * Delete an entity record
 *
 * Auth is automatically obtained from session/cookies.
 * Permissions are checked against the permissions registry before executing.
 *
 * @param entitySlug - The entity type slug
 * @param id - The entity ID to delete
 * @param config - Optional configuration for revalidation/redirect
 * @returns Success status
 *
 * @example
 * ```typescript
 * await deleteEntity('leads', 'xyz789', {
 *   redirectTo: '/dashboard/leads'
 * })
 * ```
 */
export async function deleteEntity(
  entitySlug: string,
  id: string,
  config?: ActionConfig
): Promise<EntityActionVoidResult> {
  try {
    // 1. Validate inputs
    if (!id?.trim()) {
      return { success: false, error: 'Entity ID is required' }
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // 2. Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // 3. Check permission
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.delete`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    // 4. Delete entity via service
    // SECURITY: Pass teamId to prevent cross-team access for multi-team users
    const deleted = await GenericEntityService.delete(entitySlug, id, userId, teamId)

    if (!deleted) {
      return { success: false, error: 'Entity not found or not authorized' }
    }

    // 5. Revalidate caches
    revalidatePath(`/dashboard/${entitySlug}`)

    if (config?.revalidatePaths) {
      config.revalidatePaths.forEach(path => revalidatePath(path))
    }

    if (config?.revalidateTags) {
      config.revalidateTags.forEach(tag => revalidateTag(tag))
    }

    // 6. Redirect if configured
    if (config?.redirectTo) {
      redirect(config.redirectTo)
    }

    return { success: true }
  } catch (error) {
    console.error(`[deleteEntity] Error deleting ${entitySlug}/${id}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// GET ENTITY
// ============================================================================

/**
 * Get a single entity by ID
 *
 * Auth is automatically obtained from session/cookies.
 * Permissions are checked against the permissions registry before executing.
 *
 * Note: Prefer using Server Components for reads when possible.
 * Use this action only when you need to fetch data from a Client Component.
 *
 * @param entitySlug - The entity type slug
 * @param id - The entity ID
 * @returns The entity or null
 *
 * @example
 * ```typescript
 * const result = await getEntity('campaigns', 'abc123')
 * if (result.success && result.data) {
 *   console.log('Found:', result.data)
 * }
 * ```
 */
export async function getEntity<T = unknown>(
  entitySlug: string,
  id: string
): Promise<EntityActionResult<T | null>> {
  try {
    if (!id?.trim()) {
      return { success: false, error: 'Entity ID is required' }
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // Check permission
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.read`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    // SECURITY: Pass teamId to prevent cross-team access for multi-team users
    const result = await GenericEntityService.getById<T>(entitySlug, id, userId, teamId)

    return { success: true, data: result }
  } catch (error) {
    console.error(`[getEntity] Error fetching ${entitySlug}/${id}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// LIST ENTITIES
// ============================================================================

/**
 * List entities with filtering and pagination
 *
 * Auth is automatically obtained from session/cookies.
 * Permissions are checked against the permissions registry before executing.
 *
 * Note: Prefer using Server Components for reads when possible.
 * Use this action only when you need to fetch data from a Client Component.
 *
 * @param entitySlug - The entity type slug
 * @param options - Filtering, sorting, pagination options
 * @returns Paginated list of entities
 *
 * @example
 * ```typescript
 * const result = await listEntities('schools', {
 *   where: { status: 'active' },
 *   orderBy: 'name',
 *   limit: 20
 * })
 *
 * if (result.success) {
 *   console.log(`Found ${result.data.total} schools`)
 * }
 * ```
 */
export async function listEntities<T = unknown>(
  entitySlug: string,
  options?: ListEntityOptions
): Promise<EntityActionResult<ListEntityResult<T>>> {
  try {
    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // Check permission
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.list`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    const result = await GenericEntityService.list<T>(entitySlug, userId, {
      ...options,
      teamId,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error(`[listEntities] Error listing ${entitySlug}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Delete multiple entities at once
 *
 * Auth is automatically obtained from session/cookies.
 * Permissions are checked against the permissions registry before executing.
 * Uses efficient batch delete (single query) by default.
 *
 * @param entitySlug - The entity type slug
 * @param ids - Array of entity IDs to delete
 * @param config - Optional configuration for revalidation/redirect
 * @returns Count of deleted entities
 *
 * @example
 * ```typescript
 * const result = await deleteEntities('leads', ['id1', 'id2', 'id3'])
 * if (result.success) {
 *   console.log(`Deleted ${result.data.deletedCount} leads`)
 * }
 * ```
 */
export async function deleteEntities(
  entitySlug: string,
  ids: string[],
  config?: ActionConfig
): Promise<EntityActionResult<BatchDeleteResult>> {
  try {
    if (!ids?.length) {
      return { success: false, error: 'At least one ID is required' }
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // Check permission
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.delete`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    // Use efficient batch delete (hooks are executed if enabled)
    // SECURITY: Pass teamId to prevent cross-team access for multi-team users
    const deletedCount = await GenericEntityService.deleteMany(entitySlug, ids, userId, {
      executeHooks: true, // Execute hooks for each entity
      teamId, // Team isolation
    })

    // Revalidate caches
    revalidatePath(`/dashboard/${entitySlug}`)

    if (config?.revalidatePaths) {
      config.revalidatePaths.forEach(path => revalidatePath(path))
    }

    if (config?.revalidateTags) {
      config.revalidateTags.forEach(tag => revalidateTag(tag))
    }

    // Redirect if configured
    if (config?.redirectTo) {
      redirect(config.redirectTo)
    }

    return { success: true, data: { deletedCount } }
  } catch (error) {
    console.error(`[deleteEntities] Error batch deleting ${entitySlug}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// ENTITY EXISTS
// ============================================================================

/**
 * Check if an entity exists
 *
 * Auth is automatically obtained from session/cookies.
 * Permissions are checked against the permissions registry before executing.
 *
 * @param entitySlug - The entity type slug
 * @param id - The entity ID
 * @returns Whether the entity exists and is accessible
 *
 * @example
 * ```typescript
 * const result = await entityExists('campaigns', 'abc123')
 * if (result.success && result.data) {
 *   console.log('Entity exists')
 * }
 * ```
 */
export async function entityExists(
  entitySlug: string,
  id: string
): Promise<EntityActionResult<boolean>> {
  try {
    if (!id?.trim()) {
      return { success: false, error: 'Entity ID is required' }
    }

    // Validate entity exists in registry (consistency with other actions)
    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // Check permission (read permission for exists check)
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.read`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    // SECURITY: Pass teamId to prevent cross-team access for multi-team users
    const exists = await GenericEntityService.exists(entitySlug, id, userId, teamId)

    return { success: true, data: exists }
  } catch (error) {
    console.error(`[entityExists] Error checking ${entitySlug}/${id}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// COUNT ENTITIES
// ============================================================================

/**
 * Count entities with optional filtering
 *
 * Auth is automatically obtained from session/cookies.
 * Permissions are checked against the permissions registry before executing.
 *
 * @param entitySlug - The entity type slug
 * @param where - Filter conditions
 * @returns Count of matching entities
 *
 * @example
 * ```typescript
 * const result = await countEntities('campaigns', { status: 'active' })
 * if (result.success) {
 *   console.log(`Found ${result.data} active campaigns`)
 * }
 * ```
 */
export async function countEntities(
  entitySlug: string,
  where?: Record<string, unknown>
): Promise<EntityActionResult<number>> {
  try {
    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return {
        success: false,
        error: `Entity "${entitySlug}" not found in registry`,
      }
    }

    // Get auth context from session/cookies
    const authContext = await getAuthContext()
    if (!authContext.success) {
      return { success: false, error: authContext.error }
    }
    const { userId, teamId } = authContext

    // Check permission (list permission for count)
    const hasPermission = await checkPermission(userId, teamId, `${entitySlug}.list`)
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' }
    }

    // SECURITY: Include teamId to filter by team (prevent cross-team data access)
    const count = await GenericEntityService.count(entitySlug, userId, { ...where, teamId })

    return { success: true, data: count }
  } catch (error) {
    console.error(`[countEntities] Error counting ${entitySlug}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
