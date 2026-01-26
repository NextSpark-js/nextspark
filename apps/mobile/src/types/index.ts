/**
 * Type definitions for the NextSpark Mobile App
 *
 * Re-exports all types from their canonical locations for backward compatibility.
 */

// Re-export from shared types (POC)
export type { BaseUser, BaseTeam, BaseTeamMember } from "@nextsparkjs/types"

// Re-export API types
export type { PaginatedResponse, SingleResponse } from '../api/client.types'
export { ApiError } from '../api/client.types'

// Re-export core types (auth, user, team)
export type {
  User,
  Team,
  AuthSession,
  LoginResponse,
  SessionResponse,
  TeamsResponse,
} from '../api/core/types'

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
