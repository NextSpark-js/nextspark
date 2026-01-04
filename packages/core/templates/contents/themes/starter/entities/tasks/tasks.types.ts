/**
 * Tasks Service Types - Starter Theme
 *
 * Type definitions for the TasksService.
 * Tasks is a private entity with shared: false - users only see their own tasks.
 *
 * @module TasksTypes
 */

/**
 * Task status values
 */
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked'

/**
 * Task priority values
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Task entity
 */
export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  tags?: string[]
  dueDate?: string
  estimatedHours?: number
  completed?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Options for listing tasks
 */
export interface TaskListOptions {
  limit?: number
  offset?: number
  status?: TaskStatus
  priority?: TaskPriority
  orderBy?: 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt'
  orderDir?: 'asc' | 'desc'
}

/**
 * Result of listing tasks with pagination
 */
export interface TaskListResult {
  tasks: Task[]
  total: number
}

/**
 * Create task input
 */
export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  tags?: string[]
  dueDate?: string
  estimatedHours?: number
}

/**
 * Update task input
 */
export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  tags?: string[]
  dueDate?: string
  estimatedHours?: number
  completed?: boolean
}
