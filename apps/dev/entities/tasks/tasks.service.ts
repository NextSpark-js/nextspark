/**
 * Tasks Service
 *
 * Provides data access methods for tasks.
 * Tasks is a private entity with shared: false - users only see their own tasks.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module TasksService
 */

import { queryOneWithRLS, queryWithRLS } from '@nextsparkjs/core/lib/db'
import type {
  Task,
  TaskListOptions,
  TaskListResult,
  TaskStatus,
  TaskPriority,
} from './tasks.types'

// Database row type for task
interface DbTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  tags: string[] | null
  dueDate: string | null
  estimatedHours: number | null
  completed: boolean | null
  createdAt: string
  updatedAt: string
}

export class TasksService {
  // ============================================
  // AUTHENTICATED METHODS (con RLS)
  // ============================================

  /**
   * Get a task by ID
   *
   * Respects RLS policies. Since tasks has shared: false,
   * only the task owner can access it.
   *
   * @param id - Task ID
   * @param userId - Current user ID for RLS
   * @returns Task data or null if not found/not authorized
   *
   * @example
   * const task = await TasksService.getById('task-uuid', currentUserId)
   */
  static async getById(
    id: string,
    userId: string
  ): Promise<Task | null> {
    try {
      if (!id || id.trim() === '') {
        throw new Error('Task ID is required')
      }

      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const task = await queryOneWithRLS<DbTask>(
        `
        SELECT
          id,
          title,
          description,
          status,
          priority,
          tags,
          "dueDate",
          "estimatedHours",
          completed,
          "createdAt",
          "updatedAt"
        FROM tasks
        WHERE id = $1
        `,
        [id],
        userId
      )

      if (!task) {
        return null
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description ?? undefined,
        status: task.status,
        priority: task.priority,
        tags: task.tags ?? undefined,
        dueDate: task.dueDate ?? undefined,
        estimatedHours: task.estimatedHours ?? undefined,
        completed: task.completed ?? undefined,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }
    } catch (error) {
      console.error('TasksService.getById error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch task'
      )
    }
  }

  /**
   * List tasks with pagination and filtering
   *
   * @param userId - Current user ID for RLS
   * @param options - List options (limit, offset, status, priority, orderBy, orderDir)
   * @returns Object with tasks array and total count
   *
   * @example
   * const { tasks, total } = await TasksService.list(currentUserId, {
   *   status: 'todo',
   *   limit: 10
   * })
   */
  static async list(
    userId: string,
    options: TaskListOptions = {}
  ): Promise<TaskListResult> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const {
        limit = 10,
        offset = 0,
        status,
        priority,
        orderBy = 'createdAt',
        orderDir = 'desc',
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (status) {
        conditions.push(`status = $${paramIndex}`)
        params.push(status)
        paramIndex++
      }

      if (priority) {
        conditions.push(`priority = $${paramIndex}`)
        params.push(priority)
        paramIndex++
      }

      if (options.teamId) {
        conditions.push(`"teamId" = $${paramIndex}`)
        params.push(options.teamId)
        paramIndex++
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy to prevent SQL injection
      const validOrderBy = ['title', 'status', 'priority', 'dueDate', 'createdAt'].includes(orderBy)
        ? orderBy
        : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'

      // Map field names to database columns
      const orderColumnMap: Record<string, string> = {
        title: 'title',
        status: 'status',
        priority: 'priority',
        dueDate: '"dueDate"',
        createdAt: '"createdAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM tasks ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get tasks
      params.push(limit, offset)
      const tasks = await queryWithRLS<DbTask>(
        `
        SELECT
          id,
          title,
          description,
          status,
          priority,
          tags,
          "dueDate",
          "estimatedHours",
          completed,
          "createdAt",
          "updatedAt"
        FROM tasks
        ${whereClause}
        ORDER BY ${orderColumn} ${validOrderDir}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        params,
        userId
      )

      return {
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description ?? undefined,
          status: task.status,
          priority: task.priority,
          tags: task.tags ?? undefined,
          dueDate: task.dueDate ?? undefined,
          estimatedHours: task.estimatedHours ?? undefined,
          completed: task.completed ?? undefined,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('TasksService.list error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to list tasks'
      )
    }
  }

  /**
   * Get tasks by status
   *
   * Convenience method to fetch all tasks with a specific status.
   *
   * @param userId - Current user ID for RLS
   * @param status - Task status to filter by
   * @returns Array of tasks with the given status
   *
   * @example
   * const todoTasks = await TasksService.getByStatus(currentUserId, 'todo')
   */
  static async getByStatus(
    userId: string,
    status: TaskStatus
  ): Promise<Task[]> {
    try {
      const { tasks } = await this.list(userId, {
        status,
        limit: 1000, // Large limit to get all matching tasks
        orderBy: 'priority',
        orderDir: 'desc',
      })

      return tasks
    } catch (error) {
      console.error('TasksService.getByStatus error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch tasks by status'
      )
    }
  }

  /**
   * Get overdue tasks
   *
   * Fetches tasks that are past their due date and not completed.
   *
   * @param userId - Current user ID for RLS
   * @returns Array of overdue tasks
   *
   * @example
   * const overdueTasks = await TasksService.getOverdue(currentUserId)
   */
  static async getOverdue(userId: string): Promise<Task[]> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const tasks = await queryWithRLS<DbTask>(
        `
        SELECT
          id,
          title,
          description,
          status,
          priority,
          tags,
          "dueDate",
          "estimatedHours",
          completed,
          "createdAt",
          "updatedAt"
        FROM tasks
        WHERE "dueDate" < CURRENT_DATE
          AND status != 'done'
          AND (completed IS NULL OR completed = false)
        ORDER BY "dueDate" ASC
        `,
        [],
        userId
      )

      return tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description ?? undefined,
        status: task.status,
        priority: task.priority,
        tags: task.tags ?? undefined,
        dueDate: task.dueDate ?? undefined,
        estimatedHours: task.estimatedHours ?? undefined,
        completed: task.completed ?? undefined,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }))
    } catch (error) {
      console.error('TasksService.getOverdue error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch overdue tasks'
      )
    }
  }

  // ============================================
  // WRITE METHODS (con RLS)
  // ============================================

  /**
   * Create a new task
   *
   * @param userId - Current user ID for RLS
   * @param data - Task data
   * @returns Created task
   *
   * @example
   * const task = await TasksService.create(currentUserId, {
   *   title: 'New Task',
   *   teamId: 'team-123'
   * })
   */
  static async create(
    userId: string,
    data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> & { teamId: string }
  ): Promise<Task> {
    try {
      if (!userId) throw new Error('User ID is required')
      if (!data.title) throw new Error('Title is required')
      if (!data.teamId) throw new Error('Team ID is required')

      const task = await queryOneWithRLS<DbTask>(
        `
        INSERT INTO tasks (
          id,
          title,
          description,
          status,
          priority,
          tags,
          "dueDate",
          "estimatedHours",
          completed,
          "createdAt",
          "updatedAt",
          "userId",
          "teamId"
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          NOW(),
          NOW(),
          $9,
          $10
        )
        RETURNING *
        `,
        [
          data.title,
          data.description || null,
          data.status || 'todo',
          data.priority || 'medium',
          data.tags || [],
          data.dueDate || null,
          data.estimatedHours || null,
          data.completed || false,
          userId,
          data.teamId
        ],
        userId
      )

      if (!task) throw new Error('Failed to create task')

      return {
        id: task.id,
        title: task.title,
        description: task.description ?? undefined,
        status: task.status,
        priority: task.priority,
        tags: task.tags ?? undefined,
        dueDate: task.dueDate ?? undefined,
        estimatedHours: task.estimatedHours ?? undefined,
        completed: task.completed ?? undefined,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }
    } catch (error) {
      console.error('TasksService.create error:', error)
      throw error
    }
  }

  /**
   * Update a task
   *
   * @param userId - Current user ID for RLS
   * @param id - Task ID
   * @param data - Data to update
   * @returns Updated task
   *
   * @example
   * const task = await TasksService.update(currentUserId, 'task-123', {
   *   status: 'done',
   *   completed: true
   * })
   */
  static async update(
    userId: string,
    id: string,
    data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Task> {
    try {
      if (!userId) throw new Error('User ID is required')
      if (!id) throw new Error('Task ID is required')

      // Build dynamic update query
      const updates: string[] = []
      const params: unknown[] = [id]
      let paramIndex = 2

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex}`)
        params.push(data.title)
        paramIndex++
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex}`)
        params.push(data.description)
        paramIndex++
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex}`)
        params.push(data.status)
        paramIndex++
      }
      if (data.priority !== undefined) {
        updates.push(`priority = $${paramIndex}`)
        params.push(data.priority)
        paramIndex++
      }
      if (data.tags !== undefined) {
        updates.push(`tags = $${paramIndex}`)
        params.push(data.tags)
        paramIndex++
      }
      if (data.dueDate !== undefined) {
        updates.push(`"dueDate" = $${paramIndex}`)
        params.push(data.dueDate)
        paramIndex++
      }
      if (data.estimatedHours !== undefined) {
        updates.push(`"estimatedHours" = $${paramIndex}`)
        params.push(data.estimatedHours)
        paramIndex++
      }
      if (data.completed !== undefined) {
        updates.push(`completed = $${paramIndex}`)
        params.push(data.completed)
        paramIndex++
      }

      updates.push(`"updatedAt" = NOW()`)

      if (updates.length === 1) { // Only updatedAt
        // Nothing to update
        const current = await this.getById(id, userId)
        if (!current) throw new Error('Task not found')
        return current
      }

      const task = await queryOneWithRLS<DbTask>(
        `
        UPDATE tasks
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING *
        `,
        params,
        userId
      )

      if (!task) throw new Error('Task not found or update failed')

      return {
        id: task.id,
        title: task.title,
        description: task.description ?? undefined,
        status: task.status,
        priority: task.priority,
        tags: task.tags ?? undefined,
        dueDate: task.dueDate ?? undefined,
        estimatedHours: task.estimatedHours ?? undefined,
        completed: task.completed ?? undefined,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }
    } catch (error) {
      console.error('TasksService.update error:', error)
      throw error
    }
  }
}
