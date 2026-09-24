/**
 * Card Service Types
 *
 * Type definitions for the CardsService.
 * Cards represent individual tasks or items within a list.
 *
 * @module CardsTypes
 */

// Card label interface
export interface CardLabel {
  id: string
  name: string
  color: string
}

// Main entity interface
export interface Card {
  id: string
  title: string
  description: string | null
  listId: string
  boardId: string | null
  position: number
  dueDate: string | null
  assigneeId: string | null
  labels: CardLabel[]
  isArchived: boolean
  teamId: string
  userId: string
  createdAt: string
  updatedAt: string
}

// List options
export interface CardListOptions {
  limit?: number
  offset?: number
  teamId?: string
  listId?: string
  boardId?: string
  assigneeId?: string
  isArchived?: boolean
  orderBy?: 'title' | 'position' | 'dueDate' | 'createdAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface CardListResult {
  cards: Card[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface CardCreateData {
  title: string
  listId: string
  teamId: string
  description?: string
  boardId?: string
  position?: number
  dueDate?: string
  assigneeId?: string
  labels?: CardLabel[]
  isArchived?: boolean
}

// Update data (all fields optional)
export interface CardUpdateData {
  title?: string
  description?: string | null
  listId?: string
  boardId?: string | null
  position?: number
  dueDate?: string | null
  assigneeId?: string | null
  labels?: CardLabel[]
  isArchived?: boolean
}
