/**
 * Cards Service
 * Provides data access methods for cards entity.
 */
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

export interface Card {
  id: string
  title: string
  description: string | null
  listId: string
  boardId: string
  position: number
  dueDate: Date | null
  assigneeId: string | null
  labels: string[]
  isArchived: boolean
  userId: string
  teamId: string
  createdAt: Date
  updatedAt: Date
}

export interface CardListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  teamId?: string
  listId?: string
  boardId?: string
  assigneeId?: string
  isArchived?: boolean
}

export interface CardListResult {
  cards: Card[]
  total: number
}

export interface CardCreateData {
  title: string
  description?: string | null
  listId: string
  boardId: string
  position?: number
  dueDate?: Date | null
  assigneeId?: string | null
  labels?: string[]
  isArchived?: boolean
  teamId: string
}

export interface CardUpdateData {
  title?: string
  description?: string | null
  listId?: string
  boardId?: string
  position?: number
  dueDate?: Date | null
  assigneeId?: string | null
  labels?: string[]
  isArchived?: boolean
}

interface DbCard {
  id: string
  title: string
  description: string | null
  list_id: string
  board_id: string
  position: number
  due_date: string | null
  assignee_id: string | null
  labels: string
  is_archived: boolean
  user_id: string
  team_id: string
  created_at: string
  updated_at: string
}

function mapDbCard(dbCard: DbCard): Card {
  return {
    id: dbCard.id,
    title: dbCard.title,
    description: dbCard.description,
    listId: dbCard.list_id,
    boardId: dbCard.board_id,
    position: dbCard.position,
    dueDate: dbCard.due_date ? new Date(dbCard.due_date) : null,
    assigneeId: dbCard.assignee_id,
    labels: dbCard.labels ? JSON.parse(dbCard.labels) : [],
    isArchived: dbCard.is_archived,
    userId: dbCard.user_id,
    teamId: dbCard.team_id,
    createdAt: new Date(dbCard.created_at),
    updatedAt: new Date(dbCard.updated_at),
  }
}

export class CardsService {
  /**
   * Get a card by ID with RLS
   */
  static async getById(id: string, userId: string): Promise<Card | null> {
    const result = await queryOneWithRLS<DbCard>(
      userId,
      `SELECT * FROM cards WHERE id = $1`,
      [id]
    )

    return result ? mapDbCard(result) : null
  }

  /**
   * List cards with RLS and filtering
   */
  static async list(userId: string, options: CardListOptions = {}): Promise<CardListResult> {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'position',
      orderDir = 'asc',
      teamId,
      listId,
      boardId,
      assigneeId,
      isArchived,
    } = options

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (teamId) {
      conditions.push(`team_id = $${paramIndex++}`)
      params.push(teamId)
    }

    if (listId) {
      conditions.push(`list_id = $${paramIndex++}`)
      params.push(listId)
    }

    if (boardId) {
      conditions.push(`board_id = $${paramIndex++}`)
      params.push(boardId)
    }

    if (assigneeId) {
      conditions.push(`assignee_id = $${paramIndex++}`)
      params.push(assigneeId)
    }

    if (isArchived !== undefined) {
      conditions.push(`is_archived = $${paramIndex++}`)
      params.push(isArchived)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await queryOneWithRLS<{ count: string }>(
      userId,
      `SELECT COUNT(*) as count FROM cards ${whereClause}`,
      params
    )
    const total = parseInt(countResult?.count || '0', 10)

    // Get cards
    const validOrderBy = ['position', 'title', 'due_date', 'created_at', 'updated_at'].includes(orderBy)
      ? orderBy
      : 'position'
    const validOrderDir = orderDir === 'desc' ? 'DESC' : 'ASC'

    params.push(limit, offset)
    const cards = await queryWithRLS<DbCard>(
      userId,
      `SELECT * FROM cards ${whereClause} ORDER BY ${validOrderBy} ${validOrderDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    )

    return {
      cards: cards.map(mapDbCard),
      total,
    }
  }

  /**
   * Get all cards for a specific list
   */
  static async getByList(listId: string, userId: string): Promise<Card[]> {
    const result = await this.list(userId, {
      listId,
      orderBy: 'position',
      orderDir: 'asc',
      isArchived: false,
    })

    return result.cards
  }

  /**
   * Create a new card with RLS
   */
  static async create(userId: string, data: CardCreateData): Promise<Card> {
    const {
      title,
      description = null,
      listId,
      boardId,
      position = 0,
      dueDate = null,
      assigneeId = null,
      labels = [],
      isArchived = false,
      teamId,
    } = data

    const result = await mutateWithRLS<DbCard>(
      userId,
      `INSERT INTO cards (title, description, list_id, board_id, position, due_date, assignee_id, labels, is_archived, user_id, team_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [title, description, listId, boardId, position, dueDate, assigneeId, JSON.stringify(labels), isArchived, userId, teamId]
    )

    if (!result) {
      throw new Error('Failed to create card')
    }

    return mapDbCard(result)
  }

  /**
   * Update a card with RLS
   */
  static async update(userId: string, id: string, data: CardUpdateData): Promise<Card> {
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      params.push(data.title)
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      params.push(data.description)
    }

    if (data.listId !== undefined) {
      updates.push(`list_id = $${paramIndex++}`)
      params.push(data.listId)
    }

    if (data.boardId !== undefined) {
      updates.push(`board_id = $${paramIndex++}`)
      params.push(data.boardId)
    }

    if (data.position !== undefined) {
      updates.push(`position = $${paramIndex++}`)
      params.push(data.position)
    }

    if (data.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`)
      params.push(data.dueDate)
    }

    if (data.assigneeId !== undefined) {
      updates.push(`assignee_id = $${paramIndex++}`)
      params.push(data.assigneeId)
    }

    if (data.labels !== undefined) {
      updates.push(`labels = $${paramIndex++}`)
      params.push(JSON.stringify(data.labels))
    }

    if (data.isArchived !== undefined) {
      updates.push(`is_archived = $${paramIndex++}`)
      params.push(data.isArchived)
    }

    if (updates.length === 0) {
      throw new Error('No fields to update')
    }

    updates.push(`updated_at = NOW()`)
    params.push(id)

    const result = await mutateWithRLS<DbCard>(
      userId,
      `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )

    if (!result) {
      throw new Error('Card not found or access denied')
    }

    return mapDbCard(result)
  }

  /**
   * Move a card to a different list with new position
   */
  static async moveToList(
    cardId: string,
    userId: string,
    newListId: string,
    newPosition: number
  ): Promise<Card> {
    return this.update(userId, cardId, {
      listId: newListId,
      position: newPosition,
    })
  }

  /**
   * Delete a card with RLS
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    const result = await mutateWithRLS<DbCard>(
      userId,
      `DELETE FROM cards WHERE id = $1 RETURNING *`,
      [id]
    )

    return result !== null
  }
}
