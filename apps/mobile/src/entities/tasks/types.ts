/**
 * Task Entity Types
 */

// Task status options (matching backend - uses hyphens, not underscores)
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked'

// Task priority options
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

// Task entity
export interface Task {
  id: string
  title: string
  description?: string | null
  projectId?: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string | null
  assigneeId?: string | null
  estimatedHours?: number | null
  actualHours?: number | null
  teamId: string
  userId: string
  createdAt: string
  updatedAt: string
}

// Create task payload
export interface CreateTaskInput {
  title: string
  description?: string
  projectId?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  assigneeId?: string
  estimatedHours?: number
}

// Update task payload
export interface UpdateTaskInput {
  title?: string
  description?: string | null
  projectId?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string | null
  assigneeId?: string | null
  estimatedHours?: number | null
  actualHours?: number | null
}
