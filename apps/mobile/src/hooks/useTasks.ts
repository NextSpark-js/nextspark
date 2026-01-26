/**
 * TanStack Query hooks for Tasks CRUD
 *
 * @deprecated Import from '../entities/tasks' instead
 */

export {
  useTasks,
  useTask,
  TASKS_QUERY_KEY,
} from '../entities/tasks/queries'

export {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskStatus,
} from '../entities/tasks/mutations'
