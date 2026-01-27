/**
 * Task Entity Types
 *
 * Example entity showing the pattern for mobile entities.
 * Copy this structure for your own entities.
 */

export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  userId: string
  teamId: string
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: Task['status']
  priority?: Task['priority']
  dueDate?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: Task['status']
  priority?: Task['priority']
  dueDate?: string
}
