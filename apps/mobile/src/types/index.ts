/**
 * Type definitions for the NextSpark Mobile App
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

// Day options for visit/contact days
export type DayOption = 'lun' | 'mar' | 'mie' | 'jue' | 'vie'

// Customer entity
export interface Customer {
  id: string
  name: string
  account: number
  office: string
  phone?: string | null
  salesRep?: string | null
  visitDays?: DayOption[] | null
  contactDays?: DayOption[] | null
  teamId: string
  createdAt: string
  updatedAt: string
}

// Create customer payload
export interface CreateCustomerInput {
  name: string
  account: number
  office: string
  phone?: string
  salesRep?: string
  visitDays?: DayOption[]
  contactDays?: DayOption[]
}

// Update customer payload
export interface UpdateCustomerInput {
  name?: string
  account?: number
  office?: string
  phone?: string | null
  salesRep?: string | null
  visitDays?: DayOption[] | null
  contactDays?: DayOption[] | null
}

// Day labels for display
export const DAY_LABELS: Record<DayOption, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
}

// User
export interface User {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

// Team (matches backend response from /api/v1/teams)
export interface Team {
  id: string
  name: string
  slug?: string
  logo?: string | null
  role: string  // User's role in this team (owner, admin, member, viewer, etc.)
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface SingleResponse<T> {
  data: T
}

// Auth types
export interface AuthSession {
  token: string
  user: User
}

export interface LoginResponse {
  user: User
  session: {
    token: string
  }
}

export interface SessionResponse {
  user: User | null
  session: {
    id: string
    expiresAt: string
  } | null
}

export interface TeamsResponse {
  data: Team[]
}

// Status display helpers
export const STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'In Review',
  'done': 'Done',
  'blocked': 'Blocked',
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': '#6B7280',
  'in-progress': '#3B82F6',
  'review': '#F59E0B',
  'done': '#10B981',
  'blocked': '#EF4444',
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
}
