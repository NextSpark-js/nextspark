/**
 * List Service Types
 *
 * Type definitions for the ListsService.
 * Lists represent columns within a board that contain cards.
 *
 * @module ListsTypes
 */

// Main entity interface
export interface List {
  id: string
  name: string
  boardId: string
  position: number
  isArchived: boolean
  teamId: string
  userId: string
  createdAt: string
  updatedAt: string
}

// List options
export interface ListListOptions {
  limit?: number
  offset?: number
  teamId?: string
  boardId?: string
  isArchived?: boolean
  orderBy?: 'name' | 'position' | 'createdAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface ListListResult {
  lists: List[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface ListCreateData {
  name: string
  boardId: string
  teamId: string
  position?: number
  isArchived?: boolean
}

// Update data (all fields optional)
export interface ListUpdateData {
  name?: string
  boardId?: string
  position?: number
  isArchived?: boolean
}
