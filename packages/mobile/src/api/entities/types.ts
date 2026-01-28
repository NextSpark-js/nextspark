/**
 * Entity API Types
 *
 * Generic types for entity CRUD operations.
 */

import type { PaginatedResponse, SingleResponse } from '../client.types'

/**
 * Parameters for listing entities
 */
export interface EntityListParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  [key: string]: string | number | boolean | undefined
}

/**
 * Generic entity API interface
 * Matches NextSpark web BaseEntityService pattern
 *
 * Note: get, create, and update return the entity directly (T),
 * not wrapped in SingleResponse<T>. This provides a cleaner API.
 */
export interface EntityApi<T, CreateInput, UpdateInput> {
  list: (params?: EntityListParams) => Promise<PaginatedResponse<T>>
  get: (id: string) => Promise<T>
  create: (data: CreateInput) => Promise<T>
  update: (id: string, data: UpdateInput) => Promise<T>
  delete: (id: string) => Promise<void>
}
