/**
 * Type definitions for the NextSpark Mobile App
 *
 * Re-exports all types from their canonical locations for backward compatibility.
 */

// Re-export API types from package
export type { PaginatedResponse, SingleResponse } from '@nextsparkjs/mobile'
export { ApiError } from '@nextsparkjs/mobile'

// Re-export core types (auth, user, team) from package
export type {
  User,
  Team,
  AuthSession,
  LoginResponse,
  SessionResponse,
  TeamsResponse,
} from '@nextsparkjs/mobile'

// Re-export entity types
export type {
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  UpdateTaskInput,
} from '../entities/tasks/types'

export type {
  Customer,
  DayOption,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../entities/customers/types'

// Re-export entity constants
export {
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from '../entities/tasks/constants'

export { DAY_LABELS } from '../entities/customers/constants'
