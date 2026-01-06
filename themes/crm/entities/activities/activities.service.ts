/**
 * Activities Service
 *
 * Provides data access methods for activities.
 * Activities is a private entity - users only see activities in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module ActivitiesService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Activity type
export type ActivityType = 'call' | 'email' | 'meeting' | 'task'

// Activity status type
export type ActivityStatus = 'scheduled' | 'completed' | 'cancelled'

// Activity interface
export interface Activity {
  id: string
  type: ActivityType
  subject: string
  description?: string
  status: ActivityStatus
  dueDate?: string
  completedAt?: string
  assignedTo?: string
  relatedTo?: string
  relatedId?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface ActivityListOptions {
  limit?: number
  offset?: number
  type?: ActivityType
  status?: ActivityStatus
  assignedTo?: string
  relatedTo?: string
  relatedId?: string
  orderBy?: 'subject' | 'dueDate' | 'completedAt' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface ActivityListResult {
  activities: Activity[]
  total: number
}

// Create data
export interface ActivityCreateData {
  type: ActivityType
  subject: string
  description?: string
  status?: ActivityStatus
  dueDate?: string
  completedAt?: string
  assignedTo?: string
  relatedTo?: string
  relatedId?: string
  teamId: string
}

// Update data
export interface ActivityUpdateData {
  type?: ActivityType
  subject?: string
  description?: string
  status?: ActivityStatus
  dueDate?: string
  completedAt?: string
  assignedTo?: string
  relatedTo?: string
  relatedId?: string
}

// Database row type
interface DbActivity {
  id: string
  type: ActivityType
  subject: string
  description: string | null
  status: ActivityStatus
  dueDate: string | null
  completedAt: string | null
  assignedTo: string | null
  relatedTo: string | null
  relatedId: string | null
  createdAt: string
  updatedAt: string
}

export class ActivitiesService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get an activity by ID
   */
  static async getById(id: string, userId: string): Promise<Activity | null> {
    try {
      if (!id?.trim()) throw new Error('Activity ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const activity = await queryOneWithRLS<DbActivity>(
        `SELECT id, type, subject, description, status, "dueDate", "completedAt", "assignedTo", "relatedTo", "relatedId", "createdAt", "updatedAt"
         FROM activities WHERE id = $1`,
        [id],
        userId
      )

      if (!activity) return null

      return {
        id: activity.id,
        type: activity.type,
        subject: activity.subject,
        description: activity.description ?? undefined,
        status: activity.status,
        dueDate: activity.dueDate ?? undefined,
        completedAt: activity.completedAt ?? undefined,
        assignedTo: activity.assignedTo ?? undefined,
        relatedTo: activity.relatedTo ?? undefined,
        relatedId: activity.relatedId ?? undefined,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
      }
    } catch (error) {
      console.error('ActivitiesService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch activity')
    }
  }

  /**
   * List activities with pagination and filtering
   */
  static async list(userId: string, options: ActivityListOptions = {}): Promise<ActivityListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        type,
        status,
        assignedTo,
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

      if (type) {
        conditions.push(`type = $${paramIndex++}`)
        params.push(type)
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      if (assignedTo) {
        conditions.push(`"assignedTo" = $${paramIndex++}`)
        params.push(assignedTo)
      }

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
      const validOrderBy = ['subject', 'dueDate', 'completedAt', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        subject: 'subject',
        dueDate: '"dueDate"',
        completedAt: '"completedAt"',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM activities ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get activities
      params.push(limit, offset)
      const activities = await queryWithRLS<DbActivity>(
        `SELECT id, type, subject, description, status, "dueDate", "completedAt", "assignedTo", "relatedTo", "relatedId", "createdAt", "updatedAt"
         FROM activities ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        activities: activities.map((activity) => ({
          id: activity.id,
          type: activity.type,
          subject: activity.subject,
          description: activity.description ?? undefined,
          status: activity.status,
          dueDate: activity.dueDate ?? undefined,
          completedAt: activity.completedAt ?? undefined,
          assignedTo: activity.assignedTo ?? undefined,
          relatedTo: activity.relatedTo ?? undefined,
          relatedId: activity.relatedId ?? undefined,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('ActivitiesService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list activities')
    }
  }

  /**
   * Get activities by type
   */
  static async getByType(userId: string, type: ActivityType, limit = 50): Promise<Activity[]> {
    const { activities } = await this.list(userId, {
      type,
      limit,
      orderBy: 'dueDate',
      orderDir: 'asc',
    })
    return activities
  }

  /**
   * Get activities by status
   */
  static async getByStatus(userId: string, status: ActivityStatus, limit = 50): Promise<Activity[]> {
    const { activities } = await this.list(userId, {
      status,
      limit,
      orderBy: 'dueDate',
      orderDir: 'asc',
    })
    return activities
  }

  /**
   * Get activities related to an entity
   */
  static async getByRelatedEntity(userId: string, relatedTo: string, relatedId: string, limit = 50): Promise<Activity[]> {
    const { activities } = await this.list(userId, {
      relatedTo,
      relatedId,
      limit,
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    return activities
  }

  /**
   * Get overdue activities
   */
  static async getOverdue(userId: string, limit = 20): Promise<Activity[]> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const activities = await queryWithRLS<DbActivity>(
        `SELECT id, type, subject, description, status, "dueDate", "completedAt", "assignedTo", "relatedTo", "relatedId", "createdAt", "updatedAt"
         FROM activities
         WHERE status = 'scheduled'
           AND "dueDate" IS NOT NULL
           AND "dueDate" < CURRENT_DATE
         ORDER BY "dueDate" ASC
         LIMIT $1`,
        [limit],
        userId
      )

      return activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        subject: activity.subject,
        description: activity.description ?? undefined,
        status: activity.status,
        dueDate: activity.dueDate ?? undefined,
        completedAt: activity.completedAt ?? undefined,
        assignedTo: activity.assignedTo ?? undefined,
        relatedTo: activity.relatedTo ?? undefined,
        relatedId: activity.relatedId ?? undefined,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
      }))
    } catch (error) {
      console.error('ActivitiesService.getOverdue error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch overdue activities')
    }
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new activity
   */
  static async create(userId: string, data: ActivityCreateData): Promise<Activity> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.subject?.trim()) throw new Error('Subject is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbActivity>(
        `INSERT INTO activities (id, "userId", "teamId", type, subject, description, status, "dueDate", "completedAt", "assignedTo", "relatedTo", "relatedId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, type, subject, description, status, "dueDate", "completedAt", "assignedTo", "relatedTo", "relatedId", "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.type,
          data.subject,
          data.description || null,
          data.status || 'scheduled',
          data.dueDate || null,
          data.completedAt || null,
          data.assignedTo || null,
          data.relatedTo || null,
          data.relatedId || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create activity')

      const activity = result.rows[0]
      return {
        id: activity.id,
        type: activity.type,
        subject: activity.subject,
        description: activity.description ?? undefined,
        status: activity.status,
        dueDate: activity.dueDate ?? undefined,
        completedAt: activity.completedAt ?? undefined,
        assignedTo: activity.assignedTo ?? undefined,
        relatedTo: activity.relatedTo ?? undefined,
        relatedId: activity.relatedId ?? undefined,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
      }
    } catch (error) {
      console.error('ActivitiesService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create activity')
    }
  }

  /**
   * Update an existing activity
   */
  static async update(userId: string, id: string, data: ActivityUpdateData): Promise<Activity> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Activity ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.type !== undefined) {
        updates.push(`type = $${paramIndex++}`)
        values.push(data.type)
      }
      if (data.subject !== undefined) {
        updates.push(`subject = $${paramIndex++}`)
        values.push(data.subject)
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(data.description || null)
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(data.status)
      }
      if (data.dueDate !== undefined) {
        updates.push(`"dueDate" = $${paramIndex++}`)
        values.push(data.dueDate || null)
      }
      if (data.completedAt !== undefined) {
        updates.push(`"completedAt" = $${paramIndex++}`)
        values.push(data.completedAt || null)
      }
      if (data.assignedTo !== undefined) {
        updates.push(`"assignedTo" = $${paramIndex++}`)
        values.push(data.assignedTo || null)
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

      const result = await mutateWithRLS<DbActivity>(
        `UPDATE activities SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, type, subject, description, status, "dueDate", "completedAt", "assignedTo", "relatedTo", "relatedId", "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Activity not found or update failed')

      const activity = result.rows[0]
      return {
        id: activity.id,
        type: activity.type,
        subject: activity.subject,
        description: activity.description ?? undefined,
        status: activity.status,
        dueDate: activity.dueDate ?? undefined,
        completedAt: activity.completedAt ?? undefined,
        assignedTo: activity.assignedTo ?? undefined,
        relatedTo: activity.relatedTo ?? undefined,
        relatedId: activity.relatedId ?? undefined,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
      }
    } catch (error) {
      console.error('ActivitiesService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update activity')
    }
  }

  /**
   * Delete an activity
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Activity ID is required')

      const result = await mutateWithRLS(`DELETE FROM activities WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('ActivitiesService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete activity')
    }
  }

  /**
   * Mark an activity as completed
   */
  static async complete(userId: string, id: string): Promise<Activity> {
    return this.update(userId, id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
  }
}
