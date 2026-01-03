/**
 * Core Task types for the application
 * Centralized type definitions to ensure consistency across components
 */

export interface Task {
  id: string
  userId: string
  title: string
  description?: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Task priority levels with display information
 */
export interface TaskPriority {
  level: 'low' | 'medium' | 'high'
  label: string
  color: string
}

/**
 * Task category information
 */
export interface TaskCategory {
  name: string
  icon?: string
}

/**
 * Extended Task interface for search functionality
 * Includes inferred metadata for better UX
 */
export interface SearchableTask extends Task {
  // Campos adicionales inferidos para búsqueda/display
  priority?: TaskPriority['level']
  category?: string
}

/**
 * Task update payload for API calls
 */
export interface TaskUpdatePayload {
  title?: string
  description?: string
  completed?: boolean
}

/**
 * Task creation payload for API calls
 */
export interface TaskCreatePayload {
  title: string
  description?: string
}

/**
 * Priority levels with their display configuration
 */
export const TASK_PRIORITIES: Record<TaskPriority['level'], Omit<TaskPriority, 'level'>> = {
  high: {
    label: 'Alta',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  },
  medium: {
    label: 'Media', 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  },
  low: {
    label: 'Baja',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }
}

/**
 * Available task categories
 */
export const TASK_CATEGORIES = [
  'Diseño',
  'Desarrollo', 
  'Reuniones',
  'Documentación',
  'Testing',
  'General'
] as const

export type TaskCategoryType = typeof TASK_CATEGORIES[number]
