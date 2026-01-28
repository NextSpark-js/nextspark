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
 */
export interface EntityApi<T, CreateInput, UpdateInput> {
  list: (params?: EntityListParams) => Promise<PaginatedResponse<T>>
  get: (id: string) => Promise<SingleResponse<T>>
  create: (data: CreateInput) => Promise<SingleResponse<T>>
  update: (id: string, data: UpdateInput) => Promise<SingleResponse<T>>
  delete: (id: string) => Promise<void>
}
