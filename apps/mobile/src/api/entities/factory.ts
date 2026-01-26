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
 * @example
 * ```typescript
 * const tasksApi = createEntityApi<Task, CreateTaskInput, UpdateTaskInput>('tasks')
 *
 * // List tasks
 * const { data, meta } = await tasksApi.list({ page: 1, limit: 10 })
 *
 * // Get single task
 * const { data: task } = await tasksApi.get('task-id')
 *
 * // Create task
 * const { data: newTask } = await tasksApi.create({ title: 'New Task' })
 *
 * // Update task
 * const { data: updated } = await tasksApi.update('task-id', { status: 'done' })
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
     */
    list: (params?: EntityListParams) =>
      apiClient.get<PaginatedResponse<T>>(basePath, params),

    /**
     * Get a single entity by ID
     */
    get: (id: string) =>
      apiClient.get<SingleResponse<T>>(`${basePath}/${id}`),

    /**
     * Create a new entity
     */
    create: (data: CreateInput) =>
      apiClient.post<SingleResponse<T>>(basePath, data),

    /**
     * Update an existing entity
     */
    update: (id: string, data: UpdateInput) =>
      apiClient.patch<SingleResponse<T>>(`${basePath}/${id}`, data),

    /**
     * Delete an entity
     */
    delete: (id: string) =>
      apiClient.delete(`${basePath}/${id}`),
  }
}
