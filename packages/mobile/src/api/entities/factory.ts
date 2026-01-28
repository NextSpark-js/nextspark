/**
 * Entity API Factory
 *
 * Factory function to create typed API clients for any entity.
 * Follows the same pattern as BaseEntityService in NextSpark web.
 */

import { apiClient } from '../client'
import type { PaginatedResponse, SingleResponse } from '../client.types'
import type { EntityApi, EntityListParams } from './types'

/**
 * Create an API client for an entity
 *
 * @param entityPath - The entity path (e.g., 'tasks', 'customers')
 * @returns Typed API client with CRUD operations
 *
 * Note: This factory assumes entities have an `id: string` field for get/update/delete operations.
 * We intentionally don't enforce this via generic constraints to maintain flexibility for
 * entities with different ID field names or types.
 *
 * @example
 * ```typescript
 * const tasksApi = createEntityApi<Task, CreateTaskInput, UpdateTaskInput>('tasks')
 *
 * // List tasks (returns PaginatedResponse)
 * const { data, meta } = await tasksApi.list({ page: 1, limit: 10 })
 *
 * // Get single task (returns entity directly)
 * const task = await tasksApi.get('task-id')
 *
 * // Create task (returns entity directly)
 * const newTask = await tasksApi.create({ title: 'New Task' })
 *
 * // Update task (returns entity directly)
 * const updated = await tasksApi.update('task-id', { status: 'done' })
 *
 * // Delete task
 * await tasksApi.delete('task-id')
 * ```
 */
export function createEntityApi<T, CreateInput = Partial<T>, UpdateInput = Partial<T>>(
  entityPath: string
): EntityApi<T, CreateInput, UpdateInput> {
  const basePath = `/api/v1/${entityPath}`

  return {
    /**
     * List entities with pagination and filters
     * Returns PaginatedResponse with data array and meta
     */
    list: (params?: EntityListParams) =>
      apiClient.get<PaginatedResponse<T>>(basePath, params),

    /**
     * Get a single entity by ID
     * Returns the entity directly (unwrapped from SingleResponse)
     */
    get: async (id: string): Promise<T> => {
      const response = await apiClient.get<SingleResponse<T>>(`${basePath}/${id}`)
      return response.data
    },

    /**
     * Create a new entity
     * Returns the created entity directly (unwrapped from SingleResponse)
     */
    create: async (data: CreateInput): Promise<T> => {
      const response = await apiClient.post<SingleResponse<T>>(basePath, data)
      return response.data
    },

    /**
     * Update an existing entity
     * Returns the updated entity directly (unwrapped from SingleResponse)
     */
    update: async (id: string, data: UpdateInput): Promise<T> => {
      const response = await apiClient.patch<SingleResponse<T>>(`${basePath}/${id}`, data)
      return response.data
    },

    /**
     * Delete an entity
     * Returns void (no content expected from DELETE operations)
     */
    delete: (id: string): Promise<void> =>
      apiClient.delete<void>(`${basePath}/${id}`),
  }
}
