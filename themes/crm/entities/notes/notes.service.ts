/**
 * Notes Service
 *
 * Provides data access methods for notes.
 * Notes is a private entity - users only see notes in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module NotesService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Note interface
export interface Note {
  id: string
  content: string
  relatedTo?: string
  relatedId?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface NoteListOptions {
  limit?: number
  offset?: number
  relatedTo?: string
  relatedId?: string
  orderBy?: 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface NoteListResult {
  notes: Note[]
  total: number
}

// Create data
export interface NoteCreateData {
  content: string
  relatedTo?: string
  relatedId?: string
  teamId: string
}

// Update data
export interface NoteUpdateData {
  content?: string
  relatedTo?: string
  relatedId?: string
}

// Database row type
interface DbNote {
  id: string
  content: string
  relatedTo: string | null
  relatedId: string | null
  createdAt: string
  updatedAt: string
}

export class NotesService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a note by ID
   */
  static async getById(id: string, userId: string): Promise<Note | null> {
    try {
      if (!id?.trim()) throw new Error('Note ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const note = await queryOneWithRLS<DbNote>(
        `SELECT id, content, "relatedTo", "relatedId", "createdAt", "updatedAt"
         FROM notes WHERE id = $1`,
        [id],
        userId
      )

      if (!note) return null

      return {
        id: note.id,
        content: note.content,
        relatedTo: note.relatedTo ?? undefined,
        relatedId: note.relatedId ?? undefined,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }
    } catch (error) {
      console.error('NotesService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch note')
    }
  }

  /**
   * List notes with pagination and filtering
   */
  static async list(userId: string, options: NoteListOptions = {}): Promise<NoteListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        relatedTo,
        relatedId,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (relatedTo) {
        conditions.push(`"relatedTo" = $${paramIndex++}`)
        params.push(relatedTo)
      }

      if (relatedId) {
        conditions.push(`"relatedId" = $${paramIndex++}`)
        params.push(relatedId)
      }

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM notes ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get notes
      params.push(limit, offset)
      const notes = await queryWithRLS<DbNote>(
        `SELECT id, content, "relatedTo", "relatedId", "createdAt", "updatedAt"
         FROM notes ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        notes: notes.map((note) => ({
          id: note.id,
          content: note.content,
          relatedTo: note.relatedTo ?? undefined,
          relatedId: note.relatedId ?? undefined,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('NotesService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list notes')
    }
  }

  /**
   * Get notes related to an entity
   */
  static async getByRelatedEntity(userId: string, relatedTo: string, relatedId: string, limit = 50): Promise<Note[]> {
    const { notes } = await this.list(userId, {
      relatedTo,
      relatedId,
      limit,
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    return notes
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new note
   */
  static async create(userId: string, data: NoteCreateData): Promise<Note> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.content?.trim()) throw new Error('Content is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbNote>(
        `INSERT INTO notes (id, "userId", "teamId", content, "relatedTo", "relatedId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, content, "relatedTo", "relatedId", "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.content,
          data.relatedTo || null,
          data.relatedId || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create note')

      const note = result.rows[0]
      return {
        id: note.id,
        content: note.content,
        relatedTo: note.relatedTo ?? undefined,
        relatedId: note.relatedId ?? undefined,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }
    } catch (error) {
      console.error('NotesService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create note')
    }
  }

  /**
   * Update an existing note
   */
  static async update(userId: string, id: string, data: NoteUpdateData): Promise<Note> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Note ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.content !== undefined) {
        updates.push(`content = $${paramIndex++}`)
        values.push(data.content)
      }
      if (data.relatedTo !== undefined) {
        updates.push(`"relatedTo" = $${paramIndex++}`)
        values.push(data.relatedTo || null)
      }
      if (data.relatedId !== undefined) {
        updates.push(`"relatedId" = $${paramIndex++}`)
        values.push(data.relatedId || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbNote>(
        `UPDATE notes SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, content, "relatedTo", "relatedId", "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Note not found or update failed')

      const note = result.rows[0]
      return {
        id: note.id,
        content: note.content,
        relatedTo: note.relatedTo ?? undefined,
        relatedId: note.relatedId ?? undefined,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }
    } catch (error) {
      console.error('NotesService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update note')
    }
  }

  /**
   * Delete a note
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Note ID is required')

      const result = await mutateWithRLS(`DELETE FROM notes WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('NotesService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete note')
    }
  }
}
