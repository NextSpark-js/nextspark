import { createEntityApi } from '../../../../src/api/entities/factory'
import { apiClient } from '../../../../src/api/client'

// Mock the apiClient
jest.mock('../../../../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}))

interface Task {
  id: string
  title: string
  status: 'pending' | 'completed'
}

interface CreateTaskInput {
  title: string
  status?: 'pending' | 'completed'
}

interface UpdateTaskInput {
  title?: string
  status?: 'pending' | 'completed'
}

// What createApiResponse sends for a list: the pagination is in `info`, next to the timestamp
const LIST_INFO = (total: number, page: number, limit: number) => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
})

describe('createEntityApi', () => {
  const tasksApi = createEntityApi<Task, CreateTaskInput, UpdateTaskInput>('tasks')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('calls apiClient.get with correct path', async () => {
      const mockResponse = {
        success: true,
        data: [{ id: '1', title: 'Task 1', status: 'pending' }],
        info: LIST_INFO(1, 1, 10),
      }
      ;(apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await tasksApi.list()

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks', undefined)
      expect(result).toEqual(mockResponse)
    })

    it('passes params to apiClient.get', async () => {
      const mockResponse = { success: true, data: [], info: LIST_INFO(0, 2, 5) }
      ;(apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse)

      await tasksApi.list({ page: 2, limit: 5 })

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks', { page: 2, limit: 5 })
    })

    it('passes filter params', async () => {
      const mockResponse = { success: true, data: [], info: LIST_INFO(0, 1, 10) }
      ;(apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse)

      await tasksApi.list({ page: 1, limit: 10, status: 'pending' })

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks', {
        page: 1,
        limit: 10,
        status: 'pending',
      })
    })
  })

  describe('get', () => {
    it('calls apiClient.get with correct path including id and unwraps response', async () => {
      const mockEntity = { id: 'task-1', title: 'Task 1', status: 'pending' }
      const mockResponse = { data: mockEntity }
      ;(apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await tasksApi.get('task-1')

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks/task-1')
      // Result should be the entity directly, not wrapped in { data: ... }
      expect(result).toEqual(mockEntity)
    })
  })

  describe('create', () => {
    it('calls apiClient.post with correct path and data and unwraps response', async () => {
      const mockEntity = { id: 'new-task', title: 'New Task', status: 'pending' }
      const mockResponse = { data: mockEntity }
      ;(apiClient.post as jest.Mock).mockResolvedValueOnce(mockResponse)

      const createData: CreateTaskInput = { title: 'New Task', status: 'pending' }
      const result = await tasksApi.create(createData)

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/tasks', createData)
      // Result should be the entity directly, not wrapped in { data: ... }
      expect(result).toEqual(mockEntity)
    })
  })

  describe('update', () => {
    it('calls apiClient.patch with correct path and data and unwraps response', async () => {
      const mockEntity = { id: 'task-1', title: 'Task 1', status: 'completed' }
      const mockResponse = { data: mockEntity }
      ;(apiClient.patch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const updateData: UpdateTaskInput = { status: 'completed' }
      const result = await tasksApi.update('task-1', updateData)

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/tasks/task-1', updateData)
      // Result should be the entity directly, not wrapped in { data: ... }
      expect(result).toEqual(mockEntity)
    })
  })

  describe('delete', () => {
    it('calls apiClient.delete with correct path', async () => {
      ;(apiClient.delete as jest.Mock).mockResolvedValueOnce(undefined)

      await tasksApi.delete('task-1')

      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/tasks/task-1')
    })
  })

  describe('entity path handling', () => {
    it('creates API for different entities', () => {
      const customersApi = createEntityApi('customers')
      const productsApi = createEntityApi('products')

      // Verify different entity paths are constructed correctly
      ;(apiClient.get as jest.Mock).mockResolvedValue({ data: [] })

      customersApi.list()
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/customers', undefined)

      productsApi.list()
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/products', undefined)
    })

    it('handles nested entity paths', async () => {
      const nestedApi = createEntityApi('teams/members')
      ;(apiClient.get as jest.Mock).mockResolvedValue({ data: [] })

      await nestedApi.list()

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/teams/members', undefined)
    })
  })
})
