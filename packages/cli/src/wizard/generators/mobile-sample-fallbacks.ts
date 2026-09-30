/**
 * The mobile template's sample entities (tasks, customers) import their API types from the generated
 * contracts package (@project/contracts). A web project whose template has no such entity (blog, crm,
 * productivity have neither, starter has no customers) would leave that import without an export, so the
 * scaffold gives the sample its own hand-written types instead, marked as a sample.
 *
 * These are the types the template shipped before the contracts existed.
 */

export const MOBILE_SAMPLE_ENTITIES = ['tasks', 'customers'] as const
export type MobileSampleEntity = (typeof MOBILE_SAMPLE_ENTITIES)[number]

const NOTE = `/**
 * SAMPLE: this project has no \`SLUG\` entity, so these types are written by hand and describe nothing the
 * server serves. Add the entity to the web project (its types are then generated into @project/contracts and
 * this file becomes a re-export), or delete the \`SLUG\` sample from mobile/ (src/entities, src/components/entities,
 * src/hooks, the screens under app/).
 */
`

export const MOBILE_SAMPLE_FALLBACK_TYPES: Record<MobileSampleEntity, string> = {
  tasks: NOTE.replace(/SLUG/g, 'tasks') + `
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
`,
  customers: NOTE.replace(/SLUG/g, 'customers') + `
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
`,
}
