/**
 * Activity Service Types
 *
 * Type definitions for the ActivityService.
 * Defines types for activity tracking including calls, meetings, tasks,
 * and their relationships to contacts, companies, and opportunities.
 *
 * @module ActivityTypes
 */

// Type literals for select fields
export type ActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'task'
  | 'note'
  | 'demo'
  | 'presentation'

export type ActivityStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'overdue'

export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent'

// Main entity interface
export interface Activity {
  id: string
  teamId: string
  type: ActivityType
  subject: string
  description?: string | null
  status?: ActivityStatus | null
  priority?: ActivityPriority | null
  dueDate?: string | null
  completedAt?: string | null
  duration?: number | null
  outcome?: string | null
  location?: string | null
  contactId?: string | null
  companyId?: string | null
  opportunityId?: string | null
  assignedTo?: string | null
  createdAt: string
  updatedAt: string
}

// List options
export interface ActivityListOptions {
  limit?: number
  offset?: number
  teamId?: string
  type?: ActivityType
  status?: ActivityStatus
  priority?: ActivityPriority
  contactId?: string
  companyId?: string
  opportunityId?: string
  assignedTo?: string
  orderBy?:
    | 'type'
    | 'subject'
    | 'status'
    | 'priority'
    | 'dueDate'
    | 'completedAt'
    | 'duration'
    | 'createdAt'
    | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface ActivityListResult {
  activities: Activity[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface ActivityCreateData {
  type: ActivityType
  subject: string
  teamId: string
  description?: string
  status?: ActivityStatus
  priority?: ActivityPriority
  dueDate?: string
  duration?: number
  outcome?: string
  location?: string
  contactId?: string
  companyId?: string
  opportunityId?: string
  assignedTo?: string
}

// Update data (all fields optional)
export interface ActivityUpdateData {
  type?: ActivityType
  subject?: string
  description?: string | null
  status?: ActivityStatus | null
  priority?: ActivityPriority | null
  dueDate?: string | null
  completedAt?: string | null
  duration?: number | null
  outcome?: string | null
  location?: string | null
  contactId?: string | null
  companyId?: string | null
  opportunityId?: string | null
  assignedTo?: string | null
}
