/**
 * Tasks API Client
 *
 * Auto-generated entity API using createEntityApi factory.
 */

import { createEntityApi } from '../../api/entities'
import type { Task, CreateTaskInput, UpdateTaskInput } from './types'

export const tasksApi = createEntityApi<Task, CreateTaskInput, UpdateTaskInput>('tasks')
