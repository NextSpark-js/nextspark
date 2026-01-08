/**
 * Unit Tests - TasksService (Starter Theme)
 *
 * Tests for the TasksService class methods:
 * - Input validation (required fields, empty strings)
 * - Data transformation (database null → undefined)
 * - Default values for optional fields
 * - Error handling
 *
 * Focus on business logic WITHOUT actual database calls.
 * Database functions are mocked to isolate the service logic.
 *
 * This is the starter theme version - it tests the read-only service methods.
 * For full CRUD tests, see the default theme's tasks.service.test.ts
 */

// Mock the database module before importing the service
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
}))

import { TasksService } from '@/contents/themes/starter/entities/tasks/tasks.service'
import type { Task, TaskStatus, TaskPriority } from '@/contents/themes/starter/entities/tasks/tasks.types'

// Get the mocked functions
const mockQueryOneWithRLS = jest.requireMock('@nextsparkjs/core/lib/db').queryOneWithRLS
const mockQueryWithRLS = jest.requireMock('@nextsparkjs/core/lib/db').queryWithRLS

// Helper to create a mock database task row
const createMockDbTask = (overrides = {}) => ({
  id: 'task-123',
  title: 'Test Task',
  description: 'Test description',
  status: 'todo' as TaskStatus,
  priority: 'medium' as TaskPriority,
  tags: ['tag1', 'tag2'],
  dueDate: '2025-12-31',
  estimatedHours: 5,
  completed: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

describe('TasksService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // getById
  // ============================================================
  describe('getById', () => {
    describe('Input Validation', () => {
      it('should throw error when id is empty', async () => {
        await expect(TasksService.getById('', 'user-123'))
          .rejects.toThrow('Task ID is required')
      })

      it('should throw error when id is whitespace only', async () => {
        await expect(TasksService.getById('   ', 'user-123'))
          .rejects.toThrow('Task ID is required')
      })

      it('should throw error when userId is empty', async () => {
        await expect(TasksService.getById('task-123', ''))
          .rejects.toThrow('User ID is required for authentication')
      })

      it('should throw error when userId is whitespace only', async () => {
        await expect(TasksService.getById('task-123', '   '))
          .rejects.toThrow('User ID is required for authentication')
      })
    })

    describe('Successful Retrieval', () => {
      it('should return task when found', async () => {
        const mockTask = createMockDbTask()
        mockQueryOneWithRLS.mockResolvedValue(mockTask)

        const result = await TasksService.getById('task-123', 'user-123')

        expect(result).not.toBeNull()
        expect(result?.id).toBe('task-123')
        expect(result?.title).toBe('Test Task')
        expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          ['task-123'],
          'user-123'
        )
      })

      it('should return null when task not found', async () => {
        mockQueryOneWithRLS.mockResolvedValue(null)

        const result = await TasksService.getById('non-existent', 'user-123')

        expect(result).toBeNull()
      })
    })

    describe('Data Transformation', () => {
      it('should transform null description to undefined', async () => {
        const mockTask = createMockDbTask({ description: null })
        mockQueryOneWithRLS.mockResolvedValue(mockTask)

        const result = await TasksService.getById('task-123', 'user-123')

        expect(result?.description).toBeUndefined()
      })

      it('should transform null tags to undefined', async () => {
        const mockTask = createMockDbTask({ tags: null })
        mockQueryOneWithRLS.mockResolvedValue(mockTask)

        const result = await TasksService.getById('task-123', 'user-123')

        expect(result?.tags).toBeUndefined()
      })

      it('should transform null dueDate to undefined', async () => {
        const mockTask = createMockDbTask({ dueDate: null })
        mockQueryOneWithRLS.mockResolvedValue(mockTask)

        const result = await TasksService.getById('task-123', 'user-123')

        expect(result?.dueDate).toBeUndefined()
      })

      it('should transform null estimatedHours to undefined', async () => {
        const mockTask = createMockDbTask({ estimatedHours: null })
        mockQueryOneWithRLS.mockResolvedValue(mockTask)

        const result = await TasksService.getById('task-123', 'user-123')

        expect(result?.estimatedHours).toBeUndefined()
      })

      it('should transform null completed to undefined', async () => {
        const mockTask = createMockDbTask({ completed: null })
        mockQueryOneWithRLS.mockResolvedValue(mockTask)

        const result = await TasksService.getById('task-123', 'user-123')

        expect(result?.completed).toBeUndefined()
      })

      it('should preserve non-null values', async () => {
        const mockTask = createMockDbTask()
        mockQueryOneWithRLS.mockResolvedValue(mockTask)

        const result = await TasksService.getById('task-123', 'user-123')

        expect(result?.description).toBe('Test description')
        expect(result?.tags).toEqual(['tag1', 'tag2'])
        expect(result?.dueDate).toBe('2025-12-31')
        expect(result?.estimatedHours).toBe(5)
        expect(result?.completed).toBe(false)
      })
    })

    describe('Error Handling', () => {
      it('should wrap database errors with descriptive message', async () => {
        mockQueryOneWithRLS.mockRejectedValue(new Error('Database connection failed'))

        await expect(TasksService.getById('task-123', 'user-123'))
          .rejects.toThrow('Database connection failed')
      })
    })
  })

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    describe('Input Validation', () => {
      it('should throw error when userId is empty', async () => {
        await expect(TasksService.list(''))
          .rejects.toThrow('User ID is required for authentication')
      })

      it('should throw error when userId is whitespace only', async () => {
        await expect(TasksService.list('   '))
          .rejects.toThrow('User ID is required for authentication')
      })
    })

    describe('Default Options', () => {
      it('should use default limit of 10', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '5' }]) // count query
          .mockResolvedValueOnce([]) // data query

        await TasksService.list('user-123')

        // Second call is the data query with LIMIT
        const dataQueryCall = mockQueryWithRLS.mock.calls[1]
        expect(dataQueryCall[0]).toContain('LIMIT')
        expect(dataQueryCall[1]).toContain(10) // default limit
      })

      it('should use default offset of 0', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '5' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123')

        const dataQueryCall = mockQueryWithRLS.mock.calls[1]
        expect(dataQueryCall[1]).toContain(0) // default offset
      })

      it('should use default orderBy createdAt DESC', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '5' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123')

        const dataQueryCall = mockQueryWithRLS.mock.calls[1]
        expect(dataQueryCall[0]).toContain('"createdAt"')
        expect(dataQueryCall[0]).toContain('DESC')
      })
    })

    describe('Filtering', () => {
      it('should filter by status when provided', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '2' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123', { status: 'todo' })

        const countQueryCall = mockQueryWithRLS.mock.calls[0]
        expect(countQueryCall[0]).toContain('status = $1')
        expect(countQueryCall[1]).toContain('todo')
      })

      it('should filter by priority when provided', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '2' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123', { priority: 'high' })

        const countQueryCall = mockQueryWithRLS.mock.calls[0]
        expect(countQueryCall[0]).toContain('priority = $1')
        expect(countQueryCall[1]).toContain('high')
      })

      it('should combine multiple filters with AND', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '1' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123', { status: 'todo', priority: 'high' })

        const countQueryCall = mockQueryWithRLS.mock.calls[0]
        expect(countQueryCall[0]).toContain('status = $1')
        expect(countQueryCall[0]).toContain('priority = $2')
        expect(countQueryCall[0]).toContain('AND')
      })
    })

    describe('Ordering', () => {
      const validOrderByFields = ['title', 'status', 'priority', 'dueDate', 'createdAt']

      validOrderByFields.forEach(field => {
        it(`should order by ${field} when specified`, async () => {
          mockQueryWithRLS
            .mockResolvedValueOnce([{ count: '5' }])
            .mockResolvedValueOnce([])

          await TasksService.list('user-123', { orderBy: field as any })

          const dataQueryCall = mockQueryWithRLS.mock.calls[1]
          // dueDate and createdAt need quotes in SQL
          const expectedColumn = ['dueDate', 'createdAt'].includes(field)
            ? `"${field}"`
            : field
          expect(dataQueryCall[0]).toContain(expectedColumn)
        })
      })

      it('should fallback to createdAt for invalid orderBy', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '5' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123', { orderBy: 'invalidField' as any })

        const dataQueryCall = mockQueryWithRLS.mock.calls[1]
        expect(dataQueryCall[0]).toContain('"createdAt"')
      })

      it('should order ASC when orderDir is asc', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '5' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123', { orderDir: 'asc' })

        const dataQueryCall = mockQueryWithRLS.mock.calls[1]
        expect(dataQueryCall[0]).toContain('ASC')
      })

      it('should order DESC when orderDir is desc', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '5' }])
          .mockResolvedValueOnce([])

        await TasksService.list('user-123', { orderDir: 'desc' })

        const dataQueryCall = mockQueryWithRLS.mock.calls[1]
        expect(dataQueryCall[0]).toContain('DESC')
      })
    })

    describe('Result Structure', () => {
      it('should return tasks array and total count', async () => {
        const mockTasks = [createMockDbTask(), createMockDbTask({ id: 'task-456' })]
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '10' }])
          .mockResolvedValueOnce(mockTasks)

        const result = await TasksService.list('user-123')

        expect(result.tasks).toHaveLength(2)
        expect(result.total).toBe(10)
      })

      it('should transform database rows to Task type', async () => {
        const mockTask = createMockDbTask({ description: null, tags: null })
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '1' }])
          .mockResolvedValueOnce([mockTask])

        const result = await TasksService.list('user-123')

        expect(result.tasks[0].description).toBeUndefined()
        expect(result.tasks[0].tags).toBeUndefined()
      })

      it('should return empty array when no tasks found', async () => {
        mockQueryWithRLS
          .mockResolvedValueOnce([{ count: '0' }])
          .mockResolvedValueOnce([])

        const result = await TasksService.list('user-123')

        expect(result.tasks).toEqual([])
        expect(result.total).toBe(0)
      })
    })
  })

  // ============================================================
  // getByStatus
  // ============================================================
  describe('getByStatus', () => {
    it('should call list with status filter', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([createMockDbTask(), createMockDbTask({ id: 'task-456' })])

      const result = await TasksService.getByStatus('user-123', 'in-progress')

      expect(result).toHaveLength(2)
      const countQueryCall = mockQueryWithRLS.mock.calls[0]
      expect(countQueryCall[1]).toContain('in-progress')
    })

    it('should order by priority DESC', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([createMockDbTask()])

      await TasksService.getByStatus('user-123', 'todo')

      const dataQueryCall = mockQueryWithRLS.mock.calls[1]
      expect(dataQueryCall[0]).toContain('priority')
      expect(dataQueryCall[0]).toContain('DESC')
    })

    it('should use large limit to get all matching tasks', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '500' }])
        .mockResolvedValueOnce([])

      await TasksService.getByStatus('user-123', 'todo')

      const dataQueryCall = mockQueryWithRLS.mock.calls[1]
      expect(dataQueryCall[1]).toContain(1000) // Large limit
    })
  })

  // ============================================================
  // getOverdue
  // ============================================================
  describe('getOverdue', () => {
    describe('Input Validation', () => {
      it('should throw error when userId is empty', async () => {
        await expect(TasksService.getOverdue(''))
          .rejects.toThrow('User ID is required for authentication')
      })

      it('should throw error when userId is whitespace only', async () => {
        await expect(TasksService.getOverdue('   '))
          .rejects.toThrow('User ID is required for authentication')
      })
    })

    describe('Query', () => {
      it('should query tasks with dueDate before today', async () => {
        mockQueryWithRLS.mockResolvedValue([])

        await TasksService.getOverdue('user-123')

        const queryCall = mockQueryWithRLS.mock.calls[0]
        expect(queryCall[0]).toContain('"dueDate" < CURRENT_DATE')
      })

      it('should exclude done tasks', async () => {
        mockQueryWithRLS.mockResolvedValue([])

        await TasksService.getOverdue('user-123')

        const queryCall = mockQueryWithRLS.mock.calls[0]
        expect(queryCall[0]).toContain("status != 'done'")
      })

      it('should exclude completed tasks', async () => {
        mockQueryWithRLS.mockResolvedValue([])

        await TasksService.getOverdue('user-123')

        const queryCall = mockQueryWithRLS.mock.calls[0]
        expect(queryCall[0]).toContain('completed IS NULL OR completed = false')
      })

      it('should order by dueDate ascending', async () => {
        mockQueryWithRLS.mockResolvedValue([])

        await TasksService.getOverdue('user-123')

        const queryCall = mockQueryWithRLS.mock.calls[0]
        expect(queryCall[0]).toContain('"dueDate" ASC')
      })
    })

    describe('Result', () => {
      it('should return array of overdue tasks', async () => {
        const mockTasks = [
          createMockDbTask({ dueDate: '2024-01-01' }),
          createMockDbTask({ id: 'task-456', dueDate: '2024-06-01' }),
        ]
        mockQueryWithRLS.mockResolvedValue(mockTasks)

        const result = await TasksService.getOverdue('user-123')

        expect(result).toHaveLength(2)
      })

      it('should transform database rows correctly', async () => {
        const mockTask = createMockDbTask({ description: null })
        mockQueryWithRLS.mockResolvedValue([mockTask])

        const result = await TasksService.getOverdue('user-123')

        expect(result[0].description).toBeUndefined()
      })
    })
  })

  // ============================================================
  // getDueToday
  // ============================================================
  describe('getDueToday', () => {
    describe('Input Validation', () => {
      it('should throw error when userId is empty', async () => {
        await expect(TasksService.getDueToday(''))
          .rejects.toThrow('User ID is required for authentication')
      })

      it('should throw error when userId is whitespace only', async () => {
        await expect(TasksService.getDueToday('   '))
          .rejects.toThrow('User ID is required for authentication')
      })
    })

    describe('Query', () => {
      it('should query tasks with dueDate equal to today', async () => {
        mockQueryWithRLS.mockResolvedValue([])

        await TasksService.getDueToday('user-123')

        const queryCall = mockQueryWithRLS.mock.calls[0]
        expect(queryCall[0]).toContain('"dueDate" = CURRENT_DATE')
      })

      it('should exclude done tasks', async () => {
        mockQueryWithRLS.mockResolvedValue([])

        await TasksService.getDueToday('user-123')

        const queryCall = mockQueryWithRLS.mock.calls[0]
        expect(queryCall[0]).toContain("status != 'done'")
      })

      it('should order by priority DESC then createdAt ASC', async () => {
        mockQueryWithRLS.mockResolvedValue([])

        await TasksService.getDueToday('user-123')

        const queryCall = mockQueryWithRLS.mock.calls[0]
        expect(queryCall[0]).toContain('priority DESC')
        expect(queryCall[0]).toContain('"createdAt" ASC')
      })
    })

    describe('Result', () => {
      it('should return array of tasks due today', async () => {
        const today = new Date().toISOString().split('T')[0]
        const mockTasks = [
          createMockDbTask({ dueDate: today }),
          createMockDbTask({ id: 'task-456', dueDate: today }),
        ]
        mockQueryWithRLS.mockResolvedValue(mockTasks)

        const result = await TasksService.getDueToday('user-123')

        expect(result).toHaveLength(2)
      })

      it('should transform database rows correctly', async () => {
        const mockTask = createMockDbTask({ description: null, tags: null })
        mockQueryWithRLS.mockResolvedValue([mockTask])

        const result = await TasksService.getDueToday('user-123')

        expect(result[0].description).toBeUndefined()
        expect(result[0].tags).toBeUndefined()
      })
    })
  })
})
