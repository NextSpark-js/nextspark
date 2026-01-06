/**
 * Boards Service
 * Provides data access methods for boards entity.
 */
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

export interface Board {
  id: string
  name: string
  description: string | null
  color: string | null
  isArchived: boolean
  position: number
  userId: string
  teamId: string
  createdAt: Date
  updatedAt: Date
}

export interface BoardListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  teamId?: string
  isArchived?: boolean
}

export interface BoardListResult {
  boards: Board[]
  total: number
}

export interface BoardCreateData {
  name: string
  description?: string | null
  color?: string | null
  isArchived?: boolean
  position?: number
  teamId: string
}

export interface BoardUpdateData {
  name?: string
  description?: string | null
  color?: string | null
  isArchived?: boolean
  position?: number
}

interface DbBoard {
  id: string
  name: string
  description: string | null
  color: string | null
  is_archived: boolean
  position: number
  user_id: string
  team_id: string
  created_at: string
  updated_at: string
}

function mapDbBoard(dbBoard: DbBoard): Board {
  return {
    id: dbBoard.id,
    name: dbBoard.name,
    description: dbBoard.description,
    color: dbBoard.color,
    isArchived: dbBoard.is_archived,
    position: dbBoard.position,
    userId: dbBoard.user_id,
    teamId: dbBoard.team_id,
    createdAt: new Date(dbBoard.created_at),
    updatedAt: new Date(dbBoard.updated_at),
  }
}

export class BoardsService {
  /**
   * Get a board by ID with RLS
   */
  static async getById(id: string, userId: string): Promise<Board | null> {
    const result = await queryOneWithRLS<DbBoard>(
      userId,
      `SELECT * FROM boards WHERE id = $1`,
      [id]
    )

    return result ? mapDbBoard(result) : null
  }

  /**
   * List boards with RLS and filtering
   */
  static async list(userId: string, options: BoardListOptions = {}): Promise<BoardListResult> {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'position',
      orderDir = 'asc',
      teamId,
      isArchived,
    } = options

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (teamId) {
      conditions.push(`team_id = $${paramIndex++}`)
      params.push(teamId)
    }

    if (isArchived !== undefined) {
      conditions.push(`is_archived = $${paramIndex++}`)
      params.push(isArchived)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await queryOneWithRLS<{ count: string }>(
      userId,
      `SELECT COUNT(*) as count FROM boards ${whereClause}`,
      params
    )
    const total = parseInt(countResult?.count || '0', 10)

    // Get boards
    const validOrderBy = ['position', 'name', 'created_at', 'updated_at'].includes(orderBy)
      ? orderBy
      : 'position'
    const validOrderDir = orderDir === 'desc' ? 'DESC' : 'ASC'

    params.push(limit, offset)
    const boards = await queryWithRLS<DbBoard>(
      userId,
      `SELECT * FROM boards ${whereClause} ORDER BY ${validOrderBy} ${validOrderDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    )

    return {
      boards: boards.map(mapDbBoard),
      total,
    }
  }

  /**
   * Get boards ordered by position
   */
  static async getByPosition(userId: string, teamId?: string): Promise<Board[]> {
    const result = await this.list(userId, {
      orderBy: 'position',
      orderDir: 'asc',
      teamId,
      isArchived: false,
    })

    return result.boards
  }

  /**
   * Create a new board with RLS
   */
  static async create(userId: string, data: BoardCreateData): Promise<Board> {
    const {
      name,
      description = null,
      color = null,
      isArchived = false,
      position = 0,
      teamId,
    } = data

    const result = await mutateWithRLS<DbBoard>(
      userId,
      `INSERT INTO boards (name, description, color, is_archived, position, user_id, team_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description, color, isArchived, position, userId, teamId]
    )

    if (!result) {
      throw new Error('Failed to create board')
    }

    return mapDbBoard(result)
  }

  /**
   * Update a board with RLS
   */
  static async update(userId: string, id: string, data: BoardUpdateData): Promise<Board> {
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      params.push(data.name)
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      params.push(data.description)
    }

    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`)
      params.push(data.color)
    }

    if (data.isArchived !== undefined) {
      updates.push(`is_archived = $${paramIndex++}`)
      params.push(data.isArchived)
    }

    if (data.position !== undefined) {
      updates.push(`position = $${paramIndex++}`)
      params.push(data.position)
    }

    if (updates.length === 0) {
      throw new Error('No fields to update')
    }

    updates.push(`updated_at = NOW()`)
    params.push(id)

    const result = await mutateWithRLS<DbBoard>(
      userId,
      `UPDATE boards SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )

    if (!result) {
      throw new Error('Board not found or access denied')
    }

    return mapDbBoard(result)
  }

  /**
   * Delete a board with RLS
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    const result = await mutateWithRLS<DbBoard>(
      userId,
      `DELETE FROM boards WHERE id = $1 RETURNING *`,
      [id]
    )

    return result !== null
  }
}
