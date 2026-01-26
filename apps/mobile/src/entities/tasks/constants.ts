/**
 * Task Entity Constants
 */

import type { TaskStatus, TaskPriority } from './types'

// Status display labels
export const STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'In Review',
  'done': 'Done',
  'blocked': 'Blocked',
}

// Priority display labels
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

// Status colors
export const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': '#6B7280',
  'in-progress': '#3B82F6',
  'review': '#F59E0B',
  'done': '#10B981',
  'blocked': '#EF4444',
}

// Priority colors
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
}
