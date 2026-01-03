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

import { queryOneWithRLS, queryWithRLS } from '@/core/lib/db'
import type {
  Task,
  TaskListOptions,
  TaskListResult,
  TaskStatus,
} from './tasks.types'

// Database row type for task
interface DbTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: string
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
        priority: task.priority as Task['priority'],
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
          priority: task.priority as Task['priority'],
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
        priority: task.priority as Task['priority'],
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
}
