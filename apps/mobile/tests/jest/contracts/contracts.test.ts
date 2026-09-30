/**
 * The app's API types are the generated contracts (@project/contracts, from apps/dev's entities), and the
 * contracts run here: Metro/Jest resolve the package, and zod runs under the app's own toolchain.
 */
import {
  apiErrorResponseSchema,
  apiListResponseSchema,
  apiSuccessResponseSchema,
  createCustomerInputSchema,
  createTaskInputSchema,
  customerSchema,
  customersApiPath,
  taskSchema,
  tasksApiPath,
  updateTaskInputSchema,
} from '@project/contracts'
import type { Customer, Task } from '@/entities'
import type { ApiListResponse, ApiSuccessResponse } from '@project/contracts'
import type { PaginatedResponse, SingleResponse } from '@nextsparkjs/mobile'
import { listInfo } from '../list-info'

// The client's envelope types (packages/mobile) and the generated contracts' are one shape: each is
// assignable to the other. A drift in either fails the type-check of this file.
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const listEnvelopeIsTheContract: Mutual<PaginatedResponse<Task>, ApiListResponse<Task>> = true
const singleEnvelopeIsTheContract: Mutual<SingleResponse<Task>, ApiSuccessResponse<Task>> = true

const task: Task = {
  id: 'task-1',
  title: 'Write the contracts',
  description: null,
  status: 'in-progress',
  priority: 'high',
  completed: false,
  teamId: 'team-1',
  userId: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('@project/contracts in apps/mobile', () => {
  it('the client envelope types are the contract envelopes, and the fixtures the tests use are what the schema accepts', () => {
    expect([listEnvelopeIsTheContract, singleEnvelopeIsTheContract]).toEqual([true, true])
    const list: PaginatedResponse<Task> = { success: true, data: [task], info: listInfo(1, 1, 20) }
    expect(apiListResponseSchema(taskSchema).safeParse(list).success).toBe(true)
  })

  it('the entity types the app uses are the ones the schemas describe', () => {
    expect(taskSchema.parse(task)).toEqual(task)
    const customer: Customer = { id: 'c-1', name: 'Acme', account: 7, office: 'HQ', teamId: 'team-1', userId: 'user-1', createdAt: 'a', updatedAt: 'b' }
    expect(customerSchema.parse(customer)).toEqual(customer)
  })

  it('the API paths are the ones the entity clients call', () => {
    expect(tasksApiPath).toBe('/api/v1/tasks')
    expect(customersApiPath).toBe('/api/v1/customers')
  })

  it('a create payload is validated like the server does: strict keys, real options, required fields', () => {
    expect(createTaskInputSchema.safeParse({ title: 'x', status: 'todo', priority: 'urgent' }).success).toBe(true)
    expect(createTaskInputSchema.safeParse({ title: 'x', status: 'archived' }).success).toBe(false)
    expect(createTaskInputSchema.safeParse({ title: 'x', projectId: 'p-1' }).success).toBe(false)
    expect(createTaskInputSchema.safeParse({}).success).toBe(false)
    expect(updateTaskInputSchema.safeParse({ description: null }).success).toBe(true)
    expect(createCustomerInputSchema.safeParse({ name: 'A', account: 1, office: 'O', visitDays: ['lun', 'vie'] }).success).toBe(true)
    expect(createCustomerInputSchema.safeParse({ name: 'A', account: 1, office: 'O', visitDays: ['sab'] }).success).toBe(false)
  })

  it('the response envelopes are what the API sends: success + data + info, with the pagination in info', () => {
    const info = { timestamp: '2026-01-01T00:00:00.000Z', page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false }
    expect(apiListResponseSchema(taskSchema).safeParse({ success: true, data: [task], info }).success).toBe(true)
    expect(apiSuccessResponseSchema(taskSchema).safeParse({ success: true, data: task, info: { timestamp: 'now' } }).success).toBe(true)
    expect(apiErrorResponseSchema.safeParse({ success: false, error: 'Nope', code: 'HTTP_404' }).success).toBe(true)
    expect(apiListResponseSchema(taskSchema).safeParse({ data: [task], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }).success).toBe(false)
  })
})
