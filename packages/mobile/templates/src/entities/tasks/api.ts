/**
 * Tasks API
 *
 * Uses the entity factory from @nextsparkjs/mobile to create
 * a typed API client for the tasks entity.
 */

import { createEntityApi } from '@nextsparkjs/mobile'
import type { Task, CreateTaskInput, UpdateTaskInput } from './types'

export const tasksApi = createEntityApi<Task, CreateTaskInput, UpdateTaskInput>('tasks')
