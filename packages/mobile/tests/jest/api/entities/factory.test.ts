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

describe('createEntityApi', () => {
  const tasksApi = createEntityApi<Task, CreateTaskInput, UpdateTaskInput>('tasks')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('calls apiClient.get with correct path', async () => {
      const mockResponse = {
        data: [{ id: '1', title: 'Task 1', status: 'pending' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }
      ;(apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await tasksApi.list()

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks', undefined)
      expect(result).toEqual(mockResponse)
    })

    it('passes params to apiClient.get', async () => {
      const mockResponse = { data: [], meta: { total: 0, page: 2, limit: 5, totalPages: 0 } }
      ;(apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse)

      await tasksApi.list({ page: 2, limit: 5 })

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks', { page: 2, limit: 5 })
    })

    it('passes filter params', async () => {
      const mockResponse = { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }
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
    it('calls apiClient.get with correct path including id', async () => {
      const mockResponse = { data: { id: 'task-1', title: 'Task 1', status: 'pending' } }
      ;(apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await tasksApi.get('task-1')

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks/task-1')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('create', () => {
    it('calls apiClient.post with correct path and data', async () => {
      const mockResponse = { data: { id: 'new-task', title: 'New Task', status: 'pending' } }
      ;(apiClient.post as jest.Mock).mockResolvedValueOnce(mockResponse)

      const createData: CreateTaskInput = { title: 'New Task', status: 'pending' }
      const result = await tasksApi.create(createData)

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/tasks', createData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('update', () => {
    it('calls apiClient.patch with correct path and data', async () => {
      const mockResponse = { data: { id: 'task-1', title: 'Task 1', status: 'completed' } }
      ;(apiClient.patch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const updateData: UpdateTaskInput = { status: 'completed' }
      const result = await tasksApi.update('task-1', updateData)

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/tasks/task-1', updateData)
      expect(result).toEqual(mockResponse)
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
