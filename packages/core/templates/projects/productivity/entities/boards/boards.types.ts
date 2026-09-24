/**
 * Board Service Types
 *
 * Type definitions for the BoardsService.
 * Boards represent workspaces that contain lists and cards for project organization.
 *
 * @module BoardsTypes
 */

// Main entity interface
export interface Board {
  id: string
  name: string
  description: string | null
  color: string | null
  isArchived: boolean
  position: number
  teamId: string
  userId: string
  createdAt: string
  updatedAt: string
}

// List options
export interface BoardListOptions {
  limit?: number
  offset?: number
  teamId?: string
  isArchived?: boolean
  orderBy?: 'name' | 'position' | 'createdAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface BoardListResult {
  boards: Board[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface BoardCreateData {
  name: string
  teamId: string
  description?: string
  color?: string
  isArchived?: boolean
  position?: number
}

// Update data (all fields optional)
export interface BoardUpdateData {
  name?: string
  description?: string | null
  color?: string | null
  isArchived?: boolean
  position?: number
}
