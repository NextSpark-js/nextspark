/**
 * Task Entity Types
 *
 * Not written here: the API shape of an entity is generated from the project's entity config into
 * the portable contracts package (`nextspark prepare`), so the app cannot drift from the server.
 */

export type {
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  UpdateTaskInput,
} from '@project/contracts'
