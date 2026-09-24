/**
 * Starter Theme Utility Functions
 *
 * Custom utilities specific to the starter theme.
 * For core utilities, import from @nextsparkjs/core/lib/utils
 */

/**
 * Format a date relative to now (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) {
    return 'yesterday'
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`
}

/**
 * Calculate task statistics from a list of tasks
 */
export interface TaskStats {
  total: number
  completed: number
  inProgress: number
  todo: number
  overdue: number
  completionRate: number
}

export function calculateTaskStats(tasks: Array<{ status: string; dueDate?: string | null }>): TaskStats {
  const now = new Date()

  const stats = tasks.reduce(
    (acc, task) => {
      acc.total++

      switch (task.status) {
        case 'done':
          acc.completed++
          break
        case 'in_progress':
          acc.inProgress++
          break
        case 'todo':
          acc.todo++
          break
      }

      if (task.dueDate && task.status !== 'done') {
        const dueDate = new Date(task.dueDate)
        if (dueDate < now) {
          acc.overdue++
        }
      }

      return acc
    },
    { total: 0, completed: 0, inProgress: 0, todo: 0, overdue: 0 }
  )

  return {
    ...stats,
    completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
  }
}

/**
 * Group tasks by a specific field
 */
export function groupTasksBy<T extends Record<string, unknown>>(
  tasks: T[],
  key: keyof T
): Record<string, T[]> {
  return tasks.reduce(
    (acc, task) => {
      const value = String(task[key] ?? 'undefined')
      if (!acc[value]) {
        acc[value] = []
      }
      acc[value].push(task)
      return acc
    },
    {} as Record<string, T[]>
  )
}

/**
 * Get priority color class
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
    case 'high':
      return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
    case 'medium':
      return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30'
    case 'low':
    default:
      return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
  }
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'done':
      return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
    case 'in_progress':
      return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
    case 'todo':
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
    case 'cancelled':
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
    default:
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
  }
}
