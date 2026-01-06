/**
 * Lists Service
 * Provides data access methods for lists entity.
 */
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

export interface List {
  id: string
  name: string
  boardId: string
  position: number
  isArchived: boolean
  userId: string
  teamId: string
  createdAt: Date
  updatedAt: Date
}

export interface ListListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  teamId?: string
  boardId?: string
  isArchived?: boolean
}

export interface ListListResult {
  lists: List[]
  total: number
}

export interface ListCreateData {
  name: string
  boardId: string
  position?: number
  isArchived?: boolean
  teamId: string
}

export interface ListUpdateData {
  name?: string
  boardId?: string
  position?: number
  isArchived?: boolean
}

interface DbList {
  id: string
  name: string
  board_id: string
  position: number
  is_archived: boolean
  user_id: string
  team_id: string
  created_at: string
  updated_at: string
}

function mapDbList(dbList: DbList): List {
  return {
    id: dbList.id,
    name: dbList.name,
    boardId: dbList.board_id,
    position: dbList.position,
    isArchived: dbList.is_archived,
    userId: dbList.user_id,
    teamId: dbList.team_id,
    createdAt: new Date(dbList.created_at),
    updatedAt: new Date(dbList.updated_at),
  }
}

export class ListsService {
  /**
   * Get a list by ID with RLS
   */
  static async getById(id: string, userId: string): Promise<List | null> {
    const result = await queryOneWithRLS<DbList>(
      userId,
      `SELECT * FROM lists WHERE id = $1`,
      [id]
    )

    return result ? mapDbList(result) : null
  }

  /**
   * List lists with RLS and filtering
   */
  static async list(userId: string, options: ListListOptions = {}): Promise<ListListResult> {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'position',
      orderDir = 'asc',
      teamId,
      boardId,
      isArchived,
    } = options

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (teamId) {
      conditions.push(`team_id = $${paramIndex++}`)
      params.push(teamId)
    }

    if (boardId) {
      conditions.push(`board_id = $${paramIndex++}`)
      params.push(boardId)
    }

    if (isArchived !== undefined) {
      conditions.push(`is_archived = $${paramIndex++}`)
      params.push(isArchived)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await queryOneWithRLS<{ count: string }>(
      userId,
      `SELECT COUNT(*) as count FROM lists ${whereClause}`,
      params
    )
    const total = parseInt(countResult?.count || '0', 10)

    // Get lists
    const validOrderBy = ['position', 'name', 'created_at', 'updated_at'].includes(orderBy)
      ? orderBy
      : 'position'
    const validOrderDir = orderDir === 'desc' ? 'DESC' : 'ASC'

    params.push(limit, offset)
    const lists = await queryWithRLS<DbList>(
      userId,
      `SELECT * FROM lists ${whereClause} ORDER BY ${validOrderBy} ${validOrderDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    )

    return {
      lists: lists.map(mapDbList),
      total,
    }
  }

  /**
   * Get all lists for a specific board
   */
  static async getByBoard(boardId: string, userId: string): Promise<List[]> {
    const result = await this.list(userId, {
      boardId,
      orderBy: 'position',
      orderDir: 'asc',
      isArchived: false,
    })

    return result.lists
  }

  /**
   * Create a new list with RLS
   */
  static async create(userId: string, data: ListCreateData): Promise<List> {
    const {
      name,
      boardId,
      position = 0,
      isArchived = false,
      teamId,
    } = data

    const result = await mutateWithRLS<DbList>(
      userId,
      `INSERT INTO lists (name, board_id, position, is_archived, user_id, team_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, boardId, position, isArchived, userId, teamId]
    )

    if (!result) {
      throw new Error('Failed to create list')
    }

    return mapDbList(result)
  }

  /**
   * Update a list with RLS
   */
  static async update(userId: string, id: string, data: ListUpdateData): Promise<List> {
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      params.push(data.name)
    }

    if (data.boardId !== undefined) {
      updates.push(`board_id = $${paramIndex++}`)
      params.push(data.boardId)
    }

    if (data.position !== undefined) {
      updates.push(`position = $${paramIndex++}`)
      params.push(data.position)
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

    const result = await mutateWithRLS<DbList>(
      userId,
      `UPDATE lists SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )

    if (!result) {
      throw new Error('List not found or access denied')
    }

    return mapDbList(result)
  }

  /**
   * Delete a list with RLS
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    const result = await mutateWithRLS<DbList>(
      userId,
      `DELETE FROM lists WHERE id = $1 RETURNING *`,
      [id]
    )

    return result !== null
  }
}
